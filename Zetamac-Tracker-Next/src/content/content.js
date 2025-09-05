// Content script: capture FSM for Zetamac
// Signals: problem text change starts timer; score increment finalizes; final-flush at timer=0.

(function() {
	let sessionActive = false;
	let sessionId = null;
	let durationSeconds = null;
	let startTimeMs = null;
	let lastScore = 0;
	let currentProblem = null; // { text, operator, a, b, startMs, index }
	let problemIndex = 0;
	let problems = []; // recent session problems (raw); pruned later by background
	let cumulativeBuckets = []; // 10s buckets
	const BUCKET_SIZE_S = 10;

	function parseOperatorAndOperands(text) {
		// Expect formats like "71 + 46", "7 × 8", "480 ÷ 5", with spaces.
		const m = text.match(/^(\d+)\s*([+\-×xX*÷\/])\s*(\d+)$/);
		if (!m) return null;
		let op = m[2];
		if (op === '×' || op === 'x' || op === 'X' || op === '*') op = '*';
		if (op === '÷' || op === '/') op = '/';
		if (op === '–' || op === '−') op = '-';
		const a = parseInt(m[1], 10);
		const b = parseInt(m[3], 10);
		return { operator: op, a, b };
	}

	function getTimerSeconds() {
		const el = document.querySelector('#game .left, span.left, #game span:first-child');
		if (!el) return null;
		const t = el.textContent || '';
		const mm = t.match(/Seconds left:\s*(\d+)/i);
		if (mm) return parseInt(mm[1], 10);
		return null;
	}

	function getScore() {
		// Zetamac often shows score in elements like span.correct or text like "Score: N"
		// Prefer explicit "Score:" text scan for robustness.
		let found = 0;
		const nodes = document.querySelectorAll('#game * , body *');
		for (const n of nodes) {
			const txt = (n.textContent || '').trim();
			if (!txt) continue;
			const m = txt.match(/Score:\s*(\d+)/);
			if (m) {
				const v = parseInt(m[1], 10);
				if (v > found) found = v;
			}
		}
		return found;
	}

	function getProblemText() {
		const nodes = document.querySelectorAll('span.problem, #game .problem, #game');
		for (const n of nodes) {
			const txt = (n.textContent || '').trim();
			if (!txt) continue;
			const m = txt.match(/(\d+\s*[+\-×xX*÷\/]\s*\d+)/);
			if (m) return m[1].replace(/\s+/g, ' ');
		}
		return null;
	}

	function ensureBuckets() {
		if (!durationSeconds) return;
		const count = Math.ceil(durationSeconds / BUCKET_SIZE_S);
		if (cumulativeBuckets.length !== count) {
			cumulativeBuckets = new Array(count).fill(0);
		}
	}

	function bumpBucket(scoreValue) {
		if (!startTimeMs || !durationSeconds) return;
		const elapsedS = Math.floor((performance.now() - startTimeMs) / 1000);
		let idx = Math.floor(elapsedS / BUCKET_SIZE_S);
		if (idx < 0) idx = 0;
		if (idx >= cumulativeBuckets.length) idx = cumulativeBuckets.length - 1;
		cumulativeBuckets[idx] = Math.max(cumulativeBuckets[idx], scoreValue);
	}

	function finalizeCurrentProblem(reason) {
		if (!currentProblem) return null;
		const endMs = performance.now();
		const latency = Math.max(0, Math.round(endMs - currentProblem.startMs));
		const outlier = latency < 50 || latency > 10000; // mark only
		const rec = {
			 session_id: sessionId,
			 problem_index: currentProblem.index,
			 timestamp_start: new Date(startTimeMs + (currentProblem.startMs - startTimeMs)).toISOString(),
			 timestamp_end: new Date().toISOString(),
			 latency_ms: latency,
			 problem_text: currentProblem.text,
			 operator: currentProblem.operator,
			 operand_a: currentProblem.a,
			 operand_b: currentProblem.b,
			 commutative_key: (currentProblem.operator === '+' || currentProblem.operator === '*')
				? `${currentProblem.operator}:${[currentProblem.a, currentProblem.b].sort((x,y)=>x-y).join('|')}`
				: `${currentProblem.operator}:${currentProblem.a}|${currentProblem.b}`,
			 outlier_flag: outlier,
			 close_reason: reason || 'unknown'
		};
		problems.push(rec);
		currentProblem = null;
		return rec;
	}

	function startNewProblem(text) {
		const parsed = parseOperatorAndOperands(text);
		if (!parsed) return false;
		problemIndex += 1;
		currentProblem = {
			 text,
			 operator: parsed.operator,
			 a: parsed.a,
			 b: parsed.b,
			 startMs: performance.now(),
			 index: problemIndex
		};
		return true;
	}

	function maybeStartSession() {
		if (sessionActive) return;
		const t = getTimerSeconds();
		const p = getProblemText();
		if (p && t !== null) {
			sessionActive = true;
			sessionId = `${new Date().toISOString()}_${Math.random().toString(36).slice(2,8)}`;
			startTimeMs = performance.now();
			lastScore = getScore();
			durationSeconds = t > 0 ? (t > 90 ? 120 : t > 60 ? 90 : t > 30 ? 60 : 30) : 120; // best guess; will refine at end
			ensureBuckets();
			problemIndex = 0;
			problems = [];
			startNewProblem(p);
		}
	}

	function maybeEndSessionIfTimerZero() {
		const t = getTimerSeconds();
		if (t === 0 && sessionActive) {
			// final flush if problem still open
			finalizeCurrentProblem('timer_zero');
			// package session and send to background
			const score = getScore();
			const bucketCsv = cumulativeBuckets.map(v=>v).join(',');
			const payload = {
				type: 'SESSION_COMPLETE',
				data: {
					 session_id: sessionId,
					 key: (new URL(location.href)).searchParams.get('key') || '',
					 duration_s: durationSeconds,
					 score_final: score,
					 problems_captured: problems.length,
					 bucket_size_s: BUCKET_SIZE_S,
					 score_timeline_10s: bucketCsv,
					 problems
				}
			};
			chrome.runtime.sendMessage(payload);
			// reset
			sessionActive = false;
			sessionId = null;
			currentProblem = null;
		}
	}

	// Observe DOM changes for problem text and score increments.
	const observer = new MutationObserver(() => {
		maybeStartSession();
		if (!sessionActive) return;

		// Score change handling
		const scoreNow = getScore();
		if (scoreNow > lastScore) {
			// close current problem immediately on score+1 (ultra-fast safe)
			finalizeCurrentProblem('score_increment');
			bumpBucket(scoreNow);
			lastScore = scoreNow;
		}

		// Problem change handling
		const pt = getProblemText();
		if (pt) {
			if (!currentProblem) {
				startNewProblem(pt);
			} else if (pt !== currentProblem.text) {
				// if problem text changed but score did not, we still finalize the previous one (rare)
				finalizeCurrentProblem('problem_change');
				startNewProblem(pt);
			}
		}

		maybeEndSessionIfTimerZero();
	});

	observer.observe(document.documentElement || document.body, {
		childList: true,
		subtree: true,
		characterData: true,
		attributes: true
	});

	// Light poll as a safety net
	setInterval(() => {
		maybeStartSession();
		if (!sessionActive) return;
		const scoreNow = getScore();
		if (scoreNow > lastScore) {
			finalizeCurrentProblem('score_increment_poll');
			bumpBucket(scoreNow);
			lastScore = scoreNow;
		}
		maybeEndSessionIfTimerZero();
	}, 200);
})();

