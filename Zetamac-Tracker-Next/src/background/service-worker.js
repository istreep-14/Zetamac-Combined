// Background service worker: receives session payloads, updates local aggregates, queues Sheets upload.

const QUEUE_KEY = 'sheets_upload_queue';
const AGG_KEY = 'aggregates_v1';
const RECENT_SESSIONS_KEY = 'recent_sessions';

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
	if (message && message.type === 'SESSION_COMPLETE' && message.data) {
		handleSessionComplete(message.data);
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

// TODO: implement periodic retry via alarms or on startup events

