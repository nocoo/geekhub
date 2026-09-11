import { createHash } from "node:crypto";
import { expect, test, vi } from "vitest";
import { withAuthorProfile } from "../../src/worker/lib/author-profile";

const user = { id: "access-reader", email: " Reader@Example.com ", name: "Access Reader" };
const avatar = "https://images.example.com/avatar-80.jpg";

test("looks up the normalized email hash without sending identity or credentials", async () => {
	const fetcher = vi.fn(async (input: string, init?: RequestInit) => {
		const url = new URL(input);
		expect(url.origin + url.pathname).toBe("https://lizheng.blog/api/authors/profile");
		expect(url.searchParams.get("hash")).toBe(
			createHash("sha256").update("reader@example.com").digest("hex"),
		);
		expect(input).not.toContain("@");
		expect(input).not.toContain(user.id);
		expect(new Headers(init?.headers).has("authorization")).toBe(false);
		expect(init?.redirect).toBe("error");
		expect(init?.signal).toBeInstanceOf(AbortSignal);
		return Response.json({ name: "  Public Reader  ", avatar });
	});
	vi.stubGlobal("fetch", fetcher);
	expect(await withAuthorProfile(user)).toEqual({
		...user,
		name: "Public Reader",
		avatarUrl: avatar,
	});
});

test("preserves Access identity when a public profile or individual field is absent", async () => {
	for (const profile of [{}, { name: null, avatar: null }, { name: " ", avatar: "" }]) {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => Response.json(profile)),
		);
		expect(await withAuthorProfile(user)).toEqual({ ...user, avatarUrl: null });
	}
	vi.stubGlobal(
		"fetch",
		vi.fn(async () => Response.json({ name: null, avatar })),
	);
	expect(await withAuthorProfile(user)).toEqual({ ...user, avatarUrl: avatar });
});

test("rejects unsafe avatar URLs, malformed profiles and oversized responses", async () => {
	for (const body of [
		null,
		[],
		{ name: 42, avatar },
		{ name: "Reader", avatar: "http://127.0.0.1/avatar.png" },
		{ name: "Reader", avatar: "javascript:alert(1)" },
		{ name: "x".repeat(20_000), avatar },
	]) {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => Response.json(body)),
		);
		expect(await withAuthorProfile(user)).toEqual({ ...user, avatarUrl: null });
	}
	vi.stubGlobal(
		"fetch",
		vi.fn(async () => new Response("not json")),
	);
	expect(await withAuthorProfile(user)).toEqual({ ...user, avatarUrl: null });
});

test("profile failures and timeouts never prevent opening the reader", async () => {
	for (const body of [null, "unavailable"]) {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => new Response(body, { status: 503 })),
		);
		expect(await withAuthorProfile(user)).toEqual({ ...user, avatarUrl: null });
	}
	vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new DOMException("Timed out", "TimeoutError")));
	expect(await withAuthorProfile(user)).toEqual({ ...user, avatarUrl: null });
});
