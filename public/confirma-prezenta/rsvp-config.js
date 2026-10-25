// Configurația paginii de confirmare. Pentru o întrebare nouă, adaugă un obiect în FIELDS
// și același câmp în FIELDS din apps-script/v2/Cod.gs (validarea pe server).

// URL-urile aplicațiilor web Google Apps Script (vezi apps-script/v2/GHID.md). Gol = pagina
// afișează o eroare prietenoasă în loc să trimită. Scriptul v2 citește linia „live:” (sau „test:”)
// ca să știe dacă site-ul îl folosește: păstrează forma cheie: 'URL' pe un singur rând.
var RSVP_ENDPOINTS = {
	// giftme.site – formularul de confirmare
	live: 'https://script.google.com/macros/s/AKfycbwFSO9fIvZ7RBpFYwfwNNyw6QyKtbpmvksTyvqQkfTIW_qhx5zKcW45stqPTD5Bx1zU/exec',
	// giftme.site – verificarea biletelor la intrare (/confirma-prezenta/intrare/)
	liveCheckin: '',
	// previzualizările Vercel (branch-ul dev): copia de test, pentru formular și intrare
	test: '',
};
var RSVP_IS_LIVE = /(^|\.)giftme\.site$/.test(location.hostname);

window.RSVP_CONFIG = {
	endpoint: RSVP_IS_LIVE ? RSVP_ENDPOINTS.live : RSVP_ENDPOINTS.test,
	checkinEndpoint: RSVP_IS_LIVE ? RSVP_ENDPOINTS.liveCheckin : RSVP_ENDPOINTS.test,
	// Doar în previzualizarea locală (python3 dev-server.py), cât timp endpoint e gol:
	// răspunsurile merg în rsvp-test-local.csv, fără emailuri.
	devEndpoint: '/__rsvp-test',

	event: {
		title: 'Deschiderea GiftMe!',
		dateLabel: 'Luni, 2 noiembrie 2026',
		timeLabel: 'ora 09:30',
		place: 'CEEF, Cabinetul 223',
		address: 'str. Miron Costin 26/2, Chișinău',
		mapUrl: 'https://maps.google.com/?q=Miron+Costin+26%2F2,+Chi%C8%99in%C4%83u',
		// 09:30–11:30 ora Chișinăului (EET, UTC+2 în noiembrie)
		startUtc: '20261102T073000Z',
		endUtc: '20261102T093000Z',
	},

	fields: [
		{
			name: 'nume',
			type: 'text',
			label: 'Nume, prenume',
			required: true,
			autocomplete: 'name',
			minLength: 2,
			maxLength: 80,
			placeholder: 'ex. Ana Popescu',
			errors: {
				required: 'Scrie-ne, te rugăm, numele și prenumele.',
				invalid: 'Numele poate conține doar litere, spații, cratimă și apostrof (2–80 de caractere).',
			},
		},
		{
			name: 'email',
			type: 'text',
			inputType: 'email',
			inputMode: 'email',
			label: 'Email',
			hint: 'Aici îți trimitem biletul cu codul QR și reamintirile.',
			required: true,
			autocomplete: 'email',
			maxLength: 120,
			placeholder: 'ex. ana@gmail.com',
			errors: {
				required: 'Scrie-ne, te rugăm, adresa de email.',
				invalid: 'Adresa de email nu pare corectă. Verifică, te rugăm, dacă are forma nume@exemplu.com.',
			},
		},
		{
			name: 'prezenta',
			type: 'choice',
			label: 'Vei fi prezent(ă) la deschiderea GiftMe!?',
			required: true,
			options: [
				{ value: 'Da', title: 'Da, vin!', hint: 'Abia aștept', icon: '🎉' },
				{ value: 'Nu', title: 'Nu pot ajunge', hint: 'Data viitoare', icon: '💌' },
			],
			errors: {
				required: 'Alege „Da” sau „Nu”.',
			},
		},
	],
};
