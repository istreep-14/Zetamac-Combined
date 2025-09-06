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

function getManifestClientId() {
	try {
		const mf = chrome.runtime.getManifest();
		return (mf && mf.oauth2 && mf.oauth2.client_id) || '';
	} catch (e) {
		return '';
	}
}

function updateAuthUi(state) {
	const warnEl = document.getElementById('authWarning');
	const authBtn = document.getElementById('authorize');
	const syncBtn = document.getElementById('syncNow');
	const clientConfigured = !!(state && state.clientConfigured);
	const authorized = !!(state && state.authorized);

	if (!clientConfigured) {
 		if (warnEl) {
 			warnEl.textContent = 'Google OAuth client ID not configured. Update manifest and reload the extension.';
 			warnEl.style.display = 'block';
 		}
 		if (authBtn) authBtn.style.display = 'none';
 		if (syncBtn) syncBtn.disabled = true;
 		return;
 	}

 	if (!authorized) {
 		if (warnEl) {
 			warnEl.textContent = 'Authorization required to sync to Google Sheets.';
 			warnEl.style.display = 'block';
 		}
 		if (authBtn) authBtn.style.display = 'inline-block';
 		if (syncBtn) syncBtn.disabled = false;
 	} else {
 		if (warnEl) warnEl.style.display = 'none';
 		if (authBtn) authBtn.style.display = 'none';
 		if (syncBtn) syncBtn.disabled = false;
 	}
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

	// Auth UI handling
	const authBtn = document.getElementById('authorize');
	const clientId = getManifestClientId();
	const clientConfigured = !!clientId && !clientId.includes('YOUR_CLIENT_ID');

	function refreshAuthUi() {
		chrome.runtime.sendMessage({ type: 'CHECK_AUTH' }, (res) => {
			const authorized = !!(res && res.ok);
			updateAuthUi({ authorized, clientConfigured });
		});
	}

	refreshAuthUi();

	if (authBtn) {
		authBtn.addEventListener('click', () => {
			authBtn.disabled = true;
			authBtn.textContent = 'Authorizing…';
			chrome.runtime.sendMessage({ type: 'AUTHORIZE' }, (res) => {
				authBtn.disabled = false;
				authBtn.textContent = 'Authorize';
				const authorized = !!(res && res.ok);
				updateAuthUi({ authorized, clientConfigured });
			});
		});
	}
});

