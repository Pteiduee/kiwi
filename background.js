const MAX_BYTES = 30 * 1024 * 1024; // 30MB cap for remote-to-dataURL fetches

function arrayBufferToBase64(buffer) {
	let binary = '';
	const bytes = new Uint8Array(buffer);
	const chunkSize = 0x8000;
	for (let i = 0; i < bytes.length; i += chunkSize) {
		const sub = bytes.subarray(i, i + chunkSize);
		binary += String.fromCharCode.apply(null, sub);
	}
	return btoa(binary);
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
	if (!message || message.type !== 'fetchAsDataURL' || !message.url) return;
	(async () => {
		try {
			const response = await fetch(message.url, {
				credentials: 'omit',
				cache: 'no-cache',
				redirect: 'follow',
				headers: { 'accept': '*/*' }
			});
			if (!response.ok) throw new Error(`HTTP ${response.status}`);
			let mime = (response.headers.get('content-type') || '').split(';')[0].toLowerCase();
			if (!mime || mime === 'application/octet-stream') {
				const lower = (message.url.split('?')[0] || '').toLowerCase();
				if (lower.endsWith('.gif')) mime = 'image/gif';
				else if (lower.endsWith('.png')) mime = 'image/png';
				else if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) mime = 'image/jpeg';
				else if (lower.endsWith('.webp')) mime = 'image/webp';
				else if (lower.endsWith('.mp4')) mime = 'video/mp4';
				else if (lower.endsWith('.webm')) mime = 'video/webm';
				else if (lower.endsWith('.ogv') || lower.endsWith('.ogg')) mime = 'video/ogg';
				else mime = 'application/octet-stream';
			}
			const clHeader = response.headers.get('content-length');
			if (clHeader && parseInt(clHeader, 10) > MAX_BYTES) {
				throw new Error('Remote file too large');
			}
			const buffer = await response.arrayBuffer();
			if (buffer.byteLength > MAX_BYTES) {
				throw new Error('Remote file too large');
			}
			const base64 = arrayBufferToBase64(buffer);
			const dataUrl = `data:${mime};base64,${base64}`;
			sendResponse({ ok: true, dataUrl, contentType: mime });
		} catch (err) {
			sendResponse({ ok: false, error: String(err && err.message ? err.message : err) });
		}
	})();
	return true; // keep message channel open for async sendResponse
});