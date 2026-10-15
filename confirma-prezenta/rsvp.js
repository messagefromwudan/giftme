(() => {
	const cfg = window.RSVP_CONFIG;
	const root = document.documentElement;
	const STORAGE_KEY = 'giftme-rsvp-v1';
	const CLIENT_KEY = 'giftme-cid';
	const REQUEST_TIMEOUT_MS = 15000;
	const NAME_PATTERN = /^\p{L}[\p{L}\p{M}\s.'’-]*$/u;
	const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
	const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	const isLocalPreview = /^(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)$/.test(location.hostname);
	const endpoint = cfg.endpoint || (isLocalPreview ? cfg.devEndpoint : '');

	const MESSAGES = {
		sending: 'Se trimite…',
		notConfigured: 'Formularul nu este încă activ. Te rugăm să revii puțin mai târziu sau să ne scrii pe Instagram, @giftme.md.',
		network: 'Nu am reușit să trimitem răspunsul. Verifică conexiunea la internet și încearcă din nou.',
		timeout: 'Serverul răspunde greu. Încearcă din nou peste câteva secunde.',
		rateLimited: 'Ai trimis mai multe răspunsuri într-un timp scurt. Încearcă din nou peste câteva minute.',
		validation: 'Unele câmpuri nu sunt completate corect. Verifică-le mai jos.',
		server: 'Ceva nu a mers bine la noi. Încearcă din nou peste un minut.',
	};

	const $ = (selector, scope = document) => scope.querySelector(selector);
	const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];

	const storage = {
		get(key) {
			try { return localStorage.getItem(key); } catch { return null; }
		},
		set(key, value) {
			try { localStorage.setItem(key, value); } catch { /* mod privat: ignorăm */ }
		},
	};

	/* ---------- Detaliile evenimentului din config ---------- */

	$$('[data-event]').forEach((el) => {
		const value = cfg.event[el.dataset.event];
		if (value) el.textContent = value;
	});
	$$('[data-event-href]').forEach((el) => {
		const value = cfg.event[el.dataset.eventHref];
		if (value) el.href = value;
	});

	const gcal = new URL('https://calendar.google.com/calendar/render');
	gcal.search = new URLSearchParams({
		action: 'TEMPLATE',
		text: cfg.event.title,
		dates: `${cfg.event.startUtc}/${cfg.event.endUtc}`,
		location: `${cfg.event.place}, ${cfg.event.address}`,
		details: 'Te așteptăm cu surprize și voie bună! https://giftme.site',
	}).toString();
	$('#gcal-link').href = gcal.toString();

	/* ---------- Câmpurile formularului, generate din config ---------- */

	const fieldsHost = $('#fields');
	const form = $('#rsvp-form');
	const submitBtn = $('#submit');
	const statusBox = $('#form-status');
	const formRenderedAt = Date.now();

	const el = (tag, attrs = {}, children = []) => {
		const node = document.createElement(tag);
		Object.entries(attrs).forEach(([key, value]) => {
			if (value === false || value == null) return;
			if (key === 'text') node.textContent = value;
			else if (key === 'class') node.className = value;
			else node.setAttribute(key, value === true ? '' : value);
		});
		children.forEach((child) => node.append(child));
		return node;
	};

	const requiredMark = () => el('span', { class: 'field__req', 'aria-hidden': 'true', text: ' *' });

	function renderField(field) {
		const id = `f-${field.name}`;
		const errorId = `${id}-err`;
		const wrapper = el('div', { class: 'field', 'data-field': field.name });
		const error = el('p', { class: 'field__error', id: errorId, hidden: true });

		if (field.type === 'choice') {
			const choices = el('div', { class: 'choices' }, field.options.map((option) => el('label', { class: 'choice' }, [
				el('input', { type: 'radio', name: field.name, value: option.value, required: field.required }),
				el('span', { class: 'choice__face' }, [
					el('span', { class: 'choice__icon', 'aria-hidden': 'true', text: option.icon || '' }),
					el('span', { class: 'choice__title', text: option.title }),
					option.hint ? el('span', { class: 'choice__hint', text: option.hint }) : '',
				]),
			])));
			const legend = el('legend', { text: field.label });
			if (field.required) legend.append(requiredMark());
			wrapper.append(el('fieldset', { 'aria-describedby': errorId }, [legend, choices]), error);
		} else {
			const hintId = field.hint ? `${id}-hint` : null;
			const label = el('label', { class: 'field__label', for: id, text: field.label });
			if (field.required) label.append(requiredMark());
			const isEmail = field.inputType === 'email';
			const input = el(field.type === 'textarea' ? 'textarea' : 'input', {
				class: 'input',
				id,
				name: field.name,
				type: field.type === 'textarea' ? null : (field.inputType || 'text'),
				required: field.required,
				autocomplete: field.autocomplete || 'off',
				maxlength: field.maxLength,
				placeholder: field.placeholder,
				inputmode: field.inputMode,
				autocapitalize: isEmail ? 'off' : null,
				spellcheck: isEmail ? 'false' : null,
				'aria-describedby': [hintId, errorId].filter(Boolean).join(' '),
				enterkeyhint: 'next',
			});
			wrapper.append(label, input);
			if (hintId) wrapper.append(el('p', { class: 'field__hint', id: hintId, text: field.hint }));
			wrapper.append(error);
		}
		return wrapper;
	}

	cfg.fields.forEach((field) => fieldsHost.append(renderField(field)));

	/* ---------- Validare ---------- */

	const cleanText = (value) => value.replace(/\s+/g, ' ').trim();

	function readValues() {
		const data = new FormData(form);
		const values = {};
		cfg.fields.forEach((field) => {
			const raw = data.get(field.name);
			values[field.name] = typeof raw === 'string' ? cleanText(raw) : '';
		});
		return values;
	}

	function validateField(field, value) {
		if (!value) return field.required ? field.errors.required : '';
		if (field.type === 'choice') {
			return field.options.some((option) => option.value === value) ? '' : field.errors.required;
		}
		const tooShort = field.minLength && value.length < field.minLength;
		const tooLong = field.maxLength && value.length > field.maxLength;
		const badChars = field.name === 'nume' && !NAME_PATTERN.test(value);
		const badEmail = field.inputType === 'email' && !EMAIL_PATTERN.test(value);
		return tooShort || tooLong || badChars || badEmail ? field.errors.invalid : '';
	}

	function setFieldError(name, message) {
		const wrapper = $(`[data-field="${name}"]`, fieldsHost);
		if (!wrapper) return;
		const error = $('.field__error', wrapper);
		const control = $('input, textarea, fieldset', wrapper);
		wrapper.classList.toggle('is-invalid', Boolean(message));
		error.textContent = message || '';
		error.hidden = !message;
		if (control.matches('fieldset')) {
			$$('input', control).forEach((input) => input.toggleAttribute('aria-invalid', Boolean(message)));
		} else if (message) {
			control.setAttribute('aria-invalid', 'true');
		} else {
			control.removeAttribute('aria-invalid');
		}
	}

	function validateAll(values) {
		let firstInvalid = null;
		cfg.fields.forEach((field) => {
			const message = validateField(field, values[field.name]);
			setFieldError(field.name, message);
			if (message && !firstInvalid) firstInvalid = field.name;
		});
		return firstInvalid;
	}

	function focusField(name) {
		const wrapper = $(`[data-field="${name}"]`, fieldsHost);
		const target = $('input:checked', wrapper) || $('input, textarea', wrapper);
		target?.focus();
	}

	let attemptedSubmit = false;

	form.addEventListener('input', (event) => {
		const field = cfg.fields.find((f) => f.name === event.target.name);
		if (!field) return;
		if (attemptedSubmit || field.type === 'choice') {
			setFieldError(field.name, validateField(field, readValues()[field.name]));
		}
		hideStatus();
	});

	form.addEventListener('focusout', (event) => {
		const field = cfg.fields.find((f) => f.name === event.target.name && f.type !== 'choice');
		if (!field || !event.target.value) return;
		setFieldError(field.name, validateField(field, readValues()[field.name]));
	});

	/* ---------- Trimitere ---------- */

	function showStatus(message) {
		statusBox.textContent = message;
		statusBox.hidden = false;
	}

	function hideStatus() {
		statusBox.hidden = true;
		statusBox.textContent = '';
	}

	function setPending(pending) {
		submitBtn.setAttribute('aria-busy', String(pending));
		submitBtn.setAttribute('aria-disabled', String(pending));
		$('.btn__label', submitBtn).textContent = pending ? MESSAGES.sending : 'Trimite confirmarea';
	}

	function clientId() {
		let id = storage.get(CLIENT_KEY);
		if (!id) {
			id = (crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`);
			storage.set(CLIENT_KEY, id);
		}
		return id;
	}

	async function send(payload) {
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
			if (!response.ok) return { ok: false, error: response.status === 429 ? 'rate_limited' : 'server' };
			return await response.json();
		} catch (error) {
			return { ok: false, error: error.name === 'AbortError' ? 'timeout' : 'network' };
		} finally {
			clearTimeout(timer);
		}
	}

	let pending = false;

	form.addEventListener('submit', async (event) => {
		event.preventDefault();
		if (pending) return;

		attemptedSubmit = true;
		hideStatus();
		const values = readValues();
		const firstInvalid = validateAll(values);
		if (firstInvalid) {
			focusField(firstInvalid);
			return;
		}

		// Robot care a completat capcana: îi arătăm „succes” fără să trimitem nimic.
		if ($('#website').value) {
			showResult(values, { celebrate: false });
			return;
		}

		if (!endpoint) {
			showStatus(MESSAGES.notConfigured);
			return;
		}

		pending = true;
		setPending(true);
		const result = await send({
			...values,
			website: '',
			t: Date.now() - formRenderedAt,
			cid: clientId(),
		});
		pending = false;
		setPending(false);

		if (result && result.ok) {
			const saved = { ...values, nr: result.nr || null, emailSent: Boolean(result.emailSent) };
			storage.set(STORAGE_KEY, JSON.stringify(saved));
			showResult(saved, { celebrate: true });
			return;
		}

		const errorKey = result?.error || 'server';
		if (errorKey === 'validation' && result.fields) {
			Object.entries(result.fields).forEach(([name, message]) => setFieldError(name, message));
			focusField(Object.keys(result.fields)[0]);
		}
		showStatus({
			rate_limited: MESSAGES.rateLimited,
			validation: MESSAGES.validation,
			network: MESSAGES.network,
			timeout: MESSAGES.timeout,
		}[errorKey] || MESSAGES.server);
	});

	/* ---------- Rezultat: bilet sau mulțumire ---------- */

	const views = { form: $('#view-form'), yes: $('#view-yes'), no: $('#view-no') };

	function showView(name) {
		Object.entries(views).forEach(([key, view]) => { view.hidden = key !== name; });
		// După răspuns rămâne doar cardul (biletul sau mulțumirea), fără invitație deasupra.
		document.getElementById('pagina').classList.toggle('is-answered', name !== 'form');
	}

	function showResult(values, { celebrate, focus = true } = {}) {
		const coming = values.prezenta === 'Da';
		if (coming) {
			$('#ticket-name').textContent = values.nume;
			$('#ticket-nr').textContent = values.nr ? `Nr. ${String(values.nr).padStart(3, '0')}` : '';
		}
		$$('[data-mail-note]').forEach((note) => {
			note.hidden = !values.emailSent;
			$('[data-mail-to]', note).textContent = values.email || '';
		});
		showView(coming ? 'yes' : 'no');
		const view = coming ? views.yes : views.no;
		if (focus) {
			view.focus({ preventScroll: true });
			window.scrollTo({ top: 0, behavior: reducedMotion ? 'auto' : 'smooth' });
		}
		if (coming && celebrate && !reducedMotion) launchConfetti();
	}

	$$('[data-action="change"]').forEach((button) => button.addEventListener('click', () => {
		const saved = JSON.parse(storage.get(STORAGE_KEY) || 'null');
		if (saved) {
			cfg.fields.forEach((field) => {
				const value = saved[field.name];
				if (value == null) return;
				const control = field.type === 'choice'
					? $(`input[name="${field.name}"][value="${CSS.escape(value)}"]`, form)
					: form.elements[field.name];
				if (!control) return;
				if (field.type === 'choice') control.checked = true;
				else control.value = value;
			});
		}
		showView('form');
		focusField(cfg.fields[0].name);
	}));

	/* ---------- Confetti (canvas, fără bibliotecă) ---------- */

	// Fără origin: două „tunuri” din lateral. Cu origin: explozie în sus din acel punct.
	function launchConfetti(origin) {
		const canvas = $('#confetti');
		const ctx = canvas.getContext('2d');
		const dpr = Math.min(window.devicePixelRatio || 1, 2);
		const width = window.innerWidth;
		const height = window.innerHeight;
		canvas.width = width * dpr;
		canvas.height = height * dpr;
		ctx.scale(dpr, dpr);

		const colors = ['#F90100', '#F90100', '#111111', '#FF8A80', '#F9D6D4'];
		const pieces = Array.from({ length: Math.min(180, Math.round(width / 3)) }, (_, i) => {
			const fromLeft = i % 2 === 0;
			const start = origin
				? { x: origin.x, y: origin.y, vx: (Math.random() - 0.5) * 18, vy: -(7 + Math.random() * 13) }
				: {
					x: fromLeft ? -10 : width + 10,
					y: height * (0.55 + Math.random() * 0.25),
					vx: (fromLeft ? 1 : -1) * (4 + Math.random() * 7),
					vy: -(9 + Math.random() * 9),
				};
			return {
				...start,
				size: 6 + Math.random() * 7,
				rotation: Math.random() * Math.PI,
				spin: (Math.random() - 0.5) * 0.3,
				color: colors[i % colors.length],
				shape: i % 7 === 0 ? 'heart' : (i % 3 === 0 ? 'circle' : 'rect'),
			};
		});

		const drawHeart = (size) => {
			const s = size / 2;
			ctx.beginPath();
			ctx.moveTo(0, s * 0.7);
			ctx.bezierCurveTo(-s * 1.4, -s * 0.2, -s * 0.6, -s * 1.2, 0, -s * 0.45);
			ctx.bezierCurveTo(s * 0.6, -s * 1.2, s * 1.4, -s * 0.2, 0, s * 0.7);
			ctx.fill();
		};

		const start = performance.now();
		const duration = 3200;

		function frame(now) {
			const elapsed = now - start;
			ctx.clearRect(0, 0, width, height);
			ctx.globalAlpha = Math.max(0, 1 - Math.max(0, elapsed - duration + 800) / 800);
			pieces.forEach((p) => {
				p.vy += 0.32;
				p.vx *= 0.985;
				p.x += p.vx;
				p.y += p.vy;
				p.rotation += p.spin;
				ctx.save();
				ctx.translate(p.x, p.y);
				ctx.rotate(p.rotation);
				ctx.fillStyle = p.color;
				if (p.shape === 'heart') drawHeart(p.size * 1.4);
				else if (p.shape === 'circle') {
					ctx.beginPath();
					ctx.arc(0, 0, p.size / 2.4, 0, Math.PI * 2);
					ctx.fill();
				} else ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
				ctx.restore();
			});
			if (elapsed < duration) requestAnimationFrame(frame);
			else ctx.clearRect(0, 0, width, height);
		}
		requestAnimationFrame(frame);
	}

	/* ---------- Intro: cutia cadou ---------- */

	const intro = $('#intro');
	const page = $('#pagina');
	const giftbox = $('#giftbox');
	const bow = $('#giftbox-bow');
	let opened = false;

	function openBox() {
		if (opened) return;
		opened = true;
		intro.classList.add('is-opening');
		// Confetti din cutie exact când sare capacul
		setTimeout(() => {
			const box = giftbox.getBoundingClientRect();
			launchConfetti({ x: box.left + box.width / 2, y: box.top + box.height * 0.3 });
		}, 640);
		setTimeout(() => {
			root.classList.add('intro-out');
			intro.classList.add('is-gone');
			page.classList.add('is-revealed');
			$('#titlu').focus({ preventScroll: true });
		}, 1450);
		setTimeout(() => root.classList.remove('show-intro', 'intro-out'), 2000);
	}

	if (root.classList.contains('show-intro')) {

		let drag = null;
		let suppressClick = false;

		bow.addEventListener('pointerdown', (event) => {
			drag = { x: event.clientX, y: event.clientY, moved: 0 };
			bow.setPointerCapture(event.pointerId);
			giftbox.classList.add('is-dragging');
		});

		bow.addEventListener('pointermove', (event) => {
			if (!drag || opened) return;
			const dx = event.clientX - drag.x;
			const dy = event.clientY - drag.y;
			drag.moved = Math.hypot(dx, dy);
			const pull = Math.min(1, 90 / Math.max(drag.moved, 1));
			bow.style.transform = `translate(${dx * pull * 0.7}px, ${dy * pull * 0.7}px) rotate(${dx * 0.15}deg)`;
			bow.style.setProperty('--pull', Math.min(1, drag.moved / 80).toFixed(2));
			if (drag.moved > 80) {
				endDrag();
				openBox();
			}
		});

		const endDrag = () => {
			if (!drag) return;
			if (drag.moved > 6 && !opened) suppressClick = true;
			drag = null;
			giftbox.classList.remove('is-dragging');
			bow.style.transform = '';
			bow.style.removeProperty('--pull');
		};
		bow.addEventListener('pointerup', endDrag);
		bow.addEventListener('pointercancel', endDrag);

		giftbox.addEventListener('click', () => {
			if (suppressClick) {
				suppressClick = false;
				return;
			}
			openBox();
		});
	}

	/* ---------- Vizitator care a răspuns deja ---------- */

	const saved = JSON.parse(storage.get(STORAGE_KEY) || 'null');
	if (saved && saved.nume && saved.prezenta) showResult(saved, { celebrate: false, focus: false });
})();
