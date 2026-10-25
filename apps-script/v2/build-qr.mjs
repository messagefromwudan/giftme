// Construiește QR.gs (Apps Script) și public/confirma-prezenta/intrare/qr.js (pagina de intrare)
// din pachetul npm qrcode, deja în dependențele site-ului. Rulează: node apps-script/v2/build-qr.mjs
import { rolldown } from 'rolldown';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const version = JSON.parse(readFileSync(here('../../node_modules/qrcode/package.json'), 'utf8')).version;

const bundle = await rolldown({ input: here('./qr-entry.cjs'), platform: 'browser', logLevel: 'warn' });
const { output } = await bundle.generate({ format: 'iife', name: 'GiftMeQR' });
await bundle.close();

const banner = `// GENERAT de apps-script/v2/build-qr.mjs – nu edita de mână.
// Nucleul bibliotecii qrcode ${version} (https://github.com/soldair/node-qrcode),
// Copyright (c) 2012 Ryan Day, licență MIT. Generează codul QR local, fără niciun serviciu extern.
`;
const code = banner + output[0].code;
writeFileSync(here('./QR.gs'), code);
writeFileSync(here('../../public/confirma-prezenta/intrare/qr.js'), code);
console.log(`QR.gs și intrare/qr.js: ${(code.length / 1024).toFixed(1)} KB`);
