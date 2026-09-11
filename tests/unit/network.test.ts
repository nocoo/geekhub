import { describe, expect, test, vi } from "vitest";
import { decodeCursor, encodeCursor, publicUrl, resolveFeedUrl } from "../../src/shared/validation";
import { seal, unseal } from "../../src/worker/lib/crypto";
import { errorMessage } from "../../src/worker/lib/errors";
import { fetchPublic, readBounded } from "../../src/worker/lib/network";

describe("outbound requests and size limits", () => {
	test.each([
		"file:///etc/passwd",
		"ftp://example.com",
		"http://localhost",
		"http://127.0.0.1",
		"http://0x7f000001",
		"http://2130706433",
		"http://[::1]",
		"https://user:password@example.com",
		"https://x.local",
		"https://x.internal",
		"https://x.test",
		"https://x.onion",
	])("rejects %s", (url) => expect(() => publicUrl(url)).toThrow());
	test("canonicalizes public addresses and RSSHub paths", () => {
		expect(publicUrl("https://EXAMPLE.com/a#secret").href).toBe("https://example.com/a");
		expect(resolveFeedUrl("rsshub:///github/issue/openai", "https://rsshub.app/")).toBe(
			"https://rsshub.app/github/issue/openai",
		);
		expect(resolveFeedUrl("https://example.com/rss", "https://rsshub.app")).toBe(
			"https://example.com/rss",
		);
		expect(resolveFeedUrl("rsshub://custom.example.com/sspai/index", "https://rsshub.app")).toBe(
			"https://custom.example.com/sspai/index",
		);
		expect(() => resolveFeedUrl("rsshub://127.0.0.1/private", "https://rsshub.app")).toThrow();
		expect(() => resolveFeedUrl("rsshub://instance.local/private", "https://rsshub.app")).toThrow();
		expect(() => resolveFeedUrl("rsshub://../bad", "https://rsshub.app")).toThrow();
		expect(() => resolveFeedUrl("rsshub://", "https://rsshub.app")).toThrow();
		expect(() => resolveFeedUrl("rsshub://good", "http://localhost")).toThrow();
	});
	test("revalidates redirects, handles conditional requests and limits redirect depth", async () => {
		const fetch = vi
			.fn()
			.mockResolvedValueOnce(
				new Response(null, { status: 302, headers: { location: "/redirected" } }),
			)
			.mockResolvedValueOnce(new Response("OK"));
		vi.stubGlobal("fetch", fetch);
		expect(
			await (await fetchPublic("https://example.com/start", { Accept: "text/plain" })).text(),
		).toBe("OK");
		expect(fetch.mock.calls[1]?.[0].href).toBe("https://example.com/redirected");
		expect(fetch.mock.calls[0]?.[1]).toMatchObject({
			redirect: "manual",
			headers: { Accept: "text/plain" },
		});
		fetch.mockResolvedValueOnce(new Response(null, { status: 304 }));
		expect((await fetchPublic("https://example.com")).status).toBe(304);
		fetch.mockResolvedValueOnce(
			new Response(null, { status: 302, headers: { location: "http://127.0.0.1/" } }),
		);
		await expect(fetchPublic("https://example.com")).rejects.toThrow("公开");
		fetch.mockResolvedValueOnce(new Response(null, { status: 301 }));
		await expect(fetchPublic("https://example.com")).rejects.toThrow("无效跳转");
		fetch.mockResolvedValueOnce(new Response("error", { status: 500 }));
		await expect(fetchPublic("https://example.com")).rejects.toThrow("HTTP 500");
		fetch.mockImplementation(
			async () => new Response("", { status: 307, headers: { location: "/loop" } }),
		);
		await expect(fetchPublic("https://example.com")).rejects.toThrow("跳转过多");
		fetch.mockRejectedValueOnce(new Error("network unavailable"));
		await expect(fetchPublic("https://example.com")).rejects.toThrow("network unavailable");
	});
	test("bounds content-length and streamed payloads, handles empty and cancelled streams", async () => {
		expect(await readBounded(new Response(null), 10)).toHaveLength(0);
		expect(new TextDecoder().decode(await readBounded(new Response("1234"), 4))).toBe("1234");
		await expect(
			readBounded(new Response("1234", { headers: { "content-length": "4" } }), 3),
		).rejects.toThrow("大小限制");
		const cancel = vi.fn();
		const body = new ReadableStream({
			start(controller) {
				controller.enqueue(new Uint8Array([1, 2]));
				controller.enqueue(new Uint8Array([3, 4]));
			},
			cancel,
		});
		await expect(readBounded(new Response(body), 3)).rejects.toThrow("大小限制");
		expect(cancel).toHaveBeenCalledOnce();
	});
	test("round-trips validated pagination cursors and rejects malformed values", () => {
		expect(decodeCursor(encodeCursor("2026-01-01T00:00:00.000Z", "article"))).toEqual({
			date: "2026-01-01T00:00:00.000Z",
			id: "article",
		});
		expect(() => decodeCursor("!invalid")).toThrow();
		expect(() => decodeCursor(btoa('{"date":"no","id":""}'))).toThrow();
	});
});

test("API-key ciphertext is randomized, authenticated and bound to the owner", async () => {
	const secret = crypto.randomUUID();
	const first = await seal("credential", secret, "owner");
	const second = await seal("credential", secret, "owner");
	expect(first).not.toBe(second);
	expect(first).not.toContain("credential");
	expect(await unseal(first, secret, "owner")).toBe("credential");
	await expect(unseal(first, secret, "other")).rejects.toThrow();
	await expect(unseal(first, crypto.randomUUID(), "owner")).rejects.toThrow();
	await expect(seal("credential", "short", "owner")).rejects.toThrow("尚未配置");
	expect(errorMessage(new Error("reason"))).toBe("reason");
	expect(errorMessage(null)).toBe("未知错误");
});
