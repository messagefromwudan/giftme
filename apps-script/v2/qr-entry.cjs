// Intrarea pentru build-qr.mjs: doar nucleul bibliotecii qrcode (MIT), fără randare.
// Același fișier rezultat rulează în Apps Script (QR.gs) și în browser (intrare/qr.js).
const QRCode = require('qrcode/lib/core/qrcode');

module.exports = {
	/**
	 * Matricea codului QR pentru un text ASCII (URL-ul biletului).
	 * Trimitem octeții direct: Apps Script nu are TextEncoder.
	 */
	matrix(text) {
		const bytes = [];
		for (let i = 0; i < text.length; i++) {
			const c = text.charCodeAt(i);
			if (c < 32 || c > 126) throw new Error('Codul QR acceptă doar text ASCII.');
			bytes.push(c);
		}
		const qr = QRCode.create([{ data: bytes, mode: 'byte' }], { errorCorrectionLevel: 'M' });
		const size = qr.modules.size;
		const data = qr.modules.data;
		return { size, dark: (x, y) => data[y * size + x] === 1 };
	},
};
