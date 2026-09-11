import type { Context, Next } from "hono";
import { createRemoteJWKSet, jwtVerify } from "jose";
import type { User } from "../shared/contracts";
import { fail } from "./lib/errors";

export type AppEnv = { Bindings: Env; Variables: { user: User; local: boolean } };

export function localRequest(request: Request, env: Pick<Env, "ENVIRONMENT">): boolean {
	const hostname = new URL(request.url).hostname;
	const peer = request.headers.get("cf-connecting-ip");
	const loopbackPeer = peer === "127.0.0.1" || peer === "::1";
	return (
		env.ENVIRONMENT === "local" &&
		((["127.0.0.1", "localhost", "[::1]"].includes(hostname) && (!peer || loopbackPeer)) ||
			(hostname === "geekhub.dev.hexly.ai" && loopbackPeer))
	);
}

export async function verifyAccess(request: Request, env: Env): Promise<User> {
	const token = request.headers.get("cf-access-jwt-assertion");
	if (!token) fail(401, "请通过 Cloudflare Access 登录");
	if (!/^[a-z0-9-]+$/.test(env.CF_ACCESS_TEAM_DOMAIN) || !env.CF_ACCESS_AUD) {
		fail(503, "Cloudflare Access 尚未配置");
	}
	const issuer = `https://${env.CF_ACCESS_TEAM_DOMAIN}.cloudflareaccess.com`;
	try {
		const { payload } = await jwtVerify(
			token,
			createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`)),
			{
				algorithms: ["RS256"],
				issuer,
				audience: env.CF_ACCESS_AUD,
				requiredClaims: ["exp", "iat", "sub", "email"],
			},
		);
		if (
			typeof payload.sub !== "string" ||
			!payload.sub ||
			typeof payload.email !== "string" ||
			!payload.email.includes("@")
		) {
			fail(401, "Access 身份无效");
		}
		const email = payload.email.toLowerCase();
		return {
			id: payload.sub,
			email,
			name:
				typeof payload.name === "string" && payload.name
					? payload.name
					: (email.split("@")[0] ?? email),
		};
	} catch {
		fail(401, "登录已失效，请重新通过 Cloudflare Access 登录");
	}
}

export async function assertTestDatabase(env: Env): Promise<void> {
	if (env.ENVIRONMENT !== "local" || env.RESOURCE_ENV !== "test") fail(403, "测试资源隔离检查失败");
	const marker = await env.DB.prepare("SELECT value FROM _test_marker WHERE key = 'env'").first<{
		value: string;
	}>();
	if (marker?.value !== "test") fail(403, "测试数据库标记缺失");
}

export async function authenticate(c: Context<AppEnv>, next: Next) {
	const local = localRequest(c.req.raw, c.env);
	if (c.env.RESOURCE_ENV === "test") {
		if (!local) fail(403, "测试 Worker 仅接受本机请求");
		await assertTestDatabase(c.env);
	}
	const user = local
		? {
				id: "local-reader",
				email: c.env.LOCAL_USER_EMAIL || "reader@geekhub.local",
				name: "本地读者",
			}
		: await verifyAccess(c.req.raw, c.env);
	if (!["GET", "HEAD", "OPTIONS"].includes(c.req.method)) {
		const origin = c.req.header("origin");
		if (
			(origin && origin !== new URL(c.req.url).origin) ||
			c.req.header("sec-fetch-site") === "cross-site"
		)
			fail(403, "请求来源无效");
	}
	c.set("user", user);
	c.set("local", local);
	c.header("Cache-Control", "no-store");
	await next();
}
