async function encryptionKey(secret: string) {
	if (secret.length < 32) throw new Error("AI 密钥加密尚未配置");
	const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
	return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
}
export async function seal(plain: string, secret: string, owner: string): Promise<string> {
	const iv = crypto.getRandomValues(new Uint8Array(12));
	const encrypted = await crypto.subtle.encrypt(
		{ name: "AES-GCM", iv, additionalData: new TextEncoder().encode(owner) },
		await encryptionKey(secret),
		new TextEncoder().encode(plain),
	);
	const data = new Uint8Array(iv.length + encrypted.byteLength);
	data.set(iv);
	data.set(new Uint8Array(encrypted), iv.length);
	return btoa(String.fromCharCode(...data));
}
export async function unseal(cipher: string, secret: string, owner: string): Promise<string> {
	const data = Uint8Array.from(atob(cipher), (c) => c.charCodeAt(0));
	const plain = await crypto.subtle.decrypt(
		{ name: "AES-GCM", iv: data.slice(0, 12), additionalData: new TextEncoder().encode(owner) },
		await encryptionKey(secret),
		data.slice(12),
	);
	return new TextDecoder().decode(plain);
}
