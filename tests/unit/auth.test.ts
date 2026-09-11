import { exportJWK, generateKeyPair, SignJWT } from "jose";
import { beforeAll, describe, expect, test, vi } from "vitest";
import { assertTestDatabase, localRequest, verifyAccess } from "../../src/worker/auth";
import { app } from "../../src/worker/index";
import { makeEnv } from "./support";

describe("Cloudflare Access", () => {
	let privateKey: CryptoKey;
	let publicJwk: Awaited<ReturnType<typeof exportJWK>>;
	beforeAll(async () => {
		const pair = await generateKeyPair("RS256");
		privateKey = pair.privateKey;
		publicJwk = await exportJWK(pair.publicKey);
	});
	async function token(
		payload: Record<string, unknown> = {},
		issuer = "https://nocoo.cloudflareaccess.com",
		audience = "app-audience",
	) {
		return new SignJWT({ email: "Reader@Example.com", name: "Reader", ...payload })
			.setProtectedHeader({ alg: "RS256", kid: "local-key" })
			.setSubject(typeof payload.sub === "string" ? payload.sub : "access-user")
			.setIssuedAt()
			.setExpirationTime("5m")
			.setIssuer(issuer)
			.setAudience(audience)
			.sign(privateKey);
	}
	const request = (jwt: string) =>
		new Request("https://geekhub.hexly.ai/api/session", {
			headers: { "cf-access-jwt-assertion": jwt },
		});
	test("requires cryptographic signature, trusted issuer, audience and human identity", async () => {
		const env = {
			...makeEnv(),
			ENVIRONMENT: "production",
			CF_ACCESS_TEAM_DOMAIN: "nocoo",
			CF_ACCESS_AUD: "app-audience",
		};
		const fetch = vi.fn(async () =>
			Response.json({ keys: [{ ...publicJwk, kid: "local-key", use: "sig", alg: "RS256" }] }),
		);
		vi.stubGlobal("fetch", fetch);
		expect(await verifyAccess(request(await token()), env)).toEqual({
			id: "access-user",
			email: "reader@example.com",
			name: "Reader",
		});
		expect(await verifyAccess(request(await token({ name: "" })), env)).toMatchObject({
			name: "reader",
		});
		expect(await verifyAccess(request(await token({ name: 123 })), env)).toMatchObject({
			name: "reader",
		});
		expect(fetch.mock.calls).toHaveLength(3);
		await expect(
			verifyAccess(request(await token({}, "https://wrong.cloudflareaccess.com")), env),
		).rejects.toMatchObject({ status: 401 });
		await expect(
			verifyAccess(request(await token({}, undefined, "wrong-app")), env),
		).rejects.toMatchObject({ status: 401 });
		for (const payload of [{ email: "bad" }, { email: 123 }, { email: null }])
			await expect(verifyAccess(request(await token(payload)), env)).rejects.toMatchObject({
				status: 401,
			});
		const signed = await token();
		const pieces = signed.split(".");
		pieces[1] = btoa(
			JSON.stringify({
				email: "evil@example.com",
				sub: "evil",
				exp: Math.floor(Date.now() / 1000) + 100,
			}),
		);
		await expect(verifyAccess(request(pieces.join(".")), env)).rejects.toMatchObject({
			status: 401,
		});
		const expired = await new SignJWT({ email: "reader@example.com" })
			.setProtectedHeader({ alg: "RS256", kid: "local-key" })
			.setSubject("access-user")
			.setIssuedAt(1)
			.setExpirationTime(2)
			.setIssuer("https://nocoo.cloudflareaccess.com")
			.setAudience("app-audience")
			.sign(privateKey);
		await expect(verifyAccess(request(expired), env)).rejects.toMatchObject({ status: 401 });
		const noSubject = await new SignJWT({ email: "reader@example.com" })
			.setProtectedHeader({ alg: "RS256", kid: "local-key" })
			.setIssuedAt()
			.setExpirationTime("5m")
			.setIssuer("https://nocoo.cloudflareaccess.com")
			.setAudience("app-audience")
			.sign(privateKey);
		await expect(verifyAccess(request(noSubject), env)).rejects.toMatchObject({ status: 401 });
		const emptySubject = await new SignJWT({ email: "reader@example.com", sub: "" })
			.setProtectedHeader({ alg: "RS256", kid: "local-key" })
			.setIssuedAt()
			.setExpirationTime("5m")
			.setIssuer("https://nocoo.cloudflareaccess.com")
			.setAudience("app-audience")
			.sign(privateKey);
		await expect(verifyAccess(request(emptySubject), env)).rejects.toMatchObject({ status: 401 });
	});
	test("fails closed on missing configuration, missing token and broken JWKS", async () => {
		const env = makeEnv();
		await expect(verifyAccess(new Request("https://geekhub.hexly.ai"), env)).rejects.toMatchObject({
			status: 401,
		});
		await expect(verifyAccess(request("token"), env)).rejects.toMatchObject({ status: 503 });
		await expect(
			verifyAccess(request("token"), { ...env, CF_ACCESS_TEAM_DOMAIN: "nocoo" }),
		).rejects.toMatchObject({ status: 503 });
		await expect(
			verifyAccess(request("token"), {
				...env,
				CF_ACCESS_TEAM_DOMAIN: "../evil",
				CF_ACCESS_AUD: "app",
			}),
		).rejects.toMatchObject({ status: 503 });
		vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
		await expect(
			verifyAccess(request(await token()), {
				...env,
				CF_ACCESS_TEAM_DOMAIN: "nocoo",
				CF_ACCESS_AUD: "app-audience",
			}),
		).rejects.toMatchObject({ status: 401 });
	});
	test("middleware uses verified Access identity, never the email header", async () => {
		const env = {
			...makeEnv(),
			ENVIRONMENT: "production",
			CF_ACCESS_TEAM_DOMAIN: "nocoo",
			CF_ACCESS_AUD: "app-audience",
		};
		vi.stubGlobal(
			"fetch",
			vi.fn(async (url: string | URL) =>
				String(url).startsWith("https://lizheng.blog/")
					? Response.json({ name: "Public Reader", avatar: "https://example.com/avatar.jpg" })
					: Response.json({ keys: [{ ...publicJwk, kid: "local-key" }] }),
			),
		);
		const req = request(await token());
		req.headers.set("cf-access-authenticated-user-email", "attacker@example.com");
		const result = await app.request(req, {}, env);
		expect(result.status).toBe(200);
		expect(await result.json()).toMatchObject({
			local: false,
			user: {
				id: "access-user",
				email: "reader@example.com",
				name: "Public Reader",
				avatarUrl: "https://example.com/avatar.jpg",
			},
		});
		// Access subject changes do not create separate libraries in this single-user app.
		for (const sub of ["access-user", "changed-access-subject"]) {
			const jwt = await token({ sub });
			const headers = { "cf-access-jwt-assertion": jwt, "content-type": "application/json" };
			const response = await app.request("https://geekhub.hexly.ai/api/feeds", { headers }, env);
			expect(await response.json()).toMatchObject([{ id: "f1", title: "Example" }]);
			const update = await app.request(
				"https://geekhub.hexly.ai/api/articles/a1",
				{ method: "PATCH", headers, body: JSON.stringify({ is_starred: true }) },
				env,
			);
			expect(update.status).toBe(200);
			expect(await update.json()).toMatchObject({ id: "a1", is_starred: 1 });
		}
		expect(
			(
				await app.request(
					"https://geekhub.hexly.ai/api/session",
					{ headers: { "cf-access-authenticated-user-email": "reader@example.com" } },
					env,
				)
			).status,
		).toBe(401);
	});
});

test("local profile uses an explicit preview email only for loopback development", async () => {
	const env = { ...makeEnv(), LOCAL_USER_EMAIL: "preview@example.com" };
	const fetcher = vi.fn(async () =>
		Response.json({ name: "Preview Reader", avatar: "https://example.com/avatar.jpg" }),
	);
	vi.stubGlobal("fetch", fetcher);
	const response = await app.request("http://127.0.0.1/api/session", {}, env);
	expect(await response.json()).toMatchObject({
		local: true,
		user: {
			email: "preview@example.com",
			name: "Preview Reader",
			avatarUrl: "https://example.com/avatar.jpg",
		},
	});
	expect(fetcher).toHaveBeenCalledOnce();
	const denied = await app.request("https://geekhub.hexly.ai/api/session", {}, env);
	expect(denied.status).toBe(401);
	expect(fetcher).toHaveBeenCalledOnce();
});

test("local identity requires local environment, loopback URL and loopback peer", () => {
	const env = makeEnv();
	for (const host of ["127.0.0.1", "localhost", "[::1]"])
		expect(localRequest(new Request(`http://${host}/api/session`), env)).toBe(true);
	expect(
		localRequest(
			new Request("http://127.0.0.1", { headers: { "cf-connecting-ip": "127.0.0.1" } }),
			env,
		),
	).toBe(true);
	expect(
		localRequest(
			new Request("http://127.0.0.1", { headers: { "cf-connecting-ip": "203.0.113.5" } }),
			env,
		),
	).toBe(false);
	expect(localRequest(new Request("https://geekhub.hexly.ai"), env)).toBe(false);
	expect(localRequest(new Request("http://127.0.0.1"), { ENVIRONMENT: "production" })).toBe(false);
	expect(
		localRequest(
			new Request("https://geekhub.dev.hexly.ai", { headers: { "cf-connecting-ip": "127.0.0.1" } }),
			env,
		),
	).toBe(true);
	expect(localRequest(new Request("https://geekhub.dev.hexly.ai"), env)).toBe(false);
	expect(
		localRequest(
			new Request("https://geekhub.dev.hexly.ai", {
				headers: { "cf-connecting-ip": "203.0.113.1" },
			}),
			env,
		),
	).toBe(false);
	expect(
		localRequest(
			new Request("https://geekhub.dev.hexly.ai", { headers: { "cf-connecting-ip": "127.0.0.1" } }),
			{ ENVIRONMENT: "production" },
		),
	).toBe(false);
});

test("test runtime requires a local environment and a marked database before API writes", async () => {
	const env = makeEnv();
	env.LOCAL_USER_EMAIL = "preview@example.com";
	const profileFetch = vi.fn();
	vi.stubGlobal("fetch", profileFetch);
	await expect(assertTestDatabase(env)).rejects.toMatchObject({ status: 403 });
	env.RESOURCE_ENV = "test";
	await env.DB.exec("CREATE TABLE _test_marker(key TEXT PRIMARY KEY, value TEXT);");
	await expect(assertTestDatabase(env)).rejects.toMatchObject({ status: 403 });
	await env.DB.exec("INSERT INTO _test_marker VALUES ('env','wrong');");
	await expect(assertTestDatabase(env)).rejects.toMatchObject({ status: 403 });
	await env.DB.exec("UPDATE _test_marker SET value = 'test';");
	await expect(assertTestDatabase(env)).resolves.toBeUndefined();
	expect((await app.request("http://127.0.0.1/api/session", {}, env)).status).toBe(200);
	expect(profileFetch).not.toHaveBeenCalled();
	expect((await app.request("https://example.com/api/session", {}, env)).status).toBe(403);
	expect(
		(
			await app.request(
				"http://127.0.0.1/api/categories",
				{
					method: "POST",
					headers: { origin: "https://evil.example.com" },
					body: JSON.stringify({ name: "Attack" }),
				},
				env,
			)
		).status,
	).toBe(403);
	expect(
		(
			await app.request(
				"http://127.0.0.1/api/categories",
				{
					method: "POST",
					headers: { "sec-fetch-site": "cross-site" },
					body: JSON.stringify({ name: "Attack" }),
				},
				env,
			)
		).status,
	).toBe(403);
	expect(
		(
			await app.request(
				"http://127.0.0.1/api/categories",
				{
					method: "POST",
					headers: { origin: "http://127.0.0.1", "content-type": "application/json" },
					body: JSON.stringify({ name: "Allowed" }),
				},
				env,
			)
		).status,
	).toBe(201);
});
