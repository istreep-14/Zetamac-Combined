// Background service worker: receives session payloads, updates local aggregates, queues Sheets upload.

const QUEUE_KEY = 'sheets_upload_queue';
const AGG_KEY = 'aggregates_v1';
const RECENT_SESSIONS_KEY = 'recent_sessions';
const SHEET_ID_KEY = 'sheets_spreadsheet_id';
const SHEET_TITLE = 'Zetamac Tracker';
const SESSIONS_SHEET = 'Sessions';
const PROBLEMS_SHEET = 'Problems';

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
	if (message && message.type === 'SESSION_COMPLETE' && message.data) {
		handleSessionComplete(message.data);
	}
	if (message && message.type === 'MANUAL_SYNC') {
		processQueue(true).then((ok) => sendResponse({ ok })).catch(err => sendResponse({ ok: false, error: String(err) }));
		return true; // async response
	}
	if (message && message.type === 'CHECK_AUTH') {
		getAuthToken(false).then((token) => sendResponse({ ok: !!token })).catch(() => sendResponse({ ok: false }));
		return true;
	}
	if (message && message.type === 'AUTHORIZE') {
		getAuthToken(true).then((token) => sendResponse({ ok: !!token })).catch(() => sendResponse({ ok: false }));
		return true;
	}
});

async function handleSessionComplete(session) {
	// Update local aggregates (minimal stub; full math implemented later)
	const agg = await getAggregates();
	updateAggregates(agg, session);
	await setAggregates(agg);

	// Store recent sessions (prepend)
	await prependRecentSession(session);

	// Queue for Sheets upload
	await enqueueForSheets(session);

	// Best-effort background processing (non-interactive)
	processQueue(false).catch(()=>{});
}

async function getAggregates() {
	return new Promise(resolve => {
		chrome.storage.local.get({ [AGG_KEY]: defaultAggregates() }, (res) => {
			resolve(res[AGG_KEY] || defaultAggregates());
		});
	});
}

function defaultAggregates() {
	return {
		operators: {}, // key: `${mode}|${dur}|${op}` -> { count, sum_ms, median_estimate, p90_estimate, buckets }
		last_updated_utc: new Date().toISOString()
	};
}

async function setAggregates(agg) {
	return new Promise(resolve => {
		agg.last_updated_utc = new Date().toISOString();
		chrome.storage.local.set({ [AGG_KEY]: agg }, () => resolve());
	});
}

function updateAggregates(agg, session) {
	const mode = session.mode_label || 'Normal';
	const dur = session.duration_s || 120;
	for (const p of session.problems || []) {
		if (!p || p.outlier_flag) continue; // exclude outliers from default aggregates
		const k = `${mode}|${dur}|${p.operator}`;
		if (!agg.operators[k]) agg.operators[k] = { count: 0, sum_ms: 0 };
		agg.operators[k].count += 1;
		agg.operators[k].sum_ms += p.latency_ms;
	}
}

async function enqueueForSheets(session) {
	const item = {
		id: `${session.session_id}`,
		created_utc: new Date().toISOString(),
		session
	};
	return new Promise(resolve => {
		chrome.storage.local.get({ [QUEUE_KEY]: [] }, (res) => {
			const q = res[QUEUE_KEY];
			q.push(item);
			chrome.storage.local.set({ [QUEUE_KEY]: q }, () => resolve());
		});
	});
}

async function prependRecentSession(session) {
	return new Promise(resolve => {
		chrome.storage.local.get({ [RECENT_SESSIONS_KEY]: [] }, (res) => {
			const arr = res[RECENT_SESSIONS_KEY];
			const row = {
				timestamp_end_utc: new Date().toISOString(),
				session_id: session.session_id,
				key: session.key,
				mode_label: session.mode_label || 'Normal',
				duration_s: session.duration_s,
				score_final: session.score_final,
				problems_captured: session.problems_captured,
				score_timeline_10s: session.score_timeline_10s || '',
				bucket_size_s: session.bucket_size_s || 10
			};
			arr.unshift(row);
			// cap to last 200 for quick popup/dashboard
			while (arr.length > 200) arr.pop();
			chrome.storage.local.set({ [RECENT_SESSIONS_KEY]: arr }, () => resolve());
		});
	});
}

// ===== Sheets Auth & Sync =====
let processing = false;

function getAuthToken(interactive) {
	return new Promise((resolve) => {
		try {
			chrome.identity.getAuthToken({ interactive: !!interactive }, (token) => {
				if (chrome.runtime.lastError) { resolve(null); return; }
				resolve(token || null);
			});
		} catch (e) {
			resolve(null);
		}
	});
}

async function authedFetch(url, options = {}, interactive = false) {
	const token = await getAuthToken(interactive);
	if (!token) throw new Error('No auth token');
	const headers = Object.assign({}, options.headers || {}, {
		'Authorization': `Bearer ${token}`,
		'Content-Type': 'application/json'
	});
	const res = await fetch(url, Object.assign({}, options, { headers }));
	if (!res.ok) {
		const text = await res.text().catch(()=> '');
		throw new Error(`HTTP ${res.status} ${res.statusText}: ${text}`);
	}
	return res;
}

async function ensureSpreadsheetExists(interactive) {
	return new Promise((resolve) => {
		chrome.storage.local.get({ [SHEET_ID_KEY]: null }, async (res) => {
			let spreadsheetId = res[SHEET_ID_KEY];
			try {
				if (!spreadsheetId) {
					// Create new spreadsheet with two sheets
					const createBody = {
						properties: { title: SHEET_TITLE },
						sheets: [
							{ properties: { title: SESSIONS_SHEET } },
							{ properties: { title: PROBLEMS_SHEET } }
						]
					};
					const createRes = await authedFetch('https://sheets.googleapis.com/v4/spreadsheets', {
						method: 'POST',
						body: JSON.stringify(createBody)
					}, interactive);
					const created = await createRes.json();
					spreadsheetId = created.spreadsheetId;
					// Write headers
					await appendValues(spreadsheetId, `${SESSIONS_SHEET}!A1`, [sessionHeaderRow()], interactive);
					await appendValues(spreadsheetId, `${PROBLEMS_SHEET}!A1`, [problemHeaderRow()], interactive);
					chrome.storage.local.set({ [SHEET_ID_KEY]: spreadsheetId }, () => resolve(spreadsheetId));
				} else {
					resolve(spreadsheetId);
				}
			} catch (e) {
				resolve(null);
			}
		});
	});
}

function sessionHeaderRow() {
	return [
		'timestamp_end_utc', 'session_id', 'key', 'mode_label', 'duration_s',
		'score_final', 'problems_captured', 'bucket_size_s', 'score_timeline_10s'
	];
}

function problemHeaderRow() {
	return [
		'session_id', 'problem_index', 'timestamp_start', 'timestamp_end', 'latency_ms',
		'problem_text', 'operator', 'operand_a', 'operand_b', 'commutative_key', 'outlier_flag', 'close_reason'
	];
}

async function appendValues(spreadsheetId, rangeA1, rows, interactive) {
	const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(rangeA1)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`;
	await authedFetch(url, {
		method: 'POST',
		body: JSON.stringify({ values: rows })
	}, interactive);
}

async function processQueue(interactive) {
	if (processing) return true;
	processing = true;
	try {
		const token = await getAuthToken(!!interactive);
		if (!token) { return false; }
		const spreadsheetId = await ensureSpreadsheetExists(!!interactive);
		if (!spreadsheetId) { return false; }
		// snapshot queue
		const q = await new Promise(resolve => chrome.storage.local.get({ [QUEUE_KEY]: [] }, res => resolve(res[QUEUE_KEY])));
		if (!q.length) return true;
		let remaining = q.slice();
		let changed = false;
		for (let i = 0; i < q.length; i++) {
			const item = q[i];
			try {
				const s = item.session || item; // backward safety
				// Append session row
				const sessionRow = [
					new Date().toISOString(),
					s.session_id,
					s.key || '',
					s.mode_label || 'Normal',
					s.duration_s || 120,
					s.score_final || 0,
					s.problems_captured || (s.problems ? s.problems.length : 0),
					s.bucket_size_s || 10,
					s.score_timeline_10s || ''
				];
				await appendValues(spreadsheetId, `${SESSIONS_SHEET}!A1`, [sessionRow], false);
				// Append problems rows (if any)
				const probs = Array.isArray(s.problems) ? s.problems : [];
				if (probs.length) {
					const rows = probs.map(p => [
						s.session_id,
						p.problem_index,
						p.timestamp_start,
						p.timestamp_end,
						p.latency_ms,
						p.problem_text,
						p.operator,
						p.operand_a,
						p.operand_b,
						p.commutative_key,
						p.outlier_flag ? 'TRUE' : 'FALSE',
						p.close_reason || ''
					]);
					await appendValues(spreadsheetId, `${PROBLEMS_SHEET}!A1`, rows, false);
				}
				// remove from remaining
				remaining = remaining.filter(r => r.id !== item.id);
				changed = true;
			} catch (e) {
				// stop on first failure to avoid rate-limit snowball; keep remaining
				break;
			}
		}
		if (changed) {
			await new Promise(resolve => chrome.storage.local.set({ [QUEUE_KEY]: remaining }, () => resolve()));
		}
		return remaining.length === 0;
	} finally {
		processing = false;
	}
}

// Alarms and startup triggers
chrome.runtime.onInstalled.addListener(() => {
	try { chrome.alarms.create('sheets-sync', { periodInMinutes: 5 }); } catch (e) {}
});

chrome.runtime.onStartup.addListener(() => {
	processQueue(false).catch(()=>{});
});

chrome.alarms.onAlarm.addListener((alarm) => {
	if (alarm && alarm.name === 'sheets-sync') {
		processQueue(false).catch(()=>{});
	}
});

