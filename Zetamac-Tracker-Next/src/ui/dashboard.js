async function getData() {
	return new Promise(resolve => {
		chrome.storage.local.get({ aggregates_v1: { operators: {}, last_updated_utc: null }, recent_sessions: [] }, (res) => resolve(res));
	});
}

function renderOverviewKpis(container, sessions) {
	if (!sessions.length) { container.textContent = 'No sessions yet.'; return; }
	const last = sessions[0];
	const best = Math.max(...sessions.map(s => s.score_final));
	const pace2min = (last.score_final * 120 / (last.duration_s || 120)).toFixed(1);
	container.innerHTML = `
		<div>Last Score: <b>${last.score_final}</b></div>
		<div>Best Score: <b>${best}</b></div>
		<div>2-Min Pace (last): <b>${pace2min}</b></div>
	`;
}

function renderScoreTimeline(canvas, sessions) {
	if (!sessions.length) return;
	// Simple canvas render of latest session cumulative score timeline
	const s = sessions[0];
	const csv = (s.score_timeline_10s || '').split(',').map(x => parseInt(x || '0', 10));
	const ctx = canvas.getContext('2d');
	const w = canvas.width = canvas.clientWidth;
	const h = canvas.height = canvas.clientHeight;
	ctx.clearRect(0,0,w,h);
	ctx.strokeStyle = '#2563eb';
	ctx.lineWidth = 2;
	ctx.beginPath();
	const maxY = Math.max(1, ...csv);
	for (let i = 0; i < csv.length; i++) {
		const x = (i / (csv.length - 1)) * (w - 20) + 10;
		const y = h - 10 - (csv[i] / maxY) * (h - 20);
		if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
	}
	ctx.stroke();
}

function renderOperatorTable(container, aggregates) {
	const ops = aggregates.operators || {};
	const entries = Object.entries(ops).slice(0, 12);
	if (!entries.length) { container.textContent = 'No operator aggregates yet.'; return; }
	let html = '<table style="width:100%; border-collapse:collapse; font-size:12px;">';
	html += '<tr><th style="text-align:left; padding:4px;">Mode|Dur|Op</th><th style="text-align:right; padding:4px;">Count</th><th style="text-align:right; padding:4px;">Avg (ms)</th></tr>';
	for (const [k, v] of entries) {
		const avg = v.count ? Math.round(v.sum_ms / v.count) : 0;
		html += `<tr><td style="padding:4px; border-top:1px solid #eee;">${k}</td><td style="padding:4px; text-align:right; border-top:1px solid #eee;">${v.count}</td><td style="padding:4px; text-align:right; border-top:1px solid #eee;">${avg}</td></tr>`;
	}
	html += '</table>';
	container.innerHTML = html;
}

document.addEventListener('DOMContentLoaded', async () => {
	const { aggregates_v1, recent_sessions } = await getData();
	renderOverviewKpis(document.getElementById('overviewKpis'), recent_sessions);
	renderScoreTimeline(document.getElementById('scoreTimeline'), recent_sessions);
	renderOperatorTable(document.getElementById('operatorTable'), aggregates_v1 || {});
});

