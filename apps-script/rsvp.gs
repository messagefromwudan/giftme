/**
 * GiftMe! – backend pentru /confirma-prezenta
 * Merge în două feluri (vezi README.md):
 *  - legat de un Google Sheet (Extensii → Apps Script), sau
 *  - proiect separat creat pe script.google.com: la prima rulare a funcției setup()
 *    își creează singur foaia „GiftMe – Confirmări deschidere” în Drive.
 * Nu conține parole sau chei: rulează în contul Google al proprietarului foii
 * (fe.giftme@gmail.com), iar emailurile pleacă din acel cont.
 */

const SHEET_NAME = 'Confirmări';
const HEADERS = ['Trimis la', 'Nume, prenume', 'Email', 'Prezent(ă)', 'Actualizat la', 'Nr. invitat', 'Confirmare trimisă', 'Reamintire trimisă'];
const COL = { sent: 1, nume: 2, email: 3, prezenta: 4, updated: 5, nr: 6, confirm: 7, reminder: 8 };

const SENDER_NAME = 'GiftMe!';
const REPLY_TO = 'fe.giftme@gmail.com';
const SITE = 'https://giftme.site';

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
  start: new Date('2026-11-02T07:30:00Z'),
  reminderAt: new Date('2026-11-01T08:00:00Z'), // duminică, 1 noiembrie, ora 10:00
};

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

/* ---------------- Primirea răspunsurilor ---------------- */

function doPost(e) {
  let body;
  try {
    body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return json({ ok: false, error: 'validation' });
  }

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

  // Emailul nu blochează confirmarea: dacă nu pleacă, răspunsul rămâne salvat.
  let emailSent = false;
  if (saved.changed) {
    try {
      sendConfirmation(values, saved.nr);
      emailSent = true;
      saved.sheet.getRange(saved.row, COL.confirm).setValue(new Date());
    } catch (err) {
      console.error(err);
      saved.sheet.getRange(saved.row, COL.confirm).setValue('eroare: ' + err.message);
    }
  }

  return json({ ok: true, nr: saved.nr, emailSent: emailSent });
}

function doGet() {
  return json({ ok: true, service: 'giftme-rsvp' });
}

/**
 * Un singur rând per adresă de email: dacă există deja, actualizăm numele și răspunsul.
 * changed = rând nou sau răspuns schimbat (doar atunci retrimitem confirmarea).
 */
function upsert(values) {
  const sheet = getSheet();
  const now = new Date();
  const lastRow = sheet.getLastRow();

  if (lastRow > 1) {
    const rows = sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues();
    for (let i = 0; i < rows.length; i++) {
      if (String(rows[i][COL.email - 1]).toLowerCase() !== values.email) continue;
      const row = i + 2;
      const changed = rows[i][COL.prezenta - 1] !== values.prezenta;
      sheet.getRange(row, COL.nume, 1, 3).setValues([[safe(values.nume), values.email, values.prezenta]]);
      sheet.getRange(row, COL.updated).setValue(now);
      if (changed) sheet.getRange(row, COL.reminder).setValue('');
      return { sheet: sheet, row: row, nr: rows[i][COL.nr - 1], changed: changed };
    }
  }

  const nr = lastRow; // rândul 1 = antet
  sheet.appendRow([now, safe(values.nume), values.email, values.prezenta, '', nr, '', '']);
  return { sheet: sheet, row: sheet.getLastRow(), nr: nr, changed: true };
}

/** Foaia legată de script sau, pentru un proiect separat, foaia creată de setup(). */
function getSpreadsheet() {
  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (active) return active;
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('SHEET_ID');
  if (id) return SpreadsheetApp.openById(id);
  const created = SpreadsheetApp.create('GiftMe – Confirmări deschidere');
  props.setProperty('SHEET_ID', created.getId());
  return created;
}

/** Rulează o dată din editor: pregătește foaia și programează reamintirea. Linkul foii apare în jurnal. */
function setup() {
  const sheet = getSheet();
  setupReminderTrigger();
  console.log('Foaia cu confirmări: ' + sheet.getParent().getUrl());
}

function getSheet() {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
  }
  return sheet;
}

/* ---------------- Emailuri ---------------- */

function sendConfirmation(values, nr) {
  const coming = values.prezenta === 'Da';
  const name = escapeHtml(values.nume);
  const options = { name: SENDER_NAME, replyTo: REPLY_TO };

  if (coming) {
    options.attachments = [icsBlob()];
    options.htmlBody = layout(`
      <p style="margin:0 0 6px;font-size:28px;font-weight:700;color:#F90100;">Super, ne vedem acolo! 🎉</p>
      <p style="margin:0 0 20px;">Mulțumim că ți-ai confirmat prezența la marea deschidere GiftMe!</p>
      ${ticket(name, nr)}
      ${calendarButtons()}
      <p style="margin:20px 0 0;color:#5C5254;font-size:14px;">Cu o zi înainte îți trimitem o reamintire. Dacă planurile se schimbă, îți poți modifica răspunsul oricând pe <a href="${SITE}/confirma-prezenta/" style="color:#C40000;">giftme.site/confirma-prezenta</a>.</p>`);
    MailApp.sendEmail(values.email, 'Biletul tău pentru deschiderea GiftMe! 🎁', plainText(values, nr, coming), options);
  } else {
    options.htmlBody = layout(`
      <p style="margin:0 0 6px;font-size:26px;font-weight:700;color:#F90100;">Mulțumim că ne-ai anunțat!</p>
      <p style="margin:0 0 16px;">Dragă ${name}, ne pare rău că nu poți ajunge la deschiderea GiftMe!, dar ne bucurăm mult că ne ești alături. Îți păstrăm un gând bun și o surpriză pentru data viitoare. ❤️</p>
      <p style="margin:0;color:#5C5254;font-size:14px;">Te-ai răzgândit? Îți poți schimba răspunsul pe <a href="${SITE}/confirma-prezenta/" style="color:#C40000;">giftme.site/confirma-prezenta</a>.</p>`);
    MailApp.sendEmail(values.email, 'Am primit răspunsul tău – GiftMe!', plainText(values, nr, coming), options);
  }
}

/** Rulată automat de declanșatorul creat cu setupReminderTrigger(). */
function sendReminders() {
  if (new Date() > EVENT.start) return;
  const sheet = getSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  const rows = sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues();
  rows.forEach((r, i) => {
    if (r[COL.prezenta - 1] !== 'Da' || r[COL.reminder - 1] || !r[COL.email - 1]) return;
    const row = i + 2;
    try {
      MailApp.sendEmail(String(r[COL.email - 1]), 'Mâine ne vedem la deschiderea GiftMe! 🎁', [
        `Bună, ${r[COL.nume - 1]}!`,
        `Îți amintim că mâine, ${EVENT.date}, la ora ${EVENT.time}, te așteptăm la ${EVENT.place}, ${EVENT.address}.`,
        `Hartă: ${EVENT.mapUrl}`,
        'Te așteptăm cu surprize și voie bună!',
        'Echipa GiftMe!',
      ].join('\n\n'), {
        name: SENDER_NAME,
        replyTo: REPLY_TO,
        attachments: [icsBlob()],
        htmlBody: layout(`
          <p style="margin:0 0 6px;font-size:28px;font-weight:700;color:#F90100;">Ne vedem mâine! ⏰</p>
          <p style="margin:0 0 20px;">Bună, ${escapeHtml(r[COL.nume - 1])}! Îți amintim că mâine te așteptăm la marea deschidere GiftMe!</p>
          ${ticket(escapeHtml(r[COL.nume - 1]), r[COL.nr - 1])}
          ${calendarButtons()}`),
      });
      sheet.getRange(row, COL.reminder).setValue(new Date());
    } catch (err) {
      console.error(err);
      sheet.getRange(row, COL.reminder).setValue('eroare: ' + err.message);
    }
  });
}

/** Rulează o singură dată din editor: programează reamintirea pentru 1 noiembrie, ora 10:00. */
function setupReminderTrigger() {
  ScriptApp.getProjectTriggers()
    .filter((t) => t.getHandlerFunction() === 'sendReminders')
    .forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('sendReminders').timeBased().at(EVENT.reminderAt).create();
}

/** Test: trimite cele două emailuri către adresa GiftMe, fără să scrie în foaie. */
function testEmails() {
  const sample = { nume: 'Ana Popescu', email: REPLY_TO, prezenta: 'Da' };
  sendConfirmation(sample, 7);
  sendConfirmation(Object.assign({}, sample, { prezenta: 'Nu' }), 7);
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

function ticket(name, nr) {
  const nrLabel = nr ? 'Nr. ' + String(nr).padStart(3, '0') : '';
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FDECEC;border:3px solid #111111;border-radius:16px;">
    <tr><td style="padding:18px 20px;">
      <p style="margin:0;color:#C40000;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">Bilet de invitat ${nrLabel ? '· ' + nrLabel : ''}</p>
      <p style="margin:6px 0 14px;font-size:26px;font-weight:700;">${name}</p>
      <p style="margin:0 0 4px;"><strong>📅 ${capitalize(EVENT.date)}</strong>, ora ${EVENT.time}</p>
      <p style="margin:0;"><strong>📍 ${EVENT.place}</strong><br><span style="color:#5C5254;">${EVENT.address}</span> · <a href="${EVENT.mapUrl}" style="color:#C40000;">hartă</a></p>
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
  </p>
  <p style="margin:10px 0 0;color:#5C5254;font-size:13px;">Evenimentul e atașat și ca fișier .ics. Deschide-l ca să-l salvezi în calendarul tău.</p>`;
}

function plainText(values, nr, coming) {
  if (!coming) {
    return `Mulțumim că ne-ai anunțat, ${values.nume}! Ne pare rău că nu poți ajunge la deschiderea GiftMe!. Te-ai răzgândit? ${SITE}/confirma-prezenta/`;
  }
  return [
    `Super, ${values.nume}! Ne vedem la deschiderea GiftMe!`,
    `Bilet de invitat${nr ? ' nr. ' + String(nr).padStart(3, '0') : ''}`,
    `${capitalize(EVENT.date)}, ora ${EVENT.time}`,
    `${EVENT.place}, ${EVENT.address}`,
    `Hartă: ${EVENT.mapUrl}`,
    'Evenimentul pentru calendar este atașat (fișier .ics).',
  ].join('\n');
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
