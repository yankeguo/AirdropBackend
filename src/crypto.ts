export function randomHex(byteLen: number): string {
	const bytes = new Uint8Array(byteLen);
	crypto.getRandomValues(bytes);
	return Array.from(bytes)
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
}
