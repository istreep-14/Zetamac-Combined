function getAggregates() {
	return new Promise(resolve => {
		chrome.storage.local.get({ aggregates_v1: { operators: {}, last_updated_utc: null }, recent_sessions: [] }, (res) => {
			resolve(res);
		});
	});
}

function computeQuickStats(data) {
	const sessions = data.recent_sessions || [];
	const recent = sessions[0];
	const scores = sessions.map(s => s.score_final);
	const best = scores.length ? Math.max(...scores) : 0;
	const todayKey = new Date().toISOString().slice(0,10);
	const todays = sessions.filter(s => (s.timestamp_end_utc || '').slice(0,10) === todayKey).map(s => s.score_final);
	const todaysBest = todays.length ? Math.max(...todays) : 0;
	return {
		recentScore: recent ? recent.score_final : 0,
		sessionCount: sessions.length,
		bestScore: best,
		todaysBest
	};
}

document.addEventListener('DOMContentLoaded', async () => {
	const data = await getAggregates();
	const qs = computeQuickStats(data);
	document.getElementById('recentScore').textContent = String(qs.recentScore || '-');
	document.getElementById('sessionCount').textContent = String(qs.sessionCount || '0');
	document.getElementById('bestScore').textContent = String(qs.bestScore || '-');
	document.getElementById('todaysBest').textContent = String(qs.todaysBest || '-');
	const last = (data.aggregates_v1 && data.aggregates_v1.last_updated_utc) || '-';
	document.getElementById('syncLine').textContent = `Last Sync: ${last}`;

	document.getElementById('openDashboard').addEventListener('click', () => {
		chrome.tabs.create({ url: chrome.runtime.getURL('src/ui/dashboard.html') });
	});
	
	document.getElementById('openZetamac').addEventListener('click', () => {
		chrome.tabs.create({ url: 'https://arithmetic.zetamac.com' });
	});

	const syncBtn = document.getElementById('syncNow');
	if (syncBtn) {
		syncBtn.addEventListener('click', () => {
			syncBtn.disabled = true;
			syncBtn.textContent = 'Syncing…';
			chrome.runtime.sendMessage({ type: 'MANUAL_SYNC' }, (res) => {
				syncBtn.disabled = false;
				syncBtn.textContent = 'Sync';
				if (res && res.ok) {
					const now = new Date().toISOString();
					document.getElementById('syncLine').textContent = `Last Sync: ${now}`;
				} else {
					alert('Sync failed. Try again after authorizing in the browser.');
				}
			});
		});
	}
});

