// Rulează: node apps-script/v2/test/test-v2.js  (Cod.gs și rsvp.gs pe servicii Google simulate, cu ceas controlat)
const assert = require('assert');
const zlib = require('zlib');
const fs = require('fs');
const { createWorld } = require('./gas-harness');

const REPO = require('path').join(__dirname, '../../../') + '/';
const NEW = [REPO + 'apps-script/v2/QR.gs', REPO + 'apps-script/v2/Cod.gs'];
const OLD = [REPO + 'apps-script/rsvp.gs'];
let passed = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); passed++; };
const eq = (a, b, msg) => { assert.deepStrictEqual(a, b, msg); passed++; };

const C = { sent: 0, nume: 1, email: 2, prezenta: 3, updated: 4, nr: 5, confirm: 6, r1nov: 7, code: 8, yesSince: 9, qrSent: 10, r29oct: 11, r0730: 12, r0900: 13, came: 14, cameAt: 15, cameVia: 16, followup: 17, optOut: 18, team: 19 };

/* ---------- 1. Old sheet with old rows, migrated by setup() ---------- */
const w = createWorld();
w.load(...NEW);
Object.assign(w.props, {
  MOD_TEST: 'da', TEST_EMAIL: 'tester@gmail.com', TEAM_EMAIL: 'tester+echipa@gmail.com', STAFF_PIN: '482913',
  WEB_APP_URL: 'https://script.google.com/macros/s/NEWID/exec', SITE_URL: 'https://giftme-git-dev.vercel.app',
});
// The old script's layout and two rows it wrote (col 5 empty on new rows, as the old appendRow did).
const old = w.ctx.SpreadsheetApp.getActiveSpreadsheet().insertSheet('Confirmări');
const D = (iso) => new w.Date(iso);
old.appendRow(['Trimis la', 'Nume, prenume', 'Email', 'Prezent(ă)', 'Actualizat la', 'Nr. invitat', 'Confirmare trimisă', 'Reamintire trimisă']);
old.appendRow([D('2026-10-20T10:00:00+03:00'), 'Ion Vechi', 'tester+vechi@gmail.com', 'Da', '', 1, D('2026-10-20T10:00:05+03:00'), '']);
old.appendRow([D('2026-10-21T10:00:00+03:00'), 'Maria Nu', 'tester+nu@gmail.com', 'Nu', '', 2, D('2026-10-21T10:00:05+03:00'), '']);

w.at('2026-10-25T12:00:00+02:00');
w.ctx.setup();
eq(w.sheet().cells[0].length, 20, 'setup adds 12 columns');
eq(w.sheet().cells[0][7], 'Reamintire 1 nov', 'col 8 renamed, same position');
ok(/^[0-9a-f]{32}$/.test(w.rows()[0][C.code]), 'old row got a 128-bit hex code');
ok(w.rows()[0][C.yesSince] instanceof w.Date, 'old Da row got "Da din"');
eq(w.rows()[1][C.yesSince], undefined, 'Nu row has no "Da din"');
eq(w.tz, 'Europe/Chisinau', 'sheet time zone set');
const fmt = (d) => w.ctx.fmtDateTime_(d);
eq(w.triggers.map((t) => fmt(t.at)), [
  '29.10.2026 10:00', '29.10.2026 10:15', '01.11.2026 16:00', '01.11.2026 16:15',
  '02.11.2026 07:30', '02.11.2026 07:45', '02.11.2026 09:00', '02.11.2026 09:15',
], 'eight triggers at the planned Chișinău times');
ok(w.sheet().validation['2:15'] === 'checkbox', 'Venit? has checkbox validation');
eq(w.sheet().getLastRow(), 3, 'checkbox validation does not move getLastRow');

/* ---------- 2. Sign-up: ticket with QR + team notice ---------- */
w.mails = [];
let res = w.rsvp('Ana Test', 'tester+ana@gmail.com', 'Da');
eq(res.ok, true, 'rsvp ok'); eq(res.emailSent, true, 'email sent'); eq(res.nr, 3, 'nr = row-1 like before');
const ana = () => w.rows().find((r) => r[C.email] === 'tester+ana@gmail.com');
eq(w.mails.length, 2, 'guest ticket + team notice');
const ticketMail = w.mails[0];
eq(ticketMail.to, 'tester+ana@gmail.com');
ok(ticketMail.options.inlineImages && ticketMail.options.inlineImages.qr, 'QR is an inline image');
ok(ticketMail.options.htmlBody.includes('cid:qr'), 'HTML references cid:qr');
ok(ticketMail.options.htmlBody.includes('CEEF, Cabinetul 223') && ticketMail.options.htmlBody.includes('09:30'), 'ticket has place and time');
ok(ticketMail.options.htmlBody.includes('?stop=' + ana()[C.code]), 'stop link present');
ok(ticketMail.body.includes('joi, 29 octombrie; duminică, 1 noiembrie; luni, 2 noiembrie, la 07:30 și luni, 2 noiembrie, la 09:00'), 'lists the four reminders');
eq(w.mails[1].to, 'tester+echipa@gmail.com', 'team notice goes to TEAM_EMAIL');
ok(w.mails[1].subject.includes('RSVP Da: Ana Test (răspuns nou)'), 'team subject');
ok(w.mails[1].body.includes('tester+ana@gmail.com') && w.mails[1].body.includes('2 × Da, 1 × Nu'), 'team body has email + totals');
ok(ana()[C.qrSent] instanceof w.Date && ana()[C.team] instanceof w.Date, 'qrSent + team recorded');

// QR: decode the PNG and compare with the matrix; it must carry only the ticket URL.
const png = Buffer.from(ticketMail.options.inlineImages.qr.data.map((b) => (b + 256) % 256));
eq([...png.slice(0, 8)], [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A], 'PNG signature');
const width = png.readUInt32BE(16);
let off = 8; let idat = Buffer.alloc(0);
while (off < png.length) {
  const len = png.readUInt32BE(off); const type = png.slice(off + 4, off + 8).toString();
  const data = png.slice(off + 8, off + 8 + len);
  const crc = png.readUInt32BE(off + 8 + len);
  eq(crc, zlib.crc32(png.slice(off + 4, off + 8 + len)), 'chunk CRC ' + type);
  if (type === 'IDAT') idat = Buffer.concat([idat, data]);
  off += 12 + len;
}
const raw = zlib.inflateSync(idat); // also verifies the Adler-32
const url = 'https://giftme-git-dev.vercel.app/confirma-prezenta/intrare/#' + ana()[C.code];
const m = w.ctx.GiftMeQR.matrix(url);
const rowBytes = Math.ceil(width / 8);
let mismatch = 0;
for (let y = 0; y < width; y++) for (let x = 0; x < width; x++) {
  const white = (raw[y * (rowBytes + 1) + 1 + (x >> 3)] >> (7 - (x & 7))) & 1;
  const mx = Math.floor(x / 8) - 4; const my = Math.floor(y / 8) - 4;
  const dark = mx >= 0 && my >= 0 && mx < m.size && my < m.size && m.dark(mx, my);
  if (dark === Boolean(white)) mismatch++;
}
eq(mismatch, 0, 'PNG pixels equal the QR matrix');


ok(!url.includes('ana') && !url.toLowerCase().includes('test'), 'QR URL has no name or email');

// Same answer again: no guest email, team still notified.
w.mails = [];
res = w.rsvp('Ana Test', 'tester+ana@gmail.com', 'Da');
eq(res.emailSent, false); eq(w.mails.length, 1); ok(w.mails[0].subject.includes('același răspuns'), 'resubmit notice');

// Test mode blocks any other recipient.
w.mails = [];
res = w.rsvp('Străin', 'cineva@exemplu.com', 'Da');
eq(w.mails.filter((x) => x.to === 'cineva@exemplu.com').length, 0, 'test mode blocks real addresses');
ok(String(w.rows().find((r) => r[C.email] === 'cineva@exemplu.com')[C.confirm]).startsWith('eroare: blocat'), 'blocked recorded');
// Remove that row's Da so it doesn't pollute the reminders below.
w.rows().find((r) => r[C.email] === 'cineva@exemplu.com')[C.prezenta] = 'Nu';

/* ---------- 3. Reminder 1, twice; late sign-up ---------- */
w.at('2026-10-29T10:00:20+02:00');
w.mails = [];
w.ctx.ruleazaReamintiri();
eq(w.mails.map((x) => x.to).sort(), ['tester+ana@gmail.com', 'tester+vechi@gmail.com'], 'R1 to the two Da guests');
ok(w.mails[0].subject.includes('Luni ne vedem'), 'R1 subject');
ok(w.mails.every((x) => x.options.inlineImages.qr && x.options.htmlBody.includes('str. Miron Costin 26/2') && x.options.htmlBody.includes('09:30') && x.options.htmlBody.includes('STOP')), 'R1: address, time, QR, stop line');
w.at('2026-10-29T10:15:20+02:00');
w.mails = [];
w.ctx.ruleazaReamintiri();
w.ctx.ruleazaReamintiri();
eq(w.mails.length, 0, 'R1 retry and a duplicate run send nothing');

w.at('2026-10-29T11:00:00+02:00');
w.mails = [];
w.rsvp('Bogdan Târziu', 'tester+bogdan@gmail.com', 'Da');
const bogdan = () => w.rows().find((r) => r[C.email] === 'tester+bogdan@gmail.com');
eq(bogdan()[C.r29oct], 'nu: confirmat după ora reamintirii', 'late sign-up skips R1');
ok(w.mails[0].body.includes('Îți trimitem reamintiri: duminică, 1 noiembrie; luni, 2 noiembrie, la 07:30 și luni, 2 noiembrie, la 09:00'), 'late sign-up told only the remaining reminders');

/* ---------- 4. Reminder 2 at 16:00 (old 10:00 trigger deleted at release) ---------- */
w.at('2026-11-01T10:00:00+02:00');
w.mails = [];
w.ctx.ruleazaReamintiri();
eq(w.mails.length, 0, 'nothing at 10:00: still the 29 Oct window, already sent');
w.at('2026-11-01T16:00:30+02:00');
w.mails = [];
w.ctx.ruleazaReamintiri();
eq(w.mails.length, 3, 'R2 at 16:00 to vechi, ana, bogdan');
ok(w.mails.every((x) => x.subject.includes('Mâine')), 'R2 subject');
w.at('2026-11-01T16:15:30+02:00');
w.mails = [];
w.ctx.ruleazaReamintiri();
eq(w.mails.length, 0, 'R2 backup at 16:15 sends nothing new');
// Why the old trigger must go: if it is left, it sends the old reminder (no QR) at 10:00 and the new one skips.
const k = createWorld(); k.load(...NEW);
k.at('2026-10-26T12:00:00+02:00'); k.ctx.setup();
k.rsvp('Rămas Vechi', 'r@x.md', 'Da');
const kOld = createWorld(); kOld.sheets = k.sheets; kOld.load(...OLD);
kOld.at('2026-11-01T10:00:00+02:00'); kOld.ctx.sendReminders();
eq(kOld.mails.length, 1, 'old 10:00 trigger, if not deleted, sends its old reminder');
k.at('2026-11-01T16:00:30+02:00'); k.mails = []; k.ctx.ruleazaReamintiri();
eq(k.mails.length, 0, '…and the new 16:00 reminder then skips that guest');
eq(k.ctx.warnings1Nov_(k.ctx.time1Nov_('16:00')).length, 2, 'setup warns about both: old trigger and quota');

/* ---------- 5. Unsubscribe ---------- */
const anaCode = ana()[C.code];
let page = w.ctx.doGet({ parameter: { stop: anaCode } });
ok(page.html.includes('ok=1') && ana()[C.optOut] === '', 'first click only asks');
page = w.ctx.doGet({ parameter: { stop: anaCode, ok: '1' } });
ok(page.html.includes('Gata') && ana()[C.optOut] instanceof w.Date, 'second click opts out');

/* ---------- 6. Reminder 3 ---------- */
w.at('2026-11-02T07:30:10+02:00');
w.mails = [];
w.ctx.ruleazaReamintiri();
eq(w.mails.map((x) => x.to).sort(), ['tester+bogdan@gmail.com', 'tester+vechi@gmail.com'], 'R3 skips the opted-out guest');
eq(ana()[C.r0730], 'nu: a cerut să nu mai primească emailuri');

/* ---------- 7. Check-in ---------- */
const bCode = bogdan()[C.code];
eq(w.post({ action: 'verify', code: bCode }), { ok: true, status: 'valid' }, 'verify without PIN: valid, no name');
eq(bogdan()[C.came], false, 'verify marks nothing');
eq(w.post({ action: 'checkin', code: bCode, pin: '000000' }), { ok: false, error: 'wrong_pin' }, 'wrong PIN refused');
eq(bogdan()[C.came], false, 'wrong PIN marks nothing');
w.at('2026-11-02T08:50:00+02:00');
eq(w.post({ action: 'checkin', code: bCode, pin: '482913' }), { ok: true, status: 'checked_in', name: 'Bogdan Târziu', at: '08:50', answer: 'Da' }, 'check-in');
eq(bogdan()[C.came], true); eq(bogdan()[C.cameVia], 'scanare');
w.at('2026-11-02T08:55:00+02:00');
eq(w.post({ action: 'checkin', code: bCode, pin: '482913' }).status, 'already', 'second scan: already');
eq(w.post({ action: 'checkin', code: bCode, pin: '482913' }).at, '08:50', 'already shows first time');
eq(w.post({ action: 'checkin', code: 'f'.repeat(32), pin: '482913' }), { ok: true, status: 'unknown' }, 'unknown code');
eq(w.post({ action: 'verify', code: 'nu-e-cod' }), { ok: true, status: 'unknown' }, 'malformed code');

// Manual tick by hand (onEdit) on the old guest, then untick, then tick again.
const sh = w.sheet();
const vechiRow = 2;
sh.getRange(vechiRow, 15).setValue(true);
w.ctx.onEdit({ range: sh.getRange(vechiRow, 15) });
eq(sh.getRange(vechiRow, 17).getValue(), 'manual', 'hand tick → manual');
sh.getRange(vechiRow, 15).setValue(false);
w.ctx.onEdit({ range: sh.getRange(vechiRow, 15) });
eq(sh.getRange(vechiRow, 16).getValue(), '', 'untick clears the time');

/* ---------- 8. Reminder 4: checked-in guest skipped; nothing after 09:30 ---------- */
w.at('2026-11-02T09:00:05+02:00');
w.mails = [];
w.ctx.ruleazaReamintiri();
eq(w.mails.map((x) => x.to), ['tester+vechi@gmail.com'], 'R4 only to the guest not yet in');
eq(bogdan()[C.r0900], 'nu: a venit deja');
w.at('2026-11-02T09:31:00+02:00');
w.mails = [];
w.ctx.ruleazaReamintiri();
eq(w.mails.length, 0, 'no reminder after the start');

/* ---------- 9. Follow-up ---------- */
w.at('2026-11-02T13:00:00+02:00');
w.uiAnswer = { button: 'OK', text: 'nu' };
w.mails = [];
w.ctx.trimiteFollowUp();
eq(w.mails.length, 0, 'follow-up needs GATA');
w.props.FORM_REVIEW_URL = 'https://forms.gle/review';
w.props.FORM_ABSENT_URL = 'https://forms.gle/absent';
w.uiAnswer = { button: 'OK', text: 'gata' };
w.ctx.trimiteFollowUp();
eq(w.mails.map((x) => [x.to, x.options.htmlBody.includes('forms.gle/review') ? 'review' : 'absent']).sort(),
  [['tester+bogdan@gmail.com', 'review'], ['tester+vechi@gmail.com', 'absent']], 'came → review, Da absent → absent, opted-out and Nu → nothing');
w.mails = [];
w.ctx.trimiteFollowUp();
eq(w.mails.length, 0, 'follow-up never twice');
// Outside test mode it refuses before the event.
const w2 = createWorld(); w2.load(...NEW); w2.props.FORM_REVIEW_URL = 'x'; w2.props.FORM_ABSENT_URL = 'y';
w2.at('2026-11-02T09:00:00+02:00'); w2.ctx.getSheet(); w2.ctx.trimiteFollowUp();
ok(w2.alerts[0].includes('doar după eveniment') && w2.mails.length === 0, 'live: no follow-up before the event');

/* ---------- 10. Rollback guard (live mode) ---------- */
const g = createWorld(); g.load(...NEW);
Object.assign(g.props, { WEB_APP_URL: 'https://script.google.com/macros/s/NEWID/exec', TEAM_EMAIL: 'echipa@x.md' });
g.at('2026-10-26T12:00:00+02:00');
g.ctx.setup();
g.rsvp('Guest Live', 'guest@x.md', 'Da');
const cfg = (live) => `var RSVP_ENDPOINTS = {\n\tlive: 'https://script.google.com/macros/s/${live}/exec',\n\tliveCheckin: 'https://script.google.com/macros/s/NEWID/exec',\n\ttest: '',\n};`;
g.at('2026-10-29T10:00:30+02:00');
g.fetch = () => ({ code: 200, text: cfg('OLDID') }); // rolled back
g.mails = [];
g.ctx.ruleazaReamintiri();
eq(g.mails.map((x) => x.to), ['echipa@x.md'], 'rolled back: no reminder, one alert to the team');
ok(g.mails[0].subject.includes('NU a fost trimisă'), 'alert subject');
g.at('2026-10-29T10:15:30+02:00');
g.mails = [];
g.ctx.ruleazaReamintiri();
eq(g.mails.length, 0, 'alert only once per reminder');
g.at('2026-11-01T16:00:30+02:00'); // still rolled back
g.mails = [];
g.ctx.ruleazaReamintiri();
eq(g.mails.map((x) => x.to), ['guest@x.md'], 'rolled back: the 1 Nov reminder still goes (old trigger deleted)');
g.fetch = () => ({ code: 200, text: cfg('NEWID') }); // site uses the new script
g.fetch = () => ({ code: 503, text: '' }); // site unreachable → send anyway
g.at('2026-11-02T07:30:30+02:00');
g.mails = [];
g.ctx.ruleazaReamintiri();
eq(g.mails.map((x) => x.to), ['guest@x.md'], 'site unreachable: still sends (fail-open)');

/* ---------- 11. Quota: team notices yield, reminders stop and alert ---------- */
const q = createWorld(); q.load(...NEW);
Object.assign(q.props, { TEAM_EMAIL: 'echipa@x.md' });
q.at('2026-11-01T08:00:00+02:00'); q.ctx.setup();
for (let i = 0; i < 6; i++) q.rsvp('Invitat ' + 'abcdef'[i], `g${i}@x.md`, 'Da');
q.quota = 15;
q.mails = [];
q.rsvp('Ultim Moment', 'last@x.md', 'Da');
eq(q.mails.map((x) => x.to), ['last@x.md'], 'low quota on the eve: guest confirmation yes, team notice no');
ok(String(q.rows().find((r) => r[C.email] === 'last@x.md')[C.team]).startsWith('sărită'), 'skip recorded');
q.quota = 5;
q.at('2026-11-02T07:30:30+02:00');
q.mails = [];
q.ctx.ruleazaReamintiri();
eq(q.mails.filter((x) => !x.subject.includes('⚠️')).length, 3, '3 reminders, then keep 2 for alerts');
eq(q.mails.filter((x) => x.subject.includes('⚠️')).length, 1, 'the kept quota carries the alert');
ok(q.rows().filter((r) => String(r[C.r0730]).includes('cota')).length === 4, 'quota-starved rows marked as retryable errors');
q.quota = 50;
q.at('2026-11-02T07:45:30+02:00');
q.mails = [];
q.ctx.ruleazaReamintiri();
eq(q.mails.filter((x) => !x.subject.includes('⚠️')).length, 4, 'retry trigger sends the 4 left, none twice');

/* ---------- 11b. Quota with 1 Nov at 16:00: three reminders in 17 hours ---------- */
function threeReminders(n) {
  const z = createWorld(); z.load(...NEW);
  Object.assign(z.props, { TEAM_EMAIL: 'echipa@x.md' });
  z.at('2026-10-30T12:00:00+02:00'); z.ctx.setup();
  for (let i = 0; i < n; i++) z.rsvp('Invitat', `g${i}@x.md`, 'Da');
  z.quota = 100; // worst case: the 1 Nov, 07:30 and 09:00 emails all count against one 100-email window
  const sent = {};
  [['r1nov', '2026-11-01T16:00:30+02:00'], ['r0730', '2026-11-02T07:30:30+02:00'], ['r0900', '2026-11-02T09:00:30+02:00'], ['retry', '2026-11-02T09:15:30+02:00']].forEach(([id, at]) => {
    z.at(at); z.mails = []; z.ctx.ruleazaReamintiri();
    sent[id] = { guests: z.mails.filter((x) => !x.subject.includes('⚠️')).length, alerts: z.mails.filter((x) => x.subject.includes('⚠️')).length };
  });
  return { sent, missed: z.rows().filter((r) => String(r[C.r0900]).includes('cota')).length, quota: z.quota };
}
// Team notices: on Sunday at 09:00 all three reminders are in the next 24 h → 31 "Da" guests block them.
const tn = createWorld(); tn.load(...NEW); Object.assign(tn.props, { TEAM_EMAIL: 'echipa@x.md' });
tn.at('2026-10-30T12:00:00+02:00'); tn.ctx.setup();
for (let i = 0; i < 30; i++) tn.rsvp('Invitat', `t${i}@x.md`, 'Da');
tn.quota = 100; tn.at('2026-11-01T09:05:00+02:00'); tn.mails = [];
tn.rsvp('Al Treizecilea', 't30@x.md', 'Da');
eq(tn.mails.map((x) => x.to), ['t30@x.md'], 'Sunday 09:05, 31st guest: confirmation yes, team notice skipped');
let r32 = threeReminders(32);
eq([r32.sent.r1nov.guests, r32.sent.r0730.guests, r32.sent.r0900.guests, r32.missed], [32, 32, 32, 0], '32 guests: all three reminders fit');
let r33 = threeReminders(33);
eq([r33.sent.r0900.guests, r33.missed, r33.sent.r0900.alerts], [32, 1, 1], '33 guests: 1 misses 09:00 (2 kept for alerts), team alerted');
let r34 = threeReminders(34);
eq([r34.sent.r0900.guests, r34.missed], [30, 4], '34 guests (102 emails): 4 miss 09:00');
let r40 = threeReminders(40);
eq([r40.sent.r1nov.guests, r40.sent.r0730.guests, r40.sent.r0900.guests, r40.missed], [40, 40, 18, 22], '40 guests: 22 miss the 09:00 reminder');
eq(r40.sent.retry.guests, 0, 'the 09:15 backup cannot send them either');

/* ---------- 12. Trigger error → alert ---------- */
const e = createWorld(); e.load(...NEW);
Object.assign(e.props, { MOD_TEST: 'da', TEST_EMAIL: 'tester@gmail.com', TEAM_EMAIL: 'tester@gmail.com' });
e.ctx.testEroareDeclansator();
ok(e.mails.length === 1 && e.mails[0].subject.includes('Eroare la test'), 'trigger error alert');

/* ---------- 13. Old script still works on the new sheet (rollback) ---------- */
const o = createWorld(); o.sheets = w.sheets; o.load(...OLD);
o.at('2026-11-02T10:00:00+02:00');
const before = w.sheet().getLastRow();
const r = JSON.parse(o.ctx.doPost({ postData: { contents: JSON.stringify({ nume: 'După Revenire', email: 'tester+dupa@gmail.com', prezenta: 'Da', t: 5000, cid: 'x' }) } }).text);
eq(r.ok, true, 'old doPost works on the 20-column sheet');
eq(w.sheet().getLastRow(), before + 1, 'old script appends one row');
eq(w.rows()[w.rows().length - 1][C.nr], before, 'numbering continues');


/* ---------- 14. ORA_REAMINTIRE_1NOV ---------- */
const t = createWorld(); t.load(...NEW);
t.at('2026-10-26T12:00:00+02:00');
t.props.ORA_REAMINTIRE_1NOV = '8:30';
t.ctx.setup();
eq(t.triggers.map((x) => t.ctx.fmtDateTime_(x.at)).slice(2, 4), ['01.11.2026 08:30', '01.11.2026 08:45'], 'setting moves both 1 Nov triggers');
t.rsvp('Ora Test', 'ora@x.md', 'Da');
t.at('2026-11-01T07:00:30+02:00'); t.mails = []; t.ctx.ruleazaReamintiri();
ok(t.mails.every((x) => !x.subject.includes('Mâine')), 'nothing at 07:00');
t.at('2026-11-01T08:30:30+02:00'); t.mails = []; t.ctx.ruleazaReamintiri();
eq(t.mails.map((x) => x.subject.includes('Mâine')), [true], '1 Nov reminder at 08:30');
// Changed without setup: no effect, and the menu says so.
t.props.ORA_REAMINTIRE_1NOV = '09:15';
eq(t.ctx.fmtDateTime_(t.ctx.currentReminder_(new t.Date('2026-11-01T09:20:00+02:00')).at), '01.11.2026 08:30', 'needs setup to apply');
t.ctx.arataReamintirile();
ok(t.alerts.some((a) => a.includes('Rulează setup')), 'warns that setup is needed');
// Invalid value: setup stops before touching anything.
t.props.ORA_REAMINTIRE_1NOV = 'dimineața';
const triggersBefore = t.triggers.length;
assert.throws(() => t.ctx.setup(), /ORA_REAMINTIRE_1NOV/); passed++;
eq(t.triggers.length, triggersBefore, 'invalid value leaves triggers alone');
eq(t.ctx.warnings1Nov_(t.ctx.time1Nov_('07:00')).length, 0, '07:00: no warning');
eq(t.ctx.warnings1Nov_(t.ctx.time1Nov_('08:00')).length, 1, '08:00: quota warning');
eq(t.ctx.warnings1Nov_(t.ctx.time1Nov_('18:00')).length, 2, '18:00: old-trigger + quota warnings');


/* ---------- 16. FALSE checkboxes on 1000 empty rows (the bug from the test copy) ---------- */
// The state the earlier setup left: v2 headers, checkbox rule + FALSE on rows 2–1000, the first sign-up at 1001.
const V2_HEADERS = w.sheet().cells[0]; // the 20 headers written by setup in section 1
function buggySheet() {
  const b = createWorld(); b.load(...NEW);
  Object.assign(b.props, { TEAM_EMAIL: 'echipa@x.md' });
  const sh = b.ctx.SpreadsheetApp.getActiveSpreadsheet().insertSheet('Confirmări');
  sh.getRange(1, 1, 1, 20).setValues([V2_HEADERS]);
  sh.getRange(2, 15, 999, 1).setDataValidation('checkbox'); // Google writes FALSE into all of them
  return { b, sh };
}
{
  const { b, sh } = buggySheet();
  eq(sh.getLastRow(), 1000, 'reproduced: FALSE values make getLastRow() 1000');
  b.at('2026-10-26T12:00:00+02:00');
  b.rsvp('Prima Persoana', 'p1@x.md', 'Da');
  eq(sh.cells[1][2], 'p1@x.md', 'even before setup cleans up, a sign-up goes to row 2');
  eq(sh.cells[1][5], 1, 'and gets Nr. 1');
  b.rsvp('A Doua', 'p2@x.md', 'Da');
  eq(sh.cells[2][2], 'p2@x.md', 'next one to row 3');
  eq(b.ctx.readRows_(sh).length, 2, 'the 998 FALSE rows are not guests');
  b.ctx.verificaCota();
  ok(b.alerts.some((a) => a.includes('Invitați cu „Da” care primesc reamintiri: 2.')), 'Da count ignores the FALSE rows');
  b.at('2026-10-29T10:00:30+02:00'); b.mails = []; b.ctx.ruleazaReamintiri();
  eq(b.mails.filter((m) => !m.subject.includes('⚠️')).length, 2, 'reminder only to the 2 guests');
  // setup cleans up.
  b.at('2026-10-29T12:00:00+02:00');
  b.ctx.setup();
  eq(sh.getLastRow(), 3, 'after setup: last row = last guest');
  eq(sh.cells.slice(3).some((r) => r && r[14] === false), false, 'no FALSE left on empty rows');
  eq([Boolean(sh.validation['2:15']), Boolean(sh.validation['3:15']), Boolean(sh.validation['4:15']), Boolean(sh.validation['1000:15'])], [true, true, false, false], 'checkbox only on guest rows');
  // The old script (rollback) now appends at row 4 again.
  const o2 = createWorld(); o2.sheets = b.sheets; o2.load(...OLD);
  o2.at('2026-10-29T13:00:00+02:00');
  JSON.parse(o2.ctx.doPost({ postData: { contents: JSON.stringify({ nume: 'Script Vechi', email: 'v@x.md', prezenta: 'Da', t: 5000, cid: 'z' }) } }).text);
  eq(sh.cells[3][2], 'v@x.md', 'old script appends right under the guests after cleanup');
}
{
  // The test copy as it is now: rows 2–1000 FALSE, the real sign-up at row 1001 with Nr. 1000.
  const { b, sh } = buggySheet();
  sh.getRange(1001, 1, 1, 20).setValues([[new b.Date('2026-10-25T18:00:00+02:00'), 'Test Copie', 'tester@gmail.com', 'Da', '', 1000, new b.Date(), '', 'c'.repeat(32), new b.Date('2026-10-25T18:00:00+02:00'), new b.Date(), '', '', '', false, '', '', '', '', new b.Date()]]);
  b.at('2026-10-26T12:00:00+02:00');
  b.ctx.setup();
  eq(sh.getLastRow(), 1001, 'setup keeps the guest at 1001');
  eq(sh.cells.slice(1, 1000).some((r) => r && r[14] === false), false, 'and clears FALSE on rows 2–1000');
  b.rsvp('Urmatorul', 'n@x.md', 'Da');
  eq([sh.cells[1][2], sh.cells[1][5]], ['n@x.md', 1001], 'next sign-up fills row 2; number = highest + 1 (fix Nr. 1000 → 1 by hand)');
}
{
  // The live Sheet shape: old 8-column layout, 6 guests, no checkboxes.
  const l = createWorld(); l.load(...NEW);
  Object.assign(l.props, { TEAM_EMAIL: 'echipa@x.md', WEB_APP_URL: 'https://script.google.com/macros/s/NEWID/exec' });
  const sh = l.ctx.SpreadsheetApp.getActiveSpreadsheet().insertSheet('Confirmări');
  sh.appendRow(['Trimis la', 'Nume, prenume', 'Email', 'Prezent(ă)', 'Actualizat la', 'Nr. invitat', 'Confirmare trimisă', 'Reamintire trimisă']);
  for (let i = 1; i <= 6; i++) sh.appendRow([new l.Date('2026-10-20T10:00:00+03:00'), 'Invitat Live', `l${i}@x.md`, i % 3 ? 'Da' : 'Nu', '', i, new l.Date(), '']);
  l.at('2026-10-27T12:00:00+02:00');
  l.ctx.setup();
  eq(sh.getLastRow(), 7, 'live: still 7 rows after setup');
  eq([2, 3, 4, 5, 6, 7].every((r) => sh.validation[r + ':15']), true, 'live: checkbox on the 6 guest rows');
  eq(Object.keys(sh.validation).filter((k) => k.endsWith(':15')).length, 6, 'live: and nowhere else');
  l.rsvp('Nou Live', 'nou@x.md', 'Da');
  eq([sh.cells[7][2], sh.cells[7][5]], ['nou@x.md', 7], 'live: first new sign-up on row 8, Nr. 7');
  // Walk-in written by hand on row 9: gets the checkbox; ticking fills the time.
  sh.getRange(9, 2, 1, 3).setValues([['Fara Bilet', '', 'Da']]);
  l.ctx.onEdit({ range: sh.getRange(9, 2, 1, 3) });
  ok(sh.validation['9:15'], 'walk-in row gets the checkbox');
  sh.getRange(9, 15).setValue(true); l.ctx.onEdit({ range: sh.getRange(9, 15) });
  eq(sh.getRange(9, 17).getValue(), 'manual', 'walk-in ticked by hand');
  // A box unticked on an empty row is cleared, so the row stays free.
  sh.getRange(12, 15).setValue(false); l.ctx.onEdit({ range: sh.getRange(12, 15) });
  eq(sh.getRange(12, 15).getValue(), '', 'FALSE on an empty row is cleared');
  // A box ticked on an empty row is kept and never overwritten.
  sh.getRange(10, 15).setValue(true); l.ctx.onEdit({ range: sh.getRange(10, 15) });
  l.rsvp('Altul Live', 'altul@x.md', 'Da');
  eq(sh.cells[9][14], true, 'a hand-ticked empty row is not overwritten');
  eq(sh.cells[10][2], 'altul@x.md', 'the sign-up goes to the next blank row (11)');
  l.ctx.setup();
  ok(l.ctx.fixCheckboxes_(sh).kept.includes(10), 'setup reports the hand-ticked row instead of touching it');
}

console.log(`OK – ${passed} verificări`);
