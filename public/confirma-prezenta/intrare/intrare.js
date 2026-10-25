(() => {
	const cfg = window.RSVP_CONFIG;
	const endpoint = cfg.checkinEndpoint || '';
	const PIN_KEY = 'giftme-staff-pin';
	const CODE_PATTERN = /^[0-9a-f]{32}$/;
	const REQUEST_TIMEOUT_MS = 12000;

	const MESSAGES = {
		notConfigured: 'Verificarea biletelor nu este încă activă.',
		network: 'Nu am putut verifica biletul. Verifică internetul și încearcă din nou.',
		timeout: 'Serverul răspunde greu. Încearcă din nou peste câteva secunde.',
		rateLimited: 'Prea multe verificări într-un minut. Încearcă din nou imediat.',
		locked: 'Prea multe PIN-uri greșite. Așteaptă 10 minute.',
		pinNotSet: 'PIN-ul echipei nu e setat în script (STAFF_PIN).',
		server: 'Ceva nu a mers bine la noi. Încearcă din nou.',
	};

	const $ = (selector, scope = document) => scope.querySelector(selector);
	const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];

	const storage = {
		get(key) {
			try { return localStorage.getItem(key); } catch { return null; }
		},
		set(key, value) {
			try { localStorage.setItem(key, value); } catch { /* mod privat: PIN-ul se cere la fiecare scanare */ }
		},
		remove(key) {
			try { localStorage.removeItem(key); } catch { /* nimic de șters */ }
		},
	};

	$$('[data-event]').forEach((el) => {
		const value = cfg.event[el.dataset.event];
		if (value) el.textContent = value;
	});

	function show(name) {
		$$('[data-view]').forEach((view) => { view.hidden = view.dataset.view !== name; });
		$('#staff-exit').hidden = !storage.get(PIN_KEY);
	}

	function showError(message) {
		$('#error-text').textContent = message;
		show('error');
	}

	function currentCode() {
		return decodeURIComponent(location.hash.slice(1)).trim().toLowerCase();
	}

	async function call(payload) {
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
		try {
			// text/plain evită preflight-ul CORS, pe care Apps Script nu îl suportă.
			const response = await fetch(endpoint, {
				method: 'POST',
				headers: { 'Content-Type': 'text/plain;charset=utf-8' },
				body: JSON.stringify(payload),
				signal: controller.signal,
				redirect: 'follow',
			});
			if (!response.ok) return { ok: false, error: 'server' };
			return await response.json();
		} catch (error) {
			return { ok: false, error: error.name === 'AbortError' ? 'timeout' : 'network' };
		} finally {
			clearTimeout(timer);
		}
	}

	function errorMessage(error) {
		return {
			network: MESSAGES.network,
			timeout: MESSAGES.timeout,
			rate_limited: MESSAGES.rateLimited,
			locked: MESSAGES.locked,
			pin_not_set: MESSAGES.pinNotSet,
		}[error] || MESSAGES.server;
	}

	/* ---------- Codul QR al biletului, desenat local ---------- */

	function renderQr(code) {
		const host = $('#qr');
		host.textContent = '';
		if (!window.GiftMeQR) return;
		const qr = window.GiftMeQR.matrix(`${location.origin}${location.pathname}#${code}`);
		const quiet = 4;
		const size = qr.size + quiet * 2;
		let path = '';
		for (let y = 0; y < qr.size; y++) {
			for (let x = 0; x < qr.size; x++) {
				if (qr.dark(x, y)) path += `M${x + quiet} ${y + quiet}h1v1h-1z`;
			}
		}
		const ns = 'http://www.w3.org/2000/svg';
		const svg = document.createElementNS(ns, 'svg');
		svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
		svg.setAttribute('shape-rendering', 'crispEdges');
		svg.setAttribute('aria-hidden', 'true');
		const bg = document.createElementNS(ns, 'rect');
		bg.setAttribute('width', size);
		bg.setAttribute('height', size);
		bg.setAttribute('fill', '#FFFFFF');
		const dots = document.createElementNS(ns, 'path');
		dots.setAttribute('d', path);
		dots.setAttribute('fill', '#111111');
		svg.append(bg, dots);
		host.append(svg);
	}

	/* ---------- Verificare (invitat) sau marcare (echipă) ---------- */

	let running = 0;

	async function run() {
		const code = currentCode();
		const pin = storage.get(PIN_KEY);
		const ticket = ++running;
		if (!code) return show('nocode');
		if (!CODE_PATTERN.test(code)) return show('unknown');
		if (!endpoint) return showError(MESSAGES.notConfigured);

		show('loading');
		const result = await call(pin ? { action: 'checkin', code, pin } : { action: 'verify', code });
		if (ticket !== running) return; // între timp s-a scanat alt bilet

		if (!result || !result.ok) {
			if (result && result.error === 'wrong_pin') {
				storage.remove(PIN_KEY);
				return showPin('PIN greșit. Încearcă din nou.');
			}
			return showError(errorMessage(result && result.error));
		}

		if (result.status === 'unknown') return show('unknown');
		if (result.status === 'valid') {
			renderQr(code);
			return show('valid');
		}
		if (result.status === 'checked_in') {
			$('#in-name').textContent = result.name;
			$('#in-when').textContent = `Marcat(ă) prezent(ă) la ${result.at}`;
			const note = $('#in-note');
			note.hidden = result.answer !== 'Nu';
			note.textContent = 'Atenție: în listă, invitatul a răspuns „Nu”. L-am marcat totuși prezent.';
			if (navigator.vibrate) navigator.vibrate(80);
			return show('in');
		}
		if (result.status === 'already') {
			$('#already-name').textContent = result.name;
			$('#already-when').textContent = result.at ? `A intrat deja, la ${result.at}` : 'A fost deja marcat(ă) prezent(ă)';
			if (navigator.vibrate) navigator.vibrate([60, 60, 60]);
			return show('already');
		}
		showError(MESSAGES.server);
	}

	function showPin(message) {
		const error = $('#pin-error');
		error.textContent = message || '';
		error.hidden = !message;
		show('pin');
		$('#pin').value = '';
		$('#pin').focus();
	}

	$('#pin-form').addEventListener('submit', (event) => {
		event.preventDefault();
		const pin = $('#pin').value.trim();
		if (pin.length < 6) {
			showPin('PIN-ul are cel puțin 6 caractere.');
			return;
		}
		storage.set(PIN_KEY, pin);
		run();
	});

	document.addEventListener('click', (event) => {
		const action = event.target.closest('[data-action]')?.dataset.action;
		if (action === 'pin') showPin();
		if (action === 'cancel-pin' || action === 'retry') run();
	});

	$('#staff-exit').addEventListener('click', () => {
		storage.remove(PIN_KEY);
		run();
	});

	window.addEventListener('hashchange', run);
	run();
})();
