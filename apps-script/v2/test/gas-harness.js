// Fake Google Apps Script services, enough to run Cod.gs / rsvp.gs in Node with a controllable clock.
const vm = require('vm');
const fs = require('fs');
const crypto = require('crypto');

function createWorld() {
  const world = {
    now: new Date('2026-10-25T12:00:00+02:00').getTime(),
    mails: [],
    quota: 100,
    props: {},
    cache: {},
    triggers: [],
    fetch: () => ({ code: 404, text: '' }),
    uiAnswer: { button: 'OK', text: 'GATA' },
    alerts: [],
    sheets: {},
    tz: 'Etc/UTC',
  };
  const RealDate = Date;
  class FakeDate extends RealDate {
    constructor(...a) { if (a.length === 0) super(world.now); else super(...a); }
    static now() { return world.now; }
  }
  world.Date = FakeDate;

  function makeSheet(name) {
    const cells = []; // cells[r][c], 0-based
    const validation = {};
    let maxCols = 26;
    let maxRows = 1000;
    const get = (r, c) => (cells[r] && cells[r][c] !== undefined ? cells[r][c] : '');
    const set = (r, c, v) => { (cells[r] = cells[r] || [])[c] = v; };
    const sheet = {
      cells, validation,
      getName: () => name,
      getParent: () => ss,
      getLastRow() {
        for (let r = cells.length - 1; r >= 0; r--) if ((cells[r] || []).some((v) => v !== '' && v !== undefined && v !== null)) return r + 1;
        return 0;
      },
      getMaxRows: () => maxRows,
      getMaxColumns: () => maxCols,
      insertColumnsAfter(after, n) { maxCols += n; },
      insertRowsAfter(after, n) { maxRows += n; },
      setFrozenRows() {},
      appendRow(values) { const r = sheet.getLastRow(); values.forEach((v, i) => set(r, i, v)); if (r + 1 > maxRows) maxRows = r + 1; },
      getRange(row, col, nr = 1, nc = 1) {
        if (col + nc - 1 > maxCols) throw new Error('Range out of bounds (columns)');
        const range = {
          getRow: () => row, getColumn: () => col, getLastRow: () => row + nr - 1, getLastColumn: () => col + nc - 1,
          getSheet: () => sheet,
          getValues: () => Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => get(row - 1 + i, col - 1 + j))),
          getValue: () => get(row - 1, col - 1),
          setValues(v) { v.forEach((line, i) => line.forEach((x, j) => set(row - 1 + i, col - 1 + j, x === '' ? '' : x))); return range; },
          setValue(v) { for (let i = 0; i < nr; i++) for (let j = 0; j < nc; j++) set(row - 1 + i, col - 1 + j, v); return range; },
          setFontWeight: () => range,
          setNumberFormat: () => range,
          // Like real Google Sheets: a checkbox rule turns every empty cell it covers into FALSE.
          setDataValidation(rule) {
            for (let i = 0; i < nr; i++) for (let j = 0; j < nc; j++) {
              validation[(row + i) + ':' + (col + j)] = rule;
              if (rule === 'checkbox' && get(row - 1 + i, col - 1 + j) === '') set(row - 1 + i, col - 1 + j, false);
            }
            return range;
          },
          getDataValidation: () => validation[row + ':' + col] || null,
          clearDataValidations() { for (let i = 0; i < nr; i++) for (let j = 0; j < nc; j++) delete validation[(row + i) + ':' + (col + j)]; return range; },
          clearContent() { for (let i = 0; i < nr; i++) for (let j = 0; j < nc; j++) if (cells[row - 1 + i]) cells[row - 1 + i][col - 1 + j] = ''; return range; },
        };
        return range;
      },
    };
    return sheet;
  }
  const ss = {
    getSheetByName: (n) => world.sheets[n] || null,
    insertSheet: (n) => (world.sheets[n] = makeSheet(n)),
    getUrl: () => 'https://docs.google.com/spreadsheets/d/TEST',
    getId: () => 'TEST',
    getSpreadsheetTimeZone: () => world.tz,
    setSpreadsheetTimeZone: (tz) => { world.tz = tz; },
  };
  world.ss = ss;

  function formatDate(d, tz, pattern) {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
      timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    }).formatToParts(d).map((p) => [p.type, p.value]));
    return pattern.replace(/'([^']*)'|yyyy|MM|dd|HH|mm|ss/g, (m, lit) => (lit !== undefined ? lit
      : { yyyy: parts.year, MM: parts.month, dd: parts.day, HH: parts.hour, mm: parts.minute, ss: parts.second }[m]));
  }

  const ui = {
    ButtonSet: { OK_CANCEL: 'OK_CANCEL', YES_NO: 'YES_NO' },
    Button: { OK: 'OK', YES: 'YES', CANCEL: 'CANCEL' },
    alert: (...a) => { world.alerts.push(a.join(' | ')); return world.uiAnswer.button === 'OK' ? 'YES' : 'NO'; },
    prompt: (title, text) => { world.alerts.push('PROMPT ' + text); return { getSelectedButton: () => world.uiAnswer.button, getResponseText: () => world.uiAnswer.text }; },
    createMenu: () => { const m = { addItem: () => m, addSeparator: () => m, addSubMenu: () => m, addToUi: () => m }; return m; },
  };

  const ctx = {
    console: { log: () => {}, warn: () => {}, error: () => {} },
    Date: FakeDate,
    SpreadsheetApp: {
      getActiveSpreadsheet: () => ss,
      openById: () => ss,
      flush: () => {},
      newDataValidation: () => ({ requireCheckbox: () => ({ build: () => 'checkbox' }) }),
      getUi: () => ui,
    },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperties: () => ({ ...world.props }),
        getProperty: (k) => (k in world.props ? world.props[k] : null),
        setProperty: (k, v) => { world.props[k] = String(v); },
        setProperties: (o) => Object.assign(world.props, o),
      }),
    },
    CacheService: { getScriptCache: () => ({ get: (k) => world.cache[k] || null, put: (k, v) => { world.cache[k] = v; } }) },
    LockService: { getScriptLock: () => ({ waitLock: () => {}, releaseLock: () => {} }) },
    MailApp: {
      sendEmail(to, subject, body, options) {
        if (world.quota <= 0) throw new Error('Service invoked too many times for one day: email.');
        if (world.failFor && world.failFor.test(to)) throw new Error('Invalid email: ' + to);
        world.quota--;
        world.mails.push({ to, subject, body, options, at: new Date(world.now) });
      },
      getRemainingDailyQuota: () => world.quota,
    },
    Utilities: {
      DigestAlgorithm: { SHA_256: 'sha256' },
      computeDigest: (alg, s) => [...crypto.createHash('sha256').update(s).digest()].map((b) => (b > 127 ? b - 256 : b)),
      getUuid: () => crypto.randomUUID(),
      formatDate,
      newBlob: (data, type, name) => ({ data, type, name }),
    },
    ScriptApp: {
      newTrigger: (fn) => ({ timeBased: () => ({ at: (d) => ({ create: () => world.triggers.push({ fn, at: new Date(d) }) }) }) }),
      getProjectTriggers: () => world.triggers.map((t) => ({ getHandlerFunction: () => t.fn, _t: t })),
      deleteTrigger: (t) => { world.triggers = world.triggers.filter((x) => x !== t._t); },
      getService: () => ({ getUrl: () => world.props.WEB_APP_URL || null }),
    },
    UrlFetchApp: { fetch: (url) => { const r = world.fetch(url); return { getResponseCode: () => r.code, getContentText: () => r.text }; } },
    HtmlService: { createHtmlOutput: (html) => { const o = { html, setTitle: () => o, addMetaTag: () => o }; return o; } },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: (t) => ({ text: t, setMimeType() { return this; } }) },
    Session: { getEffectiveUser: () => ({ getEmail: () => 'owner@example.com' }) },
  };
  vm.createContext(ctx);
  world.ctx = ctx;
  world.load = (...files) => files.forEach((f) => vm.runInContext(fs.readFileSync(f, 'utf8'), ctx, { filename: f }));
  world.at = (iso) => { world.now = new RealDate(iso).getTime(); };
  world.post = (body) => JSON.parse(ctx.doPost({ postData: { contents: JSON.stringify(body) } }).text);
  world.rsvp = (nume, email, prezenta) => world.post({ nume, email, prezenta, t: 5000, cid: crypto.randomUUID() });
  world.sheet = () => world.sheets['Confirmări'];
  world.rows = () => world.sheet().cells.slice(1).filter(Boolean);
  return world;
}

module.exports = { createWorld };
