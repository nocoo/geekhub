import { readFileSync } from "node:fs";
import { createAiModel } from "@nocoo/next-ai/server";
import { generateText } from "ai";
import { describe, expect, test, vi } from "vitest";
import {
	aiCached,
	aiConfig,
	aiFetch,
	aiSettings,
	complete,
	saveAiSettings,
	testAi,
	transformArticle,
} from "../../src/worker/ai";
import { articleDetail } from "../../src/worker/data";
import { aiResponse, makeEnv } from "./support";

const custom = {
	provider: "custom",
	model: "test-model",
	sdkType: "openai" as const,
	baseURL: "https://ai.example.com/v1",
	apiKey: "test-credential",
};

describe("public next-ai configuration and server credentials", () => {
	test.each([
		{ environment: "local", resource: "local", local: true },
		{ environment: "production", resource: "production", local: false },
		{ environment: "production", resource: "test", local: true },
		{ environment: "local", resource: "test", local: false },
	])("requires real credentials outside isolated local tests: %j", async (context) => {
		const env = makeEnv();
		env.ENVIRONMENT = context.environment;
		env.RESOURCE_ENV = context.resource;
		const fetch = vi.fn();
		vi.stubGlobal("fetch", fetch);
		expect(await aiSettings(env, context.local)).toMatchObject({ hasApiKey: false, mock: false });
		await expect(testAi(env, {}, context.local)).rejects.toMatchObject({ status: 422 });
		const article = await articleDetail(env.DB, "a1");
		for (const action of ["summary", "translate", "translate-title"] as const)
			await expect(transformArticle(env, article, action, context.local)).rejects.toMatchObject({
				status: 422,
			});
		expect(await articleDetail(env.DB, "a1")).toEqual(article);
		expect(fetch).not.toHaveBeenCalled();
	});
	test("migration removes fabricated results while retaining articles, states and real AI", async () => {
		const env = makeEnv();
		await env.DB.exec(`UPDATE articles SET summary='fake', translated_title='fake',
			translated_description='fake', translated_content='<p>fake</p>', ai_model='local-mock',
			is_starred=1, is_read=1 WHERE id='a1';
			UPDATE articles SET summary='real summary', ai_model='real-model' WHERE id='a2';`);
		const before = await articleDetail(env.DB, "a1");
		const real = await articleDetail(env.DB, "a2");
		await env.DB.exec(readFileSync("migrations/0004_clear_mock_ai_results.sql", "utf8"));
		expect(await articleDetail(env.DB, "a1")).toEqual({
			...before,
			summary: null,
			translated_title: null,
			translated_description: null,
			translated_content: null,
			ai_model: null,
		});
		expect(await articleDetail(env.DB, "a2")).toEqual(real);
	});
	test("encrypts credentials, keeps them on partial update, and clears them on endpoint changes", async () => {
		const env = makeEnv();
		expect(await aiSettings(env, false)).toMatchObject({
			hasApiKey: false,
			mock: false,
		});
		expect(await aiSettings(env, true)).toMatchObject({
			hasApiKey: false,
			mock: false,
		});
		const saved = await saveAiSettings(env, custom, true);
		expect(saved.hasApiKey).toBe(true);
		expect(saved.mock).toBe(false);
		expect(saved).not.toHaveProperty("apiKey");
		const stored = await env.DB.prepare("SELECT ai_key,ai_config FROM settings WHERE id=1").first<{
			ai_key: string;
			ai_config: string;
		}>();
		expect(stored?.ai_key).not.toContain(custom.apiKey);
		expect(stored?.ai_config).not.toContain(custom.apiKey);
		expect((await aiConfig(env)).apiKey).toBe(custom.apiKey);
		expect(await saveAiSettings(env, { model: "next-model" }, true)).toMatchObject({
			hasApiKey: true,
			model: "next-model",
		});
		await expect(aiConfig(env, { baseURL: "https://other.example.com/v1" })).rejects.toMatchObject({
			status: 422,
		});
		expect(
			(
				await aiConfig(env, {
					baseURL: "https://other.example.com/v1",
					apiKey: "new-test-key",
				})
			).apiKey,
		).toBe("new-test-key");
		expect(
			await saveAiSettings(env, { baseURL: "https://other.example.com/v1" }, true),
		).toMatchObject({ hasApiKey: false, mock: false });
		await saveAiSettings(env, { apiKey: "new-key" }, true);
		expect(
			await saveAiSettings(env, { provider: "minimax", model: "MiniMax-M2.5" }, true),
		).toMatchObject({ hasApiKey: false });
		await saveAiSettings(env, { apiKey: "new-key" }, true);
		expect(await saveAiSettings(env, { apiKey: "" }, true)).toMatchObject({
			hasApiKey: false,
		});
	});
	test("validates provider, HTTPS and missing keys, and keeps keys out of read APIs", async () => {
		const env = makeEnv();
		await expect(saveAiSettings(env, { provider: "unknown" }, false)).rejects.toMatchObject({
			status: 400,
		});
		await expect(
			saveAiSettings(env, { ...custom, baseURL: "http://ai.example.com" }, false),
		).rejects.toMatchObject({ status: 400 });
		await expect(
			saveAiSettings(env, { ...custom, baseURL: "http://localhost" }, false),
		).rejects.toMatchObject({ status: 400 });
		await expect(aiConfig(env)).rejects.toMatchObject({ status: 422 });
		await saveAiSettings(env, custom, false);
		expect(await aiSettings(env, false)).toMatchObject({ hasApiKey: true, mock: false });
		expect((await aiConfig(env, { apiKey: "" })).apiKey).toBe(custom.apiKey);
	});
});

describe("AI generation through the shared next-ai SDK with an HTTP transport fixture", () => {
	test("SDK transport is scoped per client and does not replace global fetch", async () => {
		const globalFetch = vi.fn();
		vi.stubGlobal("fetch", globalFetch);
		const firstFetch = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
			aiResponse("First"),
		);
		const secondFetch = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
			aiResponse("Second"),
		);
		const configs = [
			{ transport: firstFetch, key: "first-test-key", expected: "First" },
			{ transport: secondFetch, key: "second-test-key", expected: "Second" },
		];
		await Promise.all(
			configs.map(async ({ transport, key, expected }) => {
				const result = await generateText({
					model: createAiModel({ ...custom, apiKey: key }, { fetch: transport, openaiApi: "chat" }),
					prompt: "Hello",
					maxRetries: 0,
				});
				expect(result.text).toBe(expected);
				expect(transport).toHaveBeenCalledOnce();
				const [input, init] = transport.mock.calls[0] ?? [];
				const request = new Request(input as RequestInfo, init);
				expect(request.url).toBe("https://ai.example.com/v1/chat/completions");
				expect(request.headers.get("authorization")).toBe(`Bearer ${key}`);
			}),
		);
		expect(globalThis.fetch).toBe(globalFetch);
		expect(globalFetch).not.toHaveBeenCalled();
		// Consumers that omit the new option retain the existing protocol.
		expect(createAiModel(custom).provider).toBe("openai.responses");
	});
	test("uses Chat Completions wire format for OpenAI-compatible providers and rejects redirects", async () => {
		const fetch = vi.fn(async (_request: RequestInfo | URL, _init?: RequestInit) =>
			aiResponse("A clear summary."),
		);
		vi.stubGlobal("fetch", fetch);
		expect(await complete(custom, "Summarize this article", 100)).toBe("A clear summary.");
		const [request, options] = fetch.mock.calls[0] ?? [];
		expect(request).toBeInstanceOf(Request);
		expect(options).toEqual({ redirect: "manual" });
		expect((request as Request).url).toBe("https://ai.example.com/v1/chat/completions");
		expect((request as Request).headers.get("authorization")).toBe("Bearer test-credential");
		const body = (await (request as Request).json()) as { max_tokens: number };
		expect(body.max_tokens).toBe(100);
		await expect(aiFetch("http://ai.example.com")).rejects.toMatchObject({ status: 400 });
	});
	test.each([301, 302, 307, 308])(
		"rejects redirect %i without forwarding credentials",
		async (status) => {
			const response = new Response("redirect", {
				status,
				headers: { location: "https://other.example.com/collect" },
			});
			const fetch = vi.fn().mockResolvedValue(response);
			vi.stubGlobal("fetch", fetch);
			await expect(complete(custom, "Hello")).rejects.toThrow("AI 服务返回了重定向");
			expect(fetch).toHaveBeenCalledOnce();
			expect(fetch.mock.calls[0]?.[1]).toEqual({ redirect: "manual" });
			expect(response.bodyUsed).toBe(true);
		},
	);
	test.each(["apiKey", "bearer"] as const)(
		"uses Anthropic with %s authentication",
		async (authType) => {
			const fetch = vi.fn(async (_request: RequestInfo | URL, _init?: RequestInit) =>
				aiResponse("Connected", "anthropic"),
			);
			vi.stubGlobal("fetch", fetch);
			const config = { ...custom, sdkType: "anthropic" as const, authType };
			expect(await complete(config, "Hello")).toBe("Connected");
			const [request] = fetch.mock.calls[0] ?? [];
			expect((request as Request).headers.get("authorization")).toBe(
				authType === "bearer" ? "Bearer test-credential" : null,
			);
			expect((request as Request).headers.get("x-api-key")).toBe(
				authType === "apiKey" ? "test-credential" : null,
			);
		},
	);
	test("tests saved or draft settings without persisting a draft key", async () => {
		const env = makeEnv();
		env.RESOURCE_ENV = "test";
		vi.stubGlobal(
			"fetch",
			vi.fn(async (_request: RequestInfo | URL, _init?: RequestInit) => aiResponse("Connected")),
		);
		expect(await testAi(env, { provider: "minimax", model: "MiniMax-M2.5" }, true)).toMatchObject({
			success: true,
			model: "local-mock",
		});
		expect(await testAi(env, custom, true)).toMatchObject({
			success: true,
			model: "test-model",
		});
		expect((await aiSettings(env, false)).hasApiKey).toBe(false);
		await saveAiSettings(env, custom, false);
		expect(
			await testAi(
				env,
				{ provider: "custom", model: "test-model", sdkType: "openai", baseURL: custom.baseURL },
				false,
			),
		).toMatchObject({ success: true });
	});
	test("never returns upstream error bodies or secret-bearing messages", async () => {
		const fetch = vi
			.fn()
			.mockResolvedValueOnce(aiResponse(""))
			.mockResolvedValueOnce(new Response("test-credential upstream error", { status: 401 }))
			.mockRejectedValueOnce(new Error("test-credential network"));
		vi.stubGlobal("fetch", fetch);
		for (const message of [
			"AI 没有返回内容，请重试",
			"AI 服务拒绝认证，请在 AI 设置中检查密钥和访问权限",
			"暂时无法连接 AI 服务，请稍后重试或检查 AI 设置",
		])
			await expect(complete(custom, "prompt")).rejects.toMatchObject({
				status: 502,
				message,
			});
	});
	test("persists generated output, sanitizes translated HTML and validates translated JSON", async () => {
		const env = makeEnv();
		await saveAiSettings(env, custom, false);
		const article = await articleDetail(env.DB, "a1");
		const fetch = vi
			.fn()
			.mockResolvedValueOnce(aiResponse("Summary."))
			.mockResolvedValueOnce(
				aiResponse("```html\n<h2>译文</h2><p>你好</p><script>bad()</script>\n```"),
			)
			.mockResolvedValueOnce(aiResponse('```json\n{"title":"你好","description":"摘要"}\n```'))
			.mockResolvedValueOnce(aiResponse("not json"))
			.mockResolvedValueOnce(aiResponse("<script>bad()</script>"));
		vi.stubGlobal("fetch", fetch);
		expect(aiCached(article, "summary")).toBe(false);
		expect(aiCached(article, "translate")).toBe(false);
		expect(aiCached(article, "translate-title")).toBe(false);
		for (const action of ["summary", "translate", "translate-title"] as const)
			await transformArticle(env, article, action, false);
		const saved = await articleDetail(env.DB, "a1");
		expect(saved).toMatchObject({
			summary: "Summary.",
			translated_title: "你好",
			translated_description: "摘要",
			ai_model: "test-model",
		});
		expect(saved.translated_content).toContain("<h2>译文</h2>");
		expect(saved.translated_content).not.toContain("script");
		expect(aiCached(saved, "summary")).toBe(true);
		expect(aiCached(saved, "translate")).toBe(true);
		expect(aiCached(saved, "translate-title")).toBe(true);
		await expect(transformArticle(env, article, "translate-title", false)).rejects.toMatchObject({
			status: 502,
		});
		await expect(transformArticle(env, article, "translate", false)).rejects.toMatchObject({
			status: 502,
		});
		await expect(
			transformArticle(env, { ...article, content: "x".repeat(45_001) }, "translate", false),
		).rejects.toMatchObject({ status: 422 });
		expect((await articleDetail(env.DB, "a2")).summary).toBeNull();
	});
});

test.each([
	[400, 502, "模型、协议和服务地址"],
	[404, 502, "模型、协议和服务地址"],
	[403, 502, "密钥和访问权限"],
	[429, 429, "额度不足"],
	[500, 502, "暂时无法连接"],
])("reports safe, actionable provider errors for HTTP %s", async (upstream, status, message) => {
	vi.stubGlobal(
		"fetch",
		vi.fn(async () =>
			Response.json(
				{ error: { message: "secret-test-credential", type: "api_error" } },
				{ status: upstream },
			),
		),
	);
	await expect(complete(custom, "prompt")).rejects.toMatchObject({
		status,
		message: expect.stringContaining(message),
	});
});

test.each(["TimeoutError", "AbortError"])(
	"reports %s without leaking provider details",
	async (name) => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => {
				throw new DOMException("secret", name);
			}),
		);
		await expect(complete(custom, "prompt")).rejects.toThrow("AI 请求超时");
	},
);

test("rejects truncated output without replacing a previously saved result", async () => {
	const env = makeEnv();
	await saveAiSettings(env, custom, false);
	await env.DB.prepare("UPDATE articles SET summary = 'Saved summary' WHERE id = 'a1'").run();
	const body = (await aiResponse("Incomplete text").json()) as {
		choices: { finish_reason: string }[];
	};
	body.choices = body.choices.map((choice) => ({ ...choice, finish_reason: "length" }));
	vi.stubGlobal(
		"fetch",
		vi.fn(async () => Response.json(body)),
	);
	await expect(
		transformArticle(env, await articleDetail(env.DB, "a1"), "summary", false),
	).rejects.toThrow("结果不完整");
	expect((await articleDetail(env.DB, "a1")).summary).toBe("Saved summary");
});

test("refuses empty source text and invalid translated titles", async () => {
	const env = makeEnv();
	const article = await articleDetail(env.DB, "a1");
	for (const action of ["summary", "translate"] as const)
		await expect(
			transformArticle(env, { ...article, content: "<p> </p>" }, action, true),
		).rejects.toMatchObject({ status: 422 });
	await saveAiSettings(env, custom, false);
	vi.stubGlobal(
		"fetch",
		vi.fn(async () => aiResponse('{"title":"<p></p>","description":""}')),
	);
	await expect(transformArticle(env, article, "translate-title", false)).rejects.toThrow(
		"有效标题",
	);
});

test("translation preserves source structure, and rejects results for replaced article content", async () => {
	const env = makeEnv();
	await saveAiSettings(env, custom, false);
	const content =
		'<h2>Heading</h2><p><a href="https://example.com/source">Source</a></p><pre><code>const x = 1;</code></pre>';
	await env.DB.prepare("UPDATE articles SET content = ? WHERE id = 'a1'").bind(content).run();
	const original = await articleDetail(env.DB, "a1");
	const transport = vi.fn(async (request: Request) => {
		const body = (await request.json()) as { messages: { content: string }[] };
		expect(body.messages.at(-1)?.content).toContain("<h2>Heading</h2>");
		expect(body.messages.at(-1)?.content).toContain("https://example.com/source");
		expect(body.messages.at(-1)?.content).toContain("<code>const x = 1;</code>");
		return aiResponse(
			'<h2>标题</h2><p><a href="https://example.com/source">来源</a></p><pre><code>const x = 1;</code></pre>',
		);
	});
	vi.stubGlobal("fetch", transport);
	await transformArticle(env, original, "translate", false);
	expect((await articleDetail(env.DB, "a1")).translated_content).toContain(
		"<code>const x = 1;</code>",
	);
	await env.DB.prepare(
		"UPDATE articles SET content = '<p>New text</p>', translated_content = NULL WHERE id = 'a1'",
	).run();
	await expect(transformArticle(env, original, "translate", false)).rejects.toMatchObject({
		status: 409,
	});
	vi.stubGlobal(
		"fetch",
		vi.fn(async () => aiResponse("Stale summary")),
	);
	await expect(transformArticle(env, original, "summary", false)).rejects.toMatchObject({
		status: 409,
	});
	expect((await articleDetail(env.DB, "a1")).translated_content).toBeNull();
});
