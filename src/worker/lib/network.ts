import { publicUrl } from "../../shared/validation";
import { APP_VERSION } from "../../shared/version";

export const userAgent = `GeekHub/${APP_VERSION} (+https://geekhub.hexly.ai)`;

export async function readBounded(
	response: Response,
	maxBytes: number,
): Promise<Uint8Array<ArrayBuffer>> {
	if (Number(response.headers.get("content-length")) > maxBytes) {
		await response.body?.cancel();
		throw new Error("远程内容超过大小限制");
	}
	const reader = response.body?.getReader();
	if (!reader) return new Uint8Array();
	const chunks: Uint8Array[] = [];
	let total = 0;
	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			total += value.byteLength;
			if (total > maxBytes) throw new Error("远程内容超过大小限制");
			chunks.push(value);
		}
	} finally {
		await reader.cancel();
	}
	const result = new Uint8Array(total);
	let offset = 0;
	for (const chunk of chunks) {
		result.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return result;
}

export async function fetchPublic(
	input: string,
	headers: Record<string, string> = {},
): Promise<Response> {
	let url = publicUrl(input);
	const signal = AbortSignal.timeout(15_000);
	for (let redirects = 0; redirects <= 4; redirects++) {
		const response = await fetch(url, {
			headers: { "User-Agent": userAgent, ...headers },
			redirect: "manual",
			signal,
		});
		if ([301, 302, 303, 307, 308].includes(response.status)) {
			const location = response.headers.get("location");
			await response.body?.cancel();
			if (!location) throw new Error("远程网站返回了无效跳转");
			url = publicUrl(new URL(location, url).href);
			continue;
		}
		if (!response.ok && response.status !== 304) {
			await response.body?.cancel();
			throw new Error(`抓取失败：HTTP ${response.status}`);
		}
		return response;
	}
	throw new Error("远程网站跳转过多");
}
