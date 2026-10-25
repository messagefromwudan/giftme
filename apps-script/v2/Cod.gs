/**
 * GiftMe! – confirmări de prezență, versiunea 2 (vezi apps-script/v2/GHID.md).
 * Script legat de foaia Google (Extensii → Apps Script). Pe lângă ce făcea apps-script/rsvp.gs:
 *  - notificare către echipă la fiecare răspuns;
 *  - bilet cu cod QR (cod aleatoriu, generat local de QR.gs);
 *  - patru reamintiri, fiecare trimisă cel mult o dată, cu alertă către echipă la erori;
 *  - verificarea biletelor la intrare (marcarea cere PIN-ul echipei);
 *  - meniul „GiftMe” în foaie, cu „Trimite follow-up”.
 * Nu conține parole: PIN-ul și celelalte setări stau în Setări proiect → Proprietăți script.
 */

const SHEET_NAME = 'Confirmări';
const TZ = 'Europe/Chisinau';

// Coloanele 1–8 sunt cele din scriptul vechi și rămân pe loc: dacă revenim la el,
// scrie în aceeași foaie. Coloana 8 („Reamintire trimisă” în scriptul vechi) ține
// reamintirea de duminică, așa că declanșatorul vechi de la 10:00 nu o mai trimite a doua oară.
const HEADERS = [
  'Trimis la', 'Nume, prenume', 'Email', 'Prezent(ă)', 'Actualizat la', 'Nr. invitat', 'Confirmare trimisă', 'Reamintire 1 nov',
  'Cod bilet', 'Da din', 'Bilet QR trimis', 'Reamintire 29 oct', 'Reamintire 2 nov 07:30', 'Reamintire 2 nov 09:00',
  'Venit?', 'Venit la', 'Marcat prin', 'Follow-up trimis', 'Fără emailuri', 'Notificare echipă',
];
const COL = {
  sent: 1, nume: 2, email: 3, prezenta: 4, updated: 5, nr: 6, confirm: 7, r1nov: 8,
  code: 9, yesSince: 10, qrSent: 11, r29oct: 12, r0730: 13, r0900: 14,
  came: 15, cameAt: 16, cameVia: 17, followup: 18, optOut: 19, team: 20,
};

const SENDER_NAME = 'GiftMe!';
const REPLY_TO = 'fe.giftme@gmail.com';
const DEFAULT_TEAM_EMAIL = 'fe.giftme@gmail.com';
const DEFAULT_SITE = 'https://giftme.site';
const SITE = 'https://giftme.site'; // logo și fișierul .ics din emailuri

const EVENT = {
  title: 'Deschiderea GiftMe!',
  date: 'luni, 2 noiembrie 2026',
  time: '09:30',
  place: 'CEEF, Cabinetul 223',
  address: 'str. Miron Costin 26/2, Chișinău',
  mapUrl: 'https://maps.google.com/?q=Miron+Costin+26%2F2,+Chi%C8%99in%C4%83u',
  // 09:30–11:30 ora Chișinăului (EET, UTC+2 în noiembrie)
  startUtc: '20261102T073000Z',
  endUtc: '20261102T093000Z',
  start: new Date('2026-11-02T09:30:00+02:00'),
};

// Ora Chișinăului: după 25 octombrie 2026 e UTC+2. Fiecare reamintire e valabilă până la
// ora următoarei (ultima, până la 09:30): una întârziată nu mai pleacă după ce a venit rândul celeilalte.
// Ora celei de duminică e o setare: Proprietatea script ORA_REAMINTIRE_1NOV (implicit 07:00),
// citită de setup(), care creează și declanșatoarele (vezi reminders_()).
const REMINDERS = [
  {
    id: 'r29oct', col: COL.r29oct, at: new Date('2026-10-29T10:00:00+02:00'), label: 'joi, 29 octombrie',
    subject: 'Luni ne vedem la deschiderea GiftMe! 🎁', heading: 'Mai sunt 4 zile! 🎈',
    when: 'Luni, 2 noiembrie 2026, la ora 09:30', calendar: true,
  },
  {
    id: 'r1nov', col: COL.r1nov, at: null, label: 'duminică, 1 noiembrie',
    subject: 'Mâine ne vedem la deschiderea GiftMe! 🎁', heading: 'Ne vedem mâine! ⏰',
    when: 'Mâine, luni, 2 noiembrie 2026, la ora 09:30', calendar: true,
  },
  {
    id: 'r0730', col: COL.r0730, at: new Date('2026-11-02T07:30:00+02:00'), label: 'luni, 2 noiembrie, la 07:30',
    subject: 'Astăzi, la 09:30, ne vedem la deschiderea GiftMe! 🎉', heading: 'Ne vedem astăzi! 🎉',
    when: 'Astăzi, luni, 2 noiembrie 2026, la ora 09:30', calendar: false,
  },
  {
    id: 'r0900', col: COL.r0900, at: new Date('2026-11-02T09:00:00+02:00'), label: 'luni, 2 noiembrie, la 09:00',
    subject: 'Începem la 09:30! Te așteptăm la deschiderea GiftMe! 🎁', heading: 'Începem în curând! 🎁',
    when: 'Astăzi, la ora 09:30', calendar: false,
  },
];
const DEFAULT_TIME_1NOV = '07:00';
const RETRY_AFTER_MIN = 15;   // al doilea declanșator al fiecărei reamintiri: reîncearcă erorile
const LATE_AFTER_MIN = 10;    // dacă primul declanșator n-a rulat până atunci, echipa e anunțată

const SENDING = 'se trimite…';
const ERROR_PREFIX = 'eroare';
const ALERT_RESERVE = 2;      // emailuri păstrate pentru alertele către echipă
const GUEST_RESERVE = 5;      // emailuri păstrate pentru confirmările de ultim moment

// Păstrează în sincron cu fields din confirma-prezenta/rsvp-config.js.
const FIELDS = [
  {
    name: 'nume',
    validate: (v) => v.length >= 2 && v.length <= 80 && /^\p{L}[\p{L}\p{M}\s.'’-]*$/u.test(v),
    message: 'Numele poate conține doar litere, spații, cratimă și apostrof (2–80 de caractere).',
  },
  {
    name: 'email',
    validate: (v) => v.length <= 120 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v),
    message: 'Adresa de email nu pare corectă. Verifică, te rugăm, dacă are forma nume@exemplu.com.',
  },
  {
    name: 'prezenta',
    validate: (v) => v === 'Da' || v === 'Nu',
    message: 'Alege „Da” sau „Nu”.',
  },
];

const MIN_FILL_MS = 2500;          // trimis mai repede decât un om = robot
const PER_CLIENT_LIMIT = 5;        // trimiteri / client / fereastră
const PER_CLIENT_WINDOW_S = 600;   // 10 minute
const GLOBAL_LIMIT_PER_MIN = 40;   // ~35 de invitați în total
const TICKET_LIMIT_PER_MIN = 300;  // verificări de bilete pe minut, în total
const PIN_FAIL_LIMIT = 20;         // PIN-uri greșite în 10 minute, apoi pauză

/* ---------------- Setări (Proprietăți script) ---------------- */

function settings_() {
  const p = PropertiesService.getScriptProperties().getProperties();
  return {
    test: String(p.MOD_TEST || '').trim().toLowerCase() === 'da',
    testEmail: String(p.TEST_EMAIL || '').trim().toLowerCase(),
    teamEmail: String(p.TEAM_EMAIL || DEFAULT_TEAM_EMAIL).trim(),
    site: String(p.SITE_URL || DEFAULT_SITE).trim().replace(/\/+$/, ''),
    webApp: String(p.WEB_APP_URL || '').trim(),
    pin: String(p.STAFF_PIN || '').trim(),
    formReview: String(p.FORM_REVIEW_URL || '').trim(),
    formAbsent: String(p.FORM_ABSENT_URL || '').trim(),
  };
}

/* ---------------- Primirea răspunsurilor și a scanărilor ---------------- */

function doPost(e) {
  let body;
  try {
    body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return json({ ok: false, error: 'validation' });
  }

  // Pagina /confirma-prezenta/intrare/: verificarea sau marcarea unui bilet.
  if (body.action === 'verify' || body.action === 'checkin') return json(ticketAction_(body));

  // Capcană + timp minim: răspundem „ok” ca să nu dăm indicii roboților, dar nu salvăm.
  if (String(body.website || '') !== '' || Number(body.t || 0) < MIN_FILL_MS) {
    return json({ ok: true });
  }

  const values = {};
  const errors = {};
  FIELDS.forEach((field) => {
    const value = String(body[field.name] == null ? '' : body[field.name]).replace(/\s+/g, ' ').trim();
    if (!value || !field.validate(value)) errors[field.name] = field.message;
    values[field.name] = value;
  });
  if (Object.keys(errors).length) return json({ ok: false, error: 'validation', fields: errors });
  values.email = values.email.toLowerCase();

  if (isRateLimited(String(body.cid || 'anonim').slice(0, 64))) {
    return json({ ok: false, error: 'rate_limited' });
  }

  const lock = LockService.getScriptLock();
  let saved;
  try {
    lock.waitLock(10000);
    saved = upsert(values);
  } catch (err) {
    console.error(err);
    return json({ ok: false, error: 'server' });
  } finally {
    lock.releaseLock();
  }

  const s = settings_();
  // Emailul nu blochează confirmarea: dacă nu pleacă, răspunsul rămâne salvat.
  let emailSent = false;
  if (saved.changed) {
    try {
      sendConfirmation(values, saved, s);
      emailSent = true;
      saved.sheet.getRange(saved.row, COL.confirm).setValue(new Date());
      if (values.prezenta === 'Da') saved.sheet.getRange(saved.row, COL.qrSent).setValue(new Date());
    } catch (err) {
      console.error(err);
      saved.sheet.getRange(saved.row, COL.confirm).setValue('eroare: ' + err.message);
    }
  }
  notifyTeam_(values, saved, emailSent, s);

  return json({ ok: true, nr: saved.nr, emailSent: emailSent });
}

function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.stop) return stopPage_(String(p.stop), p.ok === '1');
  return json({ ok: true, service: 'giftme-rsvp', v: 2 });
}

/**
 * Un singur rând per adresă de email: dacă există deja, actualizăm numele și răspunsul.
 * changed = rând nou sau răspuns schimbat (doar atunci retrimitem confirmarea).
 * Reamintirile a căror oră a trecut primesc un motiv în celulă, ca să nu mai plece.
 */
function upsert(values) {
  const sheet = getSheet();
  const now = new Date();
  const rows = readRows_(sheet);
  const totals = { da: 0, nu: 0 };
  let saved = null;

  for (let i = 0; i < rows.length && !saved; i++) {
    const r = rows[i];
    if (String(val(r, COL.email)).trim().toLowerCase() !== values.email) continue;
    const previous = String(val(r, COL.prezenta));
    const changed = previous !== values.prezenta;
    sheet.getRange(r.row, COL.nume, 1, 3).setValues([[safe(values.nume), safe(values.email), values.prezenta]]);
    sheet.getRange(r.row, COL.updated).setValue(now);
    let code = String(val(r, COL.code) || '');
    if (!code) {
      code = newTicketCode_();
      sheet.getRange(r.row, COL.code).setValue(code);
    }
    if (changed && values.prezenta === 'Da') {
      sheet.getRange(r.row, COL.yesSince).setValue(now);
      reminders_().forEach((rem) => {
        if (rem.at <= now && val(r, rem.col) === '') sheet.getRange(r.row, rem.col).setValue(LATE_SIGNUP);
      });
    }
    r.v[COL.prezenta - 1] = values.prezenta;
    saved = { sheet: sheet, row: r.row, nr: val(r, COL.nr), code: code, changed: changed, isNew: false, previous: previous };
  }

  if (!saved) {
    const nr = sheet.getLastRow(); // rândul 1 = antet
    const code = newTicketCode_();
    const line = HEADERS.map(() => '');
    line[COL.sent - 1] = now;
    line[COL.nume - 1] = safe(values.nume);
    line[COL.email - 1] = safe(values.email);
    line[COL.prezenta - 1] = values.prezenta;
    line[COL.nr - 1] = nr;
    line[COL.code - 1] = code;
    if (values.prezenta === 'Da') {
      line[COL.yesSince - 1] = now;
      reminders_().forEach((rem) => { if (rem.at <= now) line[rem.col - 1] = LATE_SIGNUP; });
    }
    sheet.appendRow(line);
    const row = sheet.getLastRow();
    sheet.getRange(row, COL.came).setDataValidation(checkboxRule_());
    rows.push({ row: row, v: line });
    saved = { sheet: sheet, row: row, nr: nr, code: code, changed: true, isNew: true, previous: '' };
  }

  rows.forEach((r) => {
    if (val(r, COL.prezenta) === 'Da') totals.da++;
    else if (val(r, COL.prezenta) === 'Nu') totals.nu++;
  });
  saved.totals = totals;
  return saved;
}
const LATE_SIGNUP = 'nu: confirmat după ora reamintirii';

/** Foaia de care e legat scriptul (sau cea salvată de setup()). */
function getSpreadsheet() {
  const id = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  if (id) return SpreadsheetApp.openById(id);
  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (active) return active;
  throw new Error('Scriptul nu e legat de o foaie. Deschide-l din foaie: Extensii → Apps Script, apoi rulează setup.');
}

function getSheet() {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
  ensureLayout_(sheet);
  return sheet;
}

/** Adaugă coloanele noi la dreapta celor vechi. Nu mută și nu șterge nimic. */
function ensureLayout_(sheet) {
  const width = HEADERS.length;
  if (sheet.getMaxColumns() < width) sheet.insertColumnsAfter(sheet.getMaxColumns(), width - sheet.getMaxColumns());
  const current = sheet.getRange(1, 1, 1, width).getValues()[0];
  if (current.every((h, i) => h === HEADERS[i])) return;
  sheet.getRange(1, 1, 1, width).setValues([HEADERS]).setFontWeight('bold');
  sheet.setFrozenRows(1);
  const rows = Math.max(sheet.getMaxRows() - 1, 1);
  sheet.getRange(2, COL.came, rows, 1).setDataValidation(checkboxRule_());
  // Text simplu: un cod ca „123e4567…” nu trebuie citit ca număr.
  sheet.getRange(2, COL.code, rows, 1).setNumberFormat('@');
}

function checkboxRule_() {
  return SpreadsheetApp.newDataValidation().requireCheckbox().build();
}

function readRows_(sheet) {
  const last = sheet.getLastRow();
  if (last < 2) return [];
  return sheet.getRange(2, 1, last - 1, HEADERS.length).getValues().map((v, i) => ({ row: i + 2, v: v }));
}

function val(r, col) {
  return r.v[col - 1];
}

/** Cod de bilet: 128 de biți aleatorii, în hex. Nu conține numele sau emailul. */
function newTicketCode_() {
  const digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    Utilities.getUuid() + Utilities.getUuid() + Date.now()
  );
  return digest.slice(0, 16).map((b) => ((b + 256) % 256).toString(16).padStart(2, '0')).join('');
}

/** Coduri pentru rândurile scrise de scriptul vechi și „Da din” pentru cei care au confirmat deja. */
function ensureCodes_(sheet) {
  const rows = readRows_(sheet);
  let filled = 0;
  rows.forEach((r) => {
    if (!val(r, COL.email)) return;
    if (!val(r, COL.code)) {
      const code = newTicketCode_();
      sheet.getRange(r.row, COL.code).setValue(code);
      r.v[COL.code - 1] = code;
      filled++;
    }
    if (val(r, COL.prezenta) === 'Da' && !(val(r, COL.yesSince) instanceof Date)) {
      const since = val(r, COL.updated) instanceof Date ? val(r, COL.updated) : val(r, COL.sent);
      if (since instanceof Date) sheet.getRange(r.row, COL.yesSince).setValue(since);
    }
  });
  return filled;
}

function findByCode_(sheet, code) {
  return readRows_(sheet).find((r) => String(val(r, COL.code)).trim().toLowerCase() === code) || null;
}

function ticketUrl_(code, s) {
  return s.site + '/confirma-prezenta/intrare/#' + code;
}

/* ---------------- Intrarea: verificare și marcare ---------------- */

function ticketAction_(body) {
  if (isTicketRateLimited_()) return { ok: false, error: 'rate_limited' };
  const code = String(body.code || '').trim().toLowerCase();
  if (!/^[0-9a-f]{32}$/.test(code)) return { ok: true, status: 'unknown' };

  // Fără PIN: spunem doar dacă biletul există. Nu arătăm numele și nu marcăm nimic.
  if (body.action === 'verify') {
    return { ok: true, status: findByCode_(getSheet(), code) ? 'valid' : 'unknown' };
  }

  const pin = settings_().pin;
  if (pin.length < 6) return { ok: false, error: 'pin_not_set' };
  if (isPinLocked_()) return { ok: false, error: 'locked' };
  if (!sameText_(String(body.pin || '').trim(), pin)) {
    registerWrongPin_();
    return { ok: false, error: 'wrong_pin' };
  }

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const sheet = getSheet();
    const r = findByCode_(sheet, code);
    if (!r) return { ok: true, status: 'unknown' };
    const name = String(val(r, COL.nume));
    const answer = String(val(r, COL.prezenta));
    if (isChecked_(val(r, COL.came))) {
      return { ok: true, status: 'already', name: name, at: fmtWhen_(val(r, COL.cameAt)), answer: answer };
    }
    const now = new Date();
    sheet.getRange(r.row, COL.came, 1, 3).setValues([[true, now, 'scanare']]);
    return { ok: true, status: 'checked_in', name: name, at: fmtWhen_(now), answer: answer };
  } catch (err) {
    console.error(err);
    return { ok: false, error: 'server' };
  } finally {
    lock.releaseLock();
  }
}

/** Bifa „Venit?” pusă de mână: completăm ora și „manual”. Debifată: golim ora. */
function onEdit(e) {
  const range = e && e.range;
  if (!range || range.getSheet().getName() !== SHEET_NAME) return;
  if (COL.came < range.getColumn() || COL.came > range.getLastColumn()) return;
  const first = Math.max(2, range.getRow());
  const count = range.getLastRow() - first + 1;
  if (count < 1) return;
  const sheet = range.getSheet();
  const block = sheet.getRange(first, COL.came, count, 3).getValues();
  const now = new Date();
  let dirty = false;
  const out = block.map(([came, at, via]) => {
    if (isChecked_(came) && !at) { dirty = true; return [came, now, 'manual']; }
    if (!isChecked_(came) && (at || via)) { dirty = true; return [came, '', '']; }
    return [came, at, via];
  });
  if (dirty) sheet.getRange(first, COL.came, count, 3).setValues(out);
}

function isChecked_(v) {
  return v === true || String(v).toUpperCase() === 'TRUE';
}

function isOptedOut_(r) {
  return val(r, COL.optOut) !== '' && val(r, COL.optOut) != null;
}

/* ---------------- Dezabonare ---------------- */

function stopUrl_(code, s) {
  let base = s.webApp;
  if (!base) {
    try { base = ScriptApp.getService().getUrl(); } catch (err) { base = ''; }
  }
  return base ? base + '?stop=' + code : '';
}

/** GET ?stop=COD arată un buton; abia ?stop=COD&ok=1 oprește emailurile (scanerele de linkuri nu apasă butoane). */
function stopPage_(code, confirmed) {
  code = code.trim().toLowerCase();
  let html;
  if (!/^[0-9a-f]{32}$/.test(code)) {
    html = '<h1>Link invalid</h1><p>Scrie-ne la ' + REPLY_TO + ' și te scoatem noi din listă.</p>';
  } else if (!confirmed) {
    const url = (ScriptApp.getService().getUrl() || settings_().webApp) + '?stop=' + code + '&ok=1';
    html = '<h1>Nu mai vrei emailuri despre deschiderea GiftMe!?</h1>'
      + '<p>Nu-ți mai trimitem reamintiri și nici emailul de după eveniment. Biletul tău rămâne valid.</p>'
      + '<p><a class="btn" href="' + url + '" target="_top">Da, nu mai trimiteți emailuri</a></p>';
  } else {
    const lock = LockService.getScriptLock();
    let found = false;
    try {
      lock.waitLock(10000);
      const sheet = getSheet();
      const r = findByCode_(sheet, code);
      if (r) {
        found = true;
        if (!isOptedOut_(r)) sheet.getRange(r.row, COL.optOut).setValue(new Date());
      }
    } finally {
      lock.releaseLock();
    }
    html = found
      ? '<h1>Gata!</h1><p>Nu-ți mai trimitem emailuri despre eveniment. Biletul tău rămâne valid. Dacă te-ai răzgândit, scrie-ne la ' + REPLY_TO + '.</p>'
      : '<h1>Nu am găsit biletul</h1><p>Scrie-ne la ' + REPLY_TO + ' și te scoatem noi din listă.</p>';
  }
  return HtmlService.createHtmlOutput(
    '<!doctype html><html lang="ro"><head><meta charset="utf-8"><style>'
    + 'body{font-family:Arial,Helvetica,sans-serif;color:#111;max-width:520px;margin:32px auto;padding:0 16px;line-height:1.55}'
    + 'h1{font-size:24px;color:#F90100}.btn{display:inline-block;padding:12px 20px;border:2px solid #111;border-radius:999px;background:#111;color:#fff;font-weight:700;text-decoration:none}'
    + '</style></head><body>' + html + '</body></html>'
  ).setTitle('GiftMe!').addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/* ---------------- Emailuri către invitați ---------------- */

function sendConfirmation(values, saved, s) {
  s = s || settings_();
  const name = escapeHtml(values.nume);
  if (values.prezenta === 'Da') {
    const next = reminders_().filter((rem) => rem.at > new Date()).map((rem) => rem.label);
    const remindersLine = next.length > 1 ? 'Îți trimitem reamintiri: ' + joinRo_(next) + '.'
      : next.length ? 'Îți trimitem o reamintire: ' + next[0] + '.'
        : 'Ne vedem curând!';
    sendMail_(values.email, 'Biletul tău pentru deschiderea GiftMe! 🎁', [
      `Super, ${values.nume}! Ne vedem la deschiderea GiftMe!`,
      plainTicket_(values.nume, saved.nr, saved.code, s),
      remindersLine,
      `Te-ai răzgândit? Îți poți schimba răspunsul pe ${SITE}/confirma-prezenta/`,
      plainStop_(saved.code, s),
    ].join('\n\n'), {
      attachments: [icsBlob()],
      inlineImages: { qr: qrPngBlob_(ticketUrl_(saved.code, s)) },
      htmlBody: layout(`
        <p style="margin:0 0 6px;font-size:28px;font-weight:700;color:#F90100;">Super, ne vedem acolo! 🎉</p>
        <p style="margin:0 0 20px;">Mulțumim că ți-ai confirmat prezența la marea deschidere GiftMe!</p>
        ${ticket(name, saved.nr, saved.code, s)}
        ${calendarButtons()}
        <p style="margin:20px 0 0;color:#5C5254;font-size:14px;">${remindersLine} Dacă planurile se schimbă, îți poți modifica răspunsul oricând pe <a href="${SITE}/confirma-prezenta/" style="color:#C40000;">giftme.site/confirma-prezenta</a>.</p>
        ${htmlStop_(saved.code, s)}`),
    });
  } else {
    sendMail_(values.email, 'Am primit răspunsul tău – GiftMe!',
      `Mulțumim că ne-ai anunțat, ${values.nume}! Ne pare rău că nu poți ajunge la deschiderea GiftMe!. Te-ai răzgândit? ${SITE}/confirma-prezenta/`, {
        htmlBody: layout(`
          <p style="margin:0 0 6px;font-size:26px;font-weight:700;color:#F90100;">Mulțumim că ne-ai anunțat!</p>
          <p style="margin:0 0 16px;">Dragă ${name}, ne pare rău că nu poți ajunge la deschiderea GiftMe!, dar ne bucurăm mult că ne ești alături. Îți păstrăm un gând bun și o surpriză pentru data viitoare. ❤️</p>
          <p style="margin:0;color:#5C5254;font-size:14px;">Te-ai răzgândit? Îți poți schimba răspunsul pe <a href="${SITE}/confirma-prezenta/" style="color:#C40000;">giftme.site/confirma-prezenta</a>.</p>`),
      });
  }
}

function sendReminderEmail_(r, rem, s) {
  const plainName = String(val(r, COL.nume));
  const name = escapeHtml(plainName);
  const code = String(val(r, COL.code));
  sendMail_(String(val(r, COL.email)), rem.subject, [
    `Bună, ${plainName}!`,
    `${rem.when} te așteptăm la deschiderea GiftMe!`,
    plainTicket_(plainName, val(r, COL.nr), code, s),
    'Echipa GiftMe!',
    plainStop_(code, s),
  ].join('\n\n'), {
    inlineImages: { qr: qrPngBlob_(ticketUrl_(code, s)) },
    htmlBody: layout(`
      <p style="margin:0 0 6px;font-size:28px;font-weight:700;color:#F90100;">${rem.heading}</p>
      <p style="margin:0 0 20px;">Bună, ${name}! ${rem.when} te așteptăm la deschiderea GiftMe!</p>
      ${ticket(name, val(r, COL.nr), code, s)}
      ${rem.calendar ? calendarButtons() : ''}
      ${htmlStop_(code, s)}`),
  });
}

function htmlStop_(code, s) {
  const url = stopUrl_(code, s);
  const link = url ? `<a href="${url}" style="color:#5C5254;">oprește mesajele</a> sau ` : '';
  return `<p style="margin:20px 0 0;color:#5C5254;font-size:13px;">Nu mai vrei emailuri despre eveniment? ${link}răspunde la acest email cu „STOP”.</p>`;
}

function plainStop_(code, s) {
  const url = stopUrl_(code, s);
  return 'Nu mai vrei emailuri despre eveniment? ' + (url ? 'Deschide ' + url + ' sau ' : '') + 'răspunde la acest email cu „STOP”.';
}

function plainTicket_(name, nr, code, s) {
  return [
    `Bilet de invitat${nr ? ' nr. ' + String(nr).padStart(3, '0') : ''}: ${name}`,
    `${capitalize(EVENT.date)}, ora ${EVENT.time}`,
    `${EVENT.place}, ${EVENT.address}`,
    `Hartă: ${EVENT.mapUrl}`,
    `Codul QR pentru intrare: ${ticketUrl_(code, s)}`,
  ].join('\n');
}

/* ---------------- Notificarea echipei ---------------- */

function notifyTeam_(values, saved, emailSent, s) {
  const cell = saved.sheet.getRange(saved.row, COL.team);
  try {
    if (!teamNoticeAllowed_(new Date(), saved.totals.da)) {
      cell.setValue('sărită: păstrăm emailurile pentru invitați');
      return;
    }
    const what = saved.isNew ? 'răspuns nou'
      : saved.changed ? `și-a schimbat răspunsul: ${saved.previous || '—'} → ${values.prezenta}`
        : 'a trimis din nou același răspuns';
    const guestEmail = !saved.changed ? 'nu (răspunsul nu s-a schimbat)'
      : emailSent ? (values.prezenta === 'Da' ? 'da, biletul cu QR' : 'da, mulțumirea') : 'NU – vezi coloana „Confirmare trimisă”';
    sendMail_(s.teamEmail, `RSVP ${values.prezenta}: ${values.nume} (${what})`, [
      `Nume: ${values.nume}`,
      `Email: ${values.email}`,
      `Răspuns: ${values.prezenta} (${what})`,
      `Nr. invitat: ${saved.nr}`,
      `Ora: ${fmtDateTime_(new Date())}`,
      `Email către invitat: ${guestEmail}`,
      '',
      `Până acum: ${saved.totals.da} × Da, ${saved.totals.nu} × Nu.`,
      `Foaia: ${saved.sheet.getParent().getUrl()}`,
    ].join('\n'), {});
    cell.setValue(new Date());
  } catch (err) {
    console.error(err);
    cell.setValue('eroare: ' + err.message);
  }
}

/** Notificările echipei nu folosesc emailurile de care au nevoie reamintirile din următoarele 24 de ore. */
function teamNoticeAllowed_(now, yesCount) {
  const upcoming = reminders_().filter((rem) => rem.at > now && rem.at - now <= 24 * 3600 * 1000).length;
  return MailApp.getRemainingDailyQuota() > yesCount * upcoming + GUEST_RESERVE + ALERT_RESERVE;
}

/* ---------------- Reamintiri ---------------- */

/** Handlerul tuturor declanșatoarelor create de setup(). */
function ruleazaReamintiri() {
  withAlert_('reamintiri', () => runReminders_(new Date(), { simulated: false }));
}

/**
 * Reamintirile, cu ora celei de duminică salvată de setup(). Așa, ora folosită la trimitere
 * e mereu cea a declanșatoarelor: o proprietate schimbată fără setup() nu are efect.
 */
function reminders_() {
  const saved = PropertiesService.getScriptProperties().getProperty('EFFECTIVE_1NOV');
  const at = saved ? new Date(saved) : time1Nov_(DEFAULT_TIME_1NOV);
  return REMINDERS.map((rem) => (rem.id === 'r1nov' ? Object.assign({}, rem, { at: at }) : rem));
}

/** „HH:MM” → data de 1 noiembrie, ora Chișinăului. */
function time1Nov_(text) {
  const m = String(text).trim().match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
  if (!m) throw new Error(`ORA_REAMINTIRE_1NOV trebuie să fie o oră ca 07:00 (acum: „${text}”).`);
  return new Date(`2026-11-01T${m[1].padStart(2, '0')}:${m[2]}:00+02:00`);
}

function currentReminder_(now) {
  const list = reminders_();
  for (let i = 0; i < list.length; i++) {
    const end = i + 1 < list.length ? list[i + 1].at : EVENT.start;
    if (list[i].at <= now && now < end) return list[i];
  }
  return null;
}

function runReminders_(now, opt) {
  const s = settings_();
  const rem = currentReminder_(now);
  if (!rem) {
    console.log('Nicio reamintire de trimis la ' + fmtDateTime_(now) + '.');
    return { reminder: null };
  }
  const notes = [];
  if (!opt.simulated) {
    const props = PropertiesService.getScriptProperties();
    const ranKey = 'ran_' + rem.id;
    if (!props.getProperty(ranKey) && now - rem.at > LATE_AFTER_MIN * 60000) {
      notes.push(`Declanșatorul de la ${fmtDateTime_(rem.at)} nu a rulat la timp; a trimis cel de rezervă, la ${fmtDateTime_(now)}.`);
    }
    props.setProperty(ranKey, now.toISOString());
    // Revenire la scriptul vechi = site-ul trimite din nou formularul acolo. Atunci tăcem.
    if (!s.test && siteUsesThisScript_(s) === false) {
      alertOnce_('site_' + rem.id, `Reamintirea „${rem.label}” NU a fost trimisă`,
        `Site-ul nu mai trimite formularul la acest script (WEB_APP_URL nu apare la „live” în ${s.site}/confirma-prezenta/rsvp-config.js).\n`
        + 'Dacă ați revenit intenționat la scriptul vechi, e normal. Dacă nu, verificați rsvp-config.js și proprietatea WEB_APP_URL.', s);
      return { reminder: rem.id, skipped: 'site' };
    }
  }

  const sheet = getSheet();
  ensureCodes_(sheet);
  const stats = { reminder: rem.id, sent: 0, marked: 0, failed: [], quota: [], unknown: [] };
  readRows_(sheet).forEach((r) => {
    const decision = reminderDecision_(r, rem);
    if (decision === null) return;
    const who = `${val(r, COL.nume)} <${val(r, COL.email)}>`;
    if (decision === SENDING) { stats.unknown.push(who); return; }
    if (decision !== 'send') {
      sheet.getRange(r.row, rem.col).setValue(decision);
      stats.marked++;
      return;
    }
    if (MailApp.getRemainingDailyQuota() <= ALERT_RESERVE) {
      sheet.getRange(r.row, rem.col).setValue('eroare: cota zilnică de emailuri s-a terminat');
      stats.quota.push(who);
      return;
    }
    if (!claimCell_(sheet, r.row, rem.col)) return;
    try {
      sendReminderEmail_(r, rem, s);
      sheet.getRange(r.row, rem.col).setValue(new Date());
      stats.sent++;
    } catch (err) {
      console.error(err);
      sheet.getRange(r.row, rem.col).setValue('eroare: ' + err.message);
      stats.failed.push(`${who}: ${err.message}`);
    }
  });

  console.log(`Reamintirea ${rem.label}: ${stats.sent} trimise, ${stats.marked} marcate fără trimitere, `
    + `${stats.failed.length} erori, ${stats.quota.length} fără cotă.`);
  if (stats.failed.length || stats.quota.length || stats.unknown.length || notes.length) {
    alertTeam_(`Probleme la reamintirea „${rem.label}”`, [
      ...notes,
      `Trimise: ${stats.sent}.`,
      stats.failed.length ? `Erori (se reîncearcă la următorul declanșator, dacă mai e timp):\n- ${stats.failed.join('\n- ')}` : '',
      stats.quota.length ? `Neexpediate, cota zilnică de emailuri s-a terminat:\n- ${stats.quota.join('\n- ')}` : '',
      stats.unknown.length ? `Nu se știe dacă au plecat (scriptul s-a oprit în timpul trimiterii; NU le retrimitem):\n- ${stats.unknown.join('\n- ')}` : '',
    ].filter(Boolean).join('\n\n'), s);
  }
  return stats;
}

/** 'send', un motiv de scris în celulă, SENDING (stare nesigură) sau null (nimic de făcut). */
function reminderDecision_(r, rem) {
  if (String(val(r, COL.prezenta)) !== 'Da') return null;
  const cell = val(r, rem.col);
  if (cell instanceof Date) return null;
  const text = String(cell == null ? '' : cell);
  if (text === SENDING) return SENDING;
  if (text && text.indexOf(ERROR_PREFIX) !== 0) return null;
  if (!val(r, COL.email)) return 'nu: fără email';
  if (isOptedOut_(r)) return 'nu: a cerut să nu mai primească emailuri';
  if (isChecked_(val(r, COL.came))) return 'nu: a venit deja';
  const since = val(r, COL.yesSince) instanceof Date ? val(r, COL.yesSince)
    : val(r, COL.updated) instanceof Date ? val(r, COL.updated) : val(r, COL.sent);
  if (since instanceof Date && since >= rem.at) return LATE_SIGNUP;
  return 'send';
}

/**
 * Rezervă o celulă înainte de trimitere, sub lacăt: chiar dacă două rulări pornesc deodată,
 * doar una scrie SENDING. O celulă rămasă pe SENDING nu se mai retrimite niciodată.
 */
function claimCell_(sheet, row, col) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const cell = sheet.getRange(row, col);
    const v = cell.getValue();
    if (v instanceof Date || (v !== '' && String(v).indexOf(ERROR_PREFIX) !== 0)) return false;
    cell.setValue(SENDING);
    SpreadsheetApp.flush();
    return true;
  } finally {
    lock.releaseLock();
  }
}

/**
 * Folosește site-ul acest script? true / false / null (nu se știe: atunci trimitem oricum).
 * Citește URL-ul de la „live:” (sau „test:” pe o previzualizare) din rsvp-config.js.
 */
function siteUsesThisScript_(s) {
  const mine = deploymentId_(s.webApp);
  if (!mine) return null;
  try {
    const res = UrlFetchApp.fetch(s.site + '/confirma-prezenta/rsvp-config.js?v=' + Date.now(), {
      muteHttpExceptions: true,
      followRedirects: true,
    });
    if (res.getResponseCode() !== 200) return null;
    const key = /^https:\/\/(www\.)?giftme\.site$/.test(s.site) ? 'live' : 'test';
    const m = res.getContentText().match(new RegExp('\\b' + key + ":\\s*'([^']*)'"));
    if (!m) return null;
    return deploymentId_(m[1]) === mine;
  } catch (err) {
    console.warn(err);
    return null;
  }
}

function deploymentId_(url) {
  const m = String(url || '').match(/\/macros\/s\/([^/]+)\//);
  return m ? m[1] : '';
}

/* ---------------- Alerte către echipă ---------------- */

/** Rulează fn; dacă aruncă o eroare, anunță echipa și lasă eroarea să apară și în jurnalul Google. */
function withAlert_(what, fn) {
  try {
    return fn();
  } catch (err) {
    console.error(err);
    alertTeam_(`Eroare la ${what}`, `${err.message}\n\n${err.stack || ''}\n\nVerificați Execuții (Executions) în editorul Apps Script.`);
    throw err;
  }
}

function alertTeam_(subject, body, s) {
  s = s || settings_();
  try {
    sendMail_(s.teamEmail, '⚠️ GiftMe RSVP: ' + subject, body + `\n\n${fmtDateTime_(new Date())}`, {});
  } catch (err) {
    console.error('Alerta nu a putut fi trimisă: ' + err.message);
  }
}

function alertOnce_(key, subject, body, s) {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('alert_' + key)) return;
  props.setProperty('alert_' + key, new Date().toISOString());
  alertTeam_(subject, body, s);
}

/* ---------------- Meniul din foaie ---------------- */

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  const menu = ui.createMenu('GiftMe')
    .addItem('Trimite follow-up', 'trimiteFollowUp')
    .addItem('Trimite biletul cu QR celor care nu l-au primit', 'trimiteBileteLipsa')
    .addSeparator()
    .addItem('Verifică cota de emailuri', 'verificaCota')
    .addItem('Arată reamintirile programate', 'arataReamintirile');
  let test = false;
  let time1Nov = DEFAULT_TIME_1NOV;
  try {
    test = settings_().test;
    time1Nov = Utilities.formatDate(reminders_()[1].at, TZ, 'HH:mm');
  } catch (err) { /* fără acces la proprietăți: fără meniul de test */ }
  if (test) {
    menu.addSeparator().addSubMenu(ui.createMenu('Test (doar pe copie)')
      .addItem('Simulează reamintirea 1 (joi, 29 oct, 10:00)', 'testReamintire1')
      .addItem(`Simulează reamintirea 2 (duminică, 1 nov, ${time1Nov})`, 'testReamintire2')
      .addItem('Simulează reamintirea 3 (luni, 2 nov, 07:30)', 'testReamintire3')
      .addItem('Simulează reamintirea 4 (luni, 2 nov, 09:00)', 'testReamintire4')
      .addItem('Simulează o eroare de declanșator', 'testEroareDeclansator')
      .addItem('Trimite emailurile de probă', 'testEmails'));
  }
  menu.addToUi();
}

/* ---------------- Follow-up (manual, din meniu) ---------------- */

function trimiteFollowUp() {
  const ui = SpreadsheetApp.getUi();
  const s = settings_();
  if (!s.test && new Date() < EVENT.start) {
    ui.alert('Follow-up-ul se trimite doar după eveniment, după ce echipa a terminat de marcat prezența.');
    return;
  }
  if (!s.formReview || !s.formAbsent) {
    ui.alert('Lipsesc linkurile formularelor (FORM_REVIEW_URL și FORM_ABSENT_URL). Rulează creeazaFormularele din editor sau pune linkurile în Proprietăți script.');
    return;
  }
  const sheet = getSheet();
  const plan = readRows_(sheet).map((r) => ({ r: r, kind: followUpKind_(r) })).filter((x) => x.kind);
  const review = plan.filter((x) => x.kind === 'review').length;
  const absent = plan.length - review;
  const quota = MailApp.getRemainingDailyQuota();
  const answer = ui.prompt('Trimite follow-up', [
    'Trimite DOAR după ce echipa a terminat de marcat prezența în coloana „Venit?”.',
    '',
    `Formularul de părere: ${review} invitați marcați ca veniți.`,
    `Formularul „De ce n-ai putut ajunge?”: ${absent} invitați cu „Da” care nu sunt marcați ca veniți.`,
    `Emailuri rămase azi în contul Google: ${quota}.`,
    '',
    'Scrie GATA și apasă OK ca să trimiți.',
  ].join('\n'), ui.ButtonSet.OK_CANCEL);
  if (answer.getSelectedButton() !== ui.Button.OK || answer.getResponseText().trim().toUpperCase() !== 'GATA') {
    ui.alert('Nu am trimis nimic.');
    return;
  }

  let sent = 0;
  const problems = [];
  plan.forEach(({ r, kind }) => {
    const who = `${val(r, COL.nume)} <${val(r, COL.email)}>`;
    if (MailApp.getRemainingDailyQuota() <= ALERT_RESERVE) { problems.push(`${who}: cota zilnică s-a terminat`); return; }
    if (!claimCell_(sheet, r.row, COL.followup)) return;
    try {
      sendFollowUp_(r, kind, s);
      sheet.getRange(r.row, COL.followup).setValue((kind === 'review' ? 'părere · ' : 'absent · ') + fmtDateTime_(new Date()));
      sent++;
    } catch (err) {
      sheet.getRange(r.row, COL.followup).setValue('eroare: ' + err.message);
      problems.push(`${who}: ${err.message}`);
    }
  });
  ui.alert(`Follow-up trimis: ${sent}.` + (problems.length
    ? `\n\nNetrimise (${problems.length}) – rulează din nou mâine, cei care au primit deja nu primesc a doua oară:\n${problems.join('\n')}`
    : ''));
}

/** 'review' (a venit), 'absent' (a spus Da, nu e marcat) sau null. */
function followUpKind_(r) {
  if (!val(r, COL.email) || isOptedOut_(r)) return null;
  const done = val(r, COL.followup);
  if (done instanceof Date || (done !== '' && String(done).indexOf(ERROR_PREFIX) !== 0)) return null;
  if (isChecked_(val(r, COL.came))) return 'review';
  if (val(r, COL.prezenta) === 'Da') return 'absent';
  return null;
}

function sendFollowUp_(r, kind, s) {
  const plainName = String(val(r, COL.nume));
  const name = escapeHtml(plainName);
  const code = String(val(r, COL.code));
  const btn = 'display:inline-block;margin:8px 0 0;padding:12px 20px;border:2px solid #111111;border-radius:999px;font-weight:700;text-decoration:none;background:#111111;color:#FFFFFF;';
  if (kind === 'review') {
    sendMail_(String(val(r, COL.email)), 'Mulțumim că ai fost cu noi! 🎁', [
      `Bună, ${plainName}!`,
      'Mulțumim că ai venit la deschiderea GiftMe! Ne ajută mult să aflăm cum ți s-a părut. Durează un minut:',
      s.formReview,
      plainStop_(code, s),
    ].join('\n\n'), {
      htmlBody: layout(`
        <p style="margin:0 0 6px;font-size:28px;font-weight:700;color:#F90100;">Mulțumim că ai fost cu noi! 🎁</p>
        <p style="margin:0 0 16px;">Bună, ${name}! Mulțumim că ai venit la deschiderea GiftMe! Ne ajută mult să aflăm cum ți s-a părut. Durează un minut.</p>
        <p style="margin:0;"><a href="${s.formReview}" style="${btn}">Spune-ne părerea ta</a></p>
        ${htmlStop_(code, s)}`),
    });
  } else {
    sendMail_(String(val(r, COL.email)), 'Ne-a fost dor de tine la deschiderea GiftMe!', [
      `Bună, ${plainName}!`,
      'Ne-a părut rău că nu ai putut ajunge la deschiderea GiftMe!. Dacă vrei, spune-ne în 30 de secunde ce te-a împiedicat:',
      s.formAbsent,
      plainStop_(code, s),
    ].join('\n\n'), {
      htmlBody: layout(`
        <p style="margin:0 0 6px;font-size:26px;font-weight:700;color:#F90100;">Ne-a fost dor de tine!</p>
        <p style="margin:0 0 16px;">Bună, ${name}! Ne-a părut rău că nu ai putut ajunge la deschiderea GiftMe!. Dacă vrei, spune-ne în 30 de secunde ce te-a împiedicat. Ne ajută să organizăm mai bine următoarele evenimente.</p>
        <p style="margin:0;"><a href="${s.formAbsent}" style="${btn}">De ce n-ai putut ajunge?</a></p>
        ${htmlStop_(code, s)}`),
    });
  }
}

/* ---------------- Biletul cu QR pentru cei confirmați înainte de versiunea 2 ---------------- */

function trimiteBileteLipsa() {
  const ui = SpreadsheetApp.getUi();
  const s = settings_();
  const sheet = getSheet();
  ensureCodes_(sheet);
  const todo = readRows_(sheet).filter((r) => {
    const done = val(r, COL.qrSent);
    return val(r, COL.prezenta) === 'Da' && val(r, COL.email) && !isOptedOut_(r)
      && !(done instanceof Date) && (done === '' || String(done).indexOf(ERROR_PREFIX) === 0);
  });
  const quota = MailApp.getRemainingDailyQuota();
  if (!todo.length) { ui.alert('Toți invitații cu „Da” au primit deja biletul cu QR.'); return; }
  const ok = ui.alert('Biletul cu QR',
    `${todo.length} invitați cu „Da” nu au primit încă biletul cu cod QR. Emailuri rămase azi: ${quota}. Trimitem acum?`,
    ui.ButtonSet.YES_NO);
  if (ok !== ui.Button.YES) return;
  let sent = 0;
  const problems = [];
  todo.forEach((r) => {
    const who = `${val(r, COL.nume)} <${val(r, COL.email)}>`;
    if (MailApp.getRemainingDailyQuota() <= ALERT_RESERVE) { problems.push(`${who}: cota zilnică s-a terminat`); return; }
    if (!claimCell_(sheet, r.row, COL.qrSent)) return;
    try {
      sendConfirmation({ nume: String(val(r, COL.nume)), email: String(val(r, COL.email)), prezenta: 'Da' },
        { nr: val(r, COL.nr), code: String(val(r, COL.code)) }, s);
      sheet.getRange(r.row, COL.qrSent).setValue(new Date());
      sent++;
    } catch (err) {
      sheet.getRange(r.row, COL.qrSent).setValue('eroare: ' + err.message);
      problems.push(`${who}: ${err.message}`);
    }
  });
  ui.alert(`Bilete trimise: ${sent}.` + (problems.length ? `\n\nNetrimise:\n${problems.join('\n')}` : ''));
}

/* ---------------- Instalare, verificări, formulare ---------------- */

/**
 * Rulează din editor după fiecare lipire de cod. Adaugă coloanele noi, codurile lipsă,
 * reface declanșatoarele și scrie în Jurnalul de execuție tot ce trebuie verificat.
 */
function setup() {
  // Întâi ora de duminică: dacă e greșită, setup se oprește înainte să schimbe ceva.
  const props = PropertiesService.getScriptProperties();
  const time1Nov = String(props.getProperty('ORA_REAMINTIRE_1NOV') || DEFAULT_TIME_1NOV).trim();
  const at1Nov = time1Nov_(time1Nov);
  props.setProperty('EFFECTIVE_1NOV', at1Nov.toISOString());
  const ss = getSpreadsheet();
  PropertiesService.getScriptProperties().setProperty('SHEET_ID', ss.getId());
  const oldTz = ss.getSpreadsheetTimeZone();
  if (oldTz !== TZ) ss.setSpreadsheetTimeZone(TZ);
  const sheet = getSheet();
  const codes = ensureCodes_(sheet);
  const planned = setupTriggers_();
  const s = settings_();
  const report = [
    'Foaia: ' + ss.getUrl(),
    oldTz !== TZ ? `Fusul orar al foii: ${oldTz} → ${TZ}` : `Fusul orar al foii: ${TZ}`,
    `Coduri de bilet noi: ${codes}`,
    `Reamintirea de duminică: ${fmtDateTime_(at1Nov)} (ORA_REAMINTIRE_1NOV${props.getProperty('ORA_REAMINTIRE_1NOV') ? '' : ', implicit'})`,
    ...warnings1Nov_(at1Nov),
    'Declanșatoare create (ora Chișinăului):',
    ...planned.map((d) => '  - ' + fmtDateTime_(d)),
    `Mod test: ${s.test ? 'DA – emailuri doar către ' + (s.testEmail || '(lipsește TEST_EMAIL!)') : 'nu'}`,
    `Echipa primește notificări la: ${s.teamEmail}`,
    `Adresa site-ului din codurile QR: ${s.site}`,
    `PIN pentru intrare: ${s.pin.length >= 6 ? 'setat' : 'LIPSEȘTE sau are sub 6 caractere (STAFF_PIN)'}`,
    `WEB_APP_URL: ${s.webApp || 'LIPSEȘTE – pune URL-ul /exec după implementare'}`,
    `Formulare: ${s.formReview && s.formAbsent ? 'setate' : 'LIPSESC – rulează creeazaFormularele'}`,
    `Emailuri rămase azi: ${MailApp.getRemainingDailyQuota()}`,
  ];
  console.log(report.join('\n'));
}

/** Ce trebuie știut când ora de duminică nu e cea implicită. */
function warnings1Nov_(at) {
  const out = [];
  if (at >= new Date('2026-11-01T10:00:00+02:00')) {
    out.push('ATENȚIE: la 10:00 rulează încă declanșatorul scriptului vechi. Pentru o oră de la 10:00 încolo, '
      + 'șterge-l în proiectul vechi (Declanșatoare → sendReminders → Șterge), altfel invitații primesc la 10:00 reamintirea veche, fără QR.');
  }
  if (at > new Date('2026-11-01T07:30:00+02:00')) {
    out.push('ATENȚIE: după 07:30, reamintirea de duminică e la mai puțin de 24 de ore de cea de luni de la 07:30 '
      + 'și poate folosi din aceeași cotă zilnică de emailuri (vezi verificaCota).');
  }
  return out;
}

/** Câte două declanșatoare pe reamintire: la ora ei și cu 15 minute mai târziu (rezervă). */
function setupTriggers_() {
  stergeDeclansatoarele();
  const now = new Date();
  const planned = [];
  reminders_().forEach((rem) => {
    [rem.at, new Date(rem.at.getTime() + RETRY_AFTER_MIN * 60000)].forEach((d) => {
      if (d <= now) return;
      ScriptApp.newTrigger('ruleazaReamintiri').timeBased().at(d).create();
      planned.push(d);
    });
  });
  PropertiesService.getScriptProperties().setProperty('PLANNED_TRIGGERS', JSON.stringify(planned.map((d) => d.toISOString())));
  return planned;
}

/** Oprește toate reamintirile automate ale acestui script (de ex. pe copia de test, după teste). */
function stergeDeclansatoarele() {
  ScriptApp.getProjectTriggers()
    .filter((t) => t.getHandlerFunction() === 'ruleazaReamintiri')
    .forEach((t) => ScriptApp.deleteTrigger(t));
}

/** True dacă ORA_REAMINTIRE_1NOV nu mai e ora folosită de declanșatoare. */
function changed1Nov_() {
  const props = PropertiesService.getScriptProperties();
  try {
    const wanted = time1Nov_(props.getProperty('ORA_REAMINTIRE_1NOV') || DEFAULT_TIME_1NOV).toISOString();
    return Boolean(props.getProperty('EFFECTIVE_1NOV')) && wanted !== props.getProperty('EFFECTIVE_1NOV');
  } catch (err) {
    return true;
  }
}

function arataReamintirile() {
  const planned = JSON.parse(PropertiesService.getScriptProperties().getProperty('PLANNED_TRIGGERS') || '[]');
  const count = ScriptApp.getProjectTriggers().filter((t) => t.getHandlerFunction() === 'ruleazaReamintiri').length;
  const text = [
    `Declanșatoare active: ${count}.`,
    'Programate de setup (ora Chișinăului):',
    ...planned.map((iso) => '- ' + fmtDateTime_(new Date(iso))),
    ...(changed1Nov_() ? ['', 'ATENȚIE: ORA_REAMINTIRE_1NOV a fost schimbată după ultimul setup. Rulează setup ca să intre în vigoare.'] : []),
    '',
    'Ora exactă se vede și în editor → Declanșatoare (Triggers).',
  ].join('\n');
  console.log(text);
  try { SpreadsheetApp.getUi().alert(text); } catch (err) { /* rulat din editor */ }
}

/** Câte emailuri mai poate trimite contul azi și de câte e nevoie în ziua evenimentului. */
function verificaCota() {
  const left = MailApp.getRemainingDailyQuota();
  const rows = readRows_(getSheet());
  const yes = rows.filter((r) => val(r, COL.prezenta) === 'Da' && val(r, COL.email) && !isOptedOut_(r)).length;
  const text = [
    `Emailuri rămase acum (cota Google a contului ${Session.getEffectiveUser().getEmail()}): ${left}.`,
    `Invitați cu „Da” care primesc reamintiri: ${yes}.`,
    `Pe 2 noiembrie, cele două reamintiri (07:30 și 09:00) au nevoie de ${2 * yes} emailuri,`,
    'plus 2 pentru fiecare înscriere sau schimbare de ultim moment (confirmarea + notificarea echipei).',
    'Un cont Gmail obișnuit are de regulă 100 pe zi; un cont Google Workspace, 1.500.',
  ].join('\n');
  console.log(text);
  try { SpreadsheetApp.getUi().alert(text); } catch (err) { /* rulat din editor */ }
  return left;
}

/** Creează cele două formulare Google Forms și le salvează linkurile. Rulează o singură dată. */
function creeazaFormularele() {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('FORM_REVIEW_URL') && props.getProperty('FORM_ABSENT_URL')) {
    console.log('Formularele există deja:\n' + props.getProperty('FORM_REVIEW_URL') + '\n' + props.getProperty('FORM_ABSENT_URL'));
    return;
  }
  const review = FormApp.create('GiftMe! – Cum ți s-a părut deschiderea?');
  review.setDescription('Durează un minut. Nu e nevoie să-ți scrii numele.');
  review.addScaleItem().setTitle('Cât de mult ți-a plăcut deschiderea GiftMe!?')
    .setBounds(1, 5).setLabels('Deloc', 'Foarte mult').setRequired(true);
  review.addParagraphTextItem().setTitle('Ce ți-a plăcut cel mai mult?');
  review.addParagraphTextItem().setTitle('Ce am putea face mai bine?');
  publishForm_(review, 'Mulțumim! Părerea ta ne ajută mult.');

  const absent = FormApp.create('GiftMe! – De ce n-ai putut ajunge?');
  absent.setDescription('Durează 30 de secunde. Nu e nevoie să-ți scrii numele.');
  const why = absent.addMultipleChoiceItem().setTitle('Ce te-a împiedicat să ajungi?').setRequired(true);
  why.setChoices([
    why.createChoice('Am avut altceva programat'),
    why.createChoice('Am fost bolnav(ă)'),
    why.createChoice('Ora sau locul nu mi-au fost potrivite'),
    why.createChoice('Am uitat'),
  ]).showOtherOption(true);
  absent.addParagraphTextItem().setTitle('Vrei să ne mai spui ceva?');
  publishForm_(absent, 'Mulțumim că ne-ai spus!');

  props.setProperties({ FORM_REVIEW_URL: review.getPublishedUrl(), FORM_ABSENT_URL: absent.getPublishedUrl() });
  console.log([
    'Formular „părere” – link pentru invitați: ' + review.getPublishedUrl(),
    '  editare: ' + review.getEditUrl(),
    'Formular „de ce n-ai putut ajunge” – link pentru invitați: ' + absent.getPublishedUrl(),
    '  editare: ' + absent.getEditUrl(),
    'Deschide ambele linkuri pentru invitați într-o fereastră privată și verifică dacă se pot completa.',
  ].join('\n'));
}

function publishForm_(form, thanks) {
  try { form.setCollectEmail(false); } catch (err) { /* opțiune indisponibilă: implicit nu se colectează */ }
  form.setConfirmationMessage(thanks).setAcceptingResponses(true);
  if (typeof form.setPublished === 'function') form.setPublished(true);
}

/* ---------------- Teste (doar cu MOD_TEST = da) ---------------- */

function requireTest_() {
  const s = settings_();
  if (!s.test || !s.testEmail) throw new Error('Testele merg doar pe copie: MOD_TEST = da și TEST_EMAIL = adresa ta.');
  return s;
}

function simulate_(index) {
  requireTest_();
  const rem = reminders_()[index];
  const stats = runReminders_(new Date(rem.at.getTime() + 60000), { simulated: true });
  const text = `Simulare „${rem.label}”: ${stats.sent} trimise, ${stats.marked} marcate fără trimitere, `
    + `${stats.failed.length} erori. Vezi coloana „${HEADERS[rem.col - 1]}”.`;
  console.log(text);
  try { SpreadsheetApp.getUi().alert(text); } catch (err) { /* rulat din editor */ }
}
function testReamintire1() { simulate_(0); }
function testReamintire2() { simulate_(1); }
function testReamintire3() { simulate_(2); }
function testReamintire4() { simulate_(3); }

/** Verifică alerta de eroare: echipa (pe copie, TEAM_EMAIL) trebuie să primească „Eroare la test”. */
function testEroareDeclansator() {
  requireTest_();
  try {
    withAlert_('test (eroare simulată)', () => { throw new Error('Eroare simulată pentru test.'); });
  } catch (err) {
    console.log('Eroarea simulată a fost aruncată și alerta trimisă.');
  }
}

/** Emailuri de probă către adresa de test (sau a echipei), fără să scrie în foaie. */
function testEmails() {
  const s = settings_();
  const to = s.test ? requireTest_().testEmail : s.teamEmail;
  const code = '0'.repeat(32); // cod inexistent: la scanare apare „bilet necunoscut”
  const sample = { nume: 'Ana Popescu', email: to, prezenta: 'Da' };
  sendConfirmation(sample, { nr: 7, code: code }, s);
  sendConfirmation(Object.assign({}, sample, { prezenta: 'Nu' }), { nr: 7, code: code }, s);
}

/* ---------------- Trimiterea emailurilor ---------------- */

/** Toate emailurile trec pe aici. În modul test pleacă doar către TEST_EMAIL (și aliasurile +ceva). */
function sendMail_(to, subject, text, options) {
  const s = settings_();
  if (s.test && !allowedInTest_(to, s.testEmail)) throw new Error('blocat în modul test: ' + to);
  MailApp.sendEmail(to, subject, text, Object.assign({ name: SENDER_NAME, replyTo: REPLY_TO }, options));
}

function allowedInTest_(to, testEmail) {
  const base = (a) => String(a).trim().toLowerCase().replace(/\+[^@]*@/, '@');
  return Boolean(testEmail) && base(to) === base(testEmail);
}

function layout(inner) {
  return `<!doctype html><html lang="ro"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0;padding:24px 12px;background:#FDECEC;font-family:Poppins,Arial,Helvetica,sans-serif;color:#111111;font-size:16px;line-height:1.55;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#FFFFFF;border:3px solid #111111;border-radius:20px;">
        <tr><td style="padding:28px 26px 8px;"><img src="${SITE}/confirma-prezenta/assets/logo-giftme.png" width="120" alt="GiftMe!" style="display:block;border:0;"></td></tr>
        <tr><td style="padding:12px 26px 28px;">${inner}</td></tr>
      </table>
      <p style="margin:18px 0 0;color:#5C5254;font-size:13px;">FE GiftMe! SRL · CEEF, Chișinău · <span style="color:#F90100;">Gândit pentru tine</span></p>
    </td></tr></table></body></html>`;
}

/** Biletul din email. Imaginea „cid:qr” vine din inlineImages. */
function ticket(name, nr, code, s) {
  const nrLabel = nr ? 'Nr. ' + String(nr).padStart(3, '0') : '';
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FDECEC;border:3px solid #111111;border-radius:16px;">
    <tr><td style="padding:18px 20px;">
      <p style="margin:0;color:#C40000;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">Bilet de invitat ${nrLabel ? '· ' + nrLabel : ''}</p>
      <p style="margin:6px 0 14px;font-size:26px;font-weight:700;">${name}</p>
      <p style="margin:0 0 4px;"><strong>📅 ${capitalize(EVENT.date)}</strong>, ora ${EVENT.time}</p>
      <p style="margin:0;"><strong>📍 ${EVENT.place}</strong><br><span style="color:#5C5254;">${EVENT.address}</span> · <a href="${EVENT.mapUrl}" style="color:#C40000;">hartă</a></p>
    </td></tr>
    <tr><td align="center" style="padding:4px 20px 18px;">
      <img src="cid:qr" width="200" height="200" alt="Codul QR al biletului" style="display:block;border:0;background:#FFFFFF;">
      <p style="margin:8px 0 0;font-size:14px;"><strong>Arată acest cod la intrare.</strong></p>
      <p style="margin:2px 0 0;font-size:13px;color:#5C5254;">Nu se vede codul? <a href="${ticketUrl_(code, s)}" style="color:#C40000;">Deschide biletul</a></p>
    </td></tr></table>`;
}

function calendarButtons() {
  const gcal = 'https://calendar.google.com/calendar/render?action=TEMPLATE'
    + '&text=' + encodeURIComponent(EVENT.title)
    + '&dates=' + EVENT.startUtc + '/' + EVENT.endUtc
    + '&location=' + encodeURIComponent(EVENT.place + ', ' + EVENT.address)
    + '&details=' + encodeURIComponent('Te așteptăm cu surprize și voie bună! ' + SITE);
  const btn = 'display:inline-block;margin:16px 8px 0 0;padding:12px 20px;border:2px solid #111111;border-radius:999px;font-weight:700;text-decoration:none;';
  return `<p style="margin:0;">
    <a href="${gcal}" style="${btn}background:#111111;color:#FFFFFF;">📅 Adaugă în Google Calendar</a>
    <a href="${SITE}/confirma-prezenta/giftme-lansare.ics" style="${btn}background:#FFFFFF;color:#111111;">Apple / Outlook</a>
  </p>`;
}

function icsBlob() {
  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//FE GiftMe SRL//Deschidere//RO', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    'UID:deschidere-2026-11-02@giftme.site',
    'DTSTAMP:' + Utilities.formatDate(new Date(), 'UTC', "yyyyMMdd'T'HHmmss'Z'"),
    'DTSTART:' + EVENT.startUtc,
    'DTEND:' + EVENT.endUtc,
    'SUMMARY:' + EVENT.title,
    'LOCATION:CEEF\\, Cabinetul 223\\, str. Miron Costin 26/2\\, Chișinău',
    'DESCRIPTION:Te așteptăm cu surprize și voie bună! ' + SITE,
    'BEGIN:VALARM', 'TRIGGER:-PT1H', 'ACTION:DISPLAY', 'DESCRIPTION:Deschiderea GiftMe! începe într-o oră', 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n');
  return Utilities.newBlob(ics, 'text/calendar', 'GiftMe-deschidere.ics');
}

/* ---------------- Codul QR ca imagine PNG (fără serviciu extern) ---------------- */

/** PNG alb-negru (1 bit) din matricea dată de GiftMeQR (QR.gs). */
function qrPngBlob_(text) {
  const qr = GiftMeQR.matrix(text);
  const scale = 8;
  const quiet = 4; // marginea albă cerută de standard, în module
  const n = (qr.size + quiet * 2) * scale;
  const rowBytes = Math.ceil(n / 8);
  const raw = new Array((rowBytes + 1) * n).fill(0);
  let pos = 0;
  for (let y = 0; y < n; y++) {
    raw[pos++] = 0; // filtru PNG: niciunul
    const my = Math.floor(y / scale) - quiet;
    for (let bx = 0; bx < rowBytes; bx++) {
      let byte = 0;
      for (let bit = 0; bit < 8; bit++) {
        const x = bx * 8 + bit;
        const mx = Math.floor(x / scale) - quiet;
        const dark = x < n && mx >= 0 && my >= 0 && mx < qr.size && my < qr.size && qr.dark(mx, my);
        if (!dark) byte |= 0x80 >> bit; // 1 = alb
      }
      raw[pos++] = byte;
    }
  }
  const bytes = [].concat(
    [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A],
    pngChunk_('IHDR', [].concat(u32_(n), u32_(n), [1, 0, 0, 0, 0])),
    pngChunk_('IDAT', zlibStored_(raw)),
    pngChunk_('IEND', [])
  );
  return Utilities.newBlob(bytes.map((b) => (b > 127 ? b - 256 : b)), 'image/png', 'bilet-qr.png');
}

function u32_(v) {
  return [(v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255];
}

function pngChunk_(type, data) {
  const typeBytes = type.split('').map((c) => c.charCodeAt(0));
  return [].concat(u32_(data.length), typeBytes, data, u32_(crc32_(typeBytes.concat(data))));
}

/** zlib cu blocuri „stored” (fără compresie): simplu și suficient pentru ~17 KB. */
function zlibStored_(data) {
  const out = [0x78, 0x01];
  for (let i = 0; i < data.length || i === 0; i += 65535) {
    const len = Math.min(65535, data.length - i);
    const last = i + 65535 >= data.length ? 1 : 0;
    out.push(last, len & 255, len >>> 8, ~len & 255, (~len >>> 8) & 255);
    for (let j = 0; j < len; j++) out.push(data[i + j]);
  }
  let a = 1;
  let b = 0;
  for (let i = 0; i < data.length; i++) {
    a = (a + data[i]) % 65521;
    b = (b + a) % 65521;
  }
  return out.concat(u32_(((b << 16) | a) >>> 0));
}

let CRC_TABLE_ = null;
function crc32_(bytes) {
  if (!CRC_TABLE_) {
    CRC_TABLE_ = [];
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
      CRC_TABLE_.push(c >>> 0);
    }
  }
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) crc = CRC_TABLE_[(crc ^ bytes[i]) & 255] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

/* ---------------- Utilitare ---------------- */

function isRateLimited(clientId) {
  const cache = CacheService.getScriptCache();
  const minuteKey = 'g:' + Math.floor(Date.now() / 60000);
  const clientKey = 'c:' + clientId;
  const globalCount = Number(cache.get(minuteKey) || 0);
  const clientCount = Number(cache.get(clientKey) || 0);
  if (globalCount >= GLOBAL_LIMIT_PER_MIN || clientCount >= PER_CLIENT_LIMIT) return true;
  cache.put(minuteKey, String(globalCount + 1), 120);
  cache.put(clientKey, String(clientCount + 1), PER_CLIENT_WINDOW_S);
  return false;
}

function isTicketRateLimited_() {
  const cache = CacheService.getScriptCache();
  const key = 't:' + Math.floor(Date.now() / 60000);
  const count = Number(cache.get(key) || 0);
  if (count >= TICKET_LIMIT_PER_MIN) return true;
  cache.put(key, String(count + 1), 120);
  return false;
}

function isPinLocked_() {
  return Number(CacheService.getScriptCache().get('pinfail') || 0) >= PIN_FAIL_LIMIT;
}

function registerWrongPin_() {
  const cache = CacheService.getScriptCache();
  cache.put('pinfail', String(Number(cache.get('pinfail') || 0) + 1), 600);
}

/** Comparație în timp constant, ca durata răspunsului să nu dea indicii despre PIN. */
function sameText_(a, b) {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

function fmtDateTime_(d) {
  return Utilities.formatDate(d, TZ, 'dd.MM.yyyy HH:mm');
}

/** „09:12” azi, „09:12, 01.11” altă zi; '' dacă ora lipsește. */
function fmtWhen_(d) {
  if (!(d instanceof Date)) return '';
  const day = (x) => Utilities.formatDate(x, TZ, 'yyyy-MM-dd');
  const time = Utilities.formatDate(d, TZ, 'HH:mm');
  return day(d) === day(new Date()) ? time : time + ', ' + Utilities.formatDate(d, TZ, 'dd.MM');
}

function joinRo_(items) {
  return items.length < 2 ? items.join('') : items.slice(0, -1).join('; ') + ' și ' + items[items.length - 1];
}

// Previne „formula injection” în Sheets.
function safe(s) {
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function json(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
