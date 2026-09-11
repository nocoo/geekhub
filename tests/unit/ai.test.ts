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
	test("encrypts credentials, keeps them on partial update, and clears them on endpoint changes", async () => {
		const env = makeEnv();
		expect(await aiSettings(env, false)).toMatchObject({
			hasApiKey: false,
			mock: false,
		});
		expect(await aiSettings(env, true)).toMatchObject({
			hasApiKey: false,
			mock: true,
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
		).toMatchObject({ hasApiKey: false, mock: true });
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

describe("AI generation using the real SDK with an HTTP transport fixture", () => {
	test("uses Responses wire format for OpenAI-compatible providers and rejects redirects", async () => {
		const fetch = vi.fn(async (_request: RequestInfo | URL, _init?: RequestInit) =>
			aiResponse("A clear summary."),
		);
		vi.stubGlobal("fetch", fetch);
		expect(await complete(custom, "Summarize this article", 100)).toBe("A clear summary.");
		const [request, options] = fetch.mock.calls[0] ?? [];
		expect(request).toBeInstanceOf(Request);
		expect(options).toEqual({ redirect: "error" });
		expect((request as Request).url).toBe("https://ai.example.com/v1/responses");
		expect((request as Request).headers.get("authorization")).toBe("Bearer test-credential");
		const body = (await (request as Request).json()) as { max_output_tokens: number };
		expect(body.max_output_tokens).toBe(100);
		await expect(aiFetch("http://ai.example.com")).rejects.toMatchObject({ status: 400 });
	});
	test("uses Anthropic and supports bearer authentication", async () => {
		const fetch = vi.fn(async (_request: RequestInfo | URL, _init?: RequestInit) =>
			aiResponse("Connected", "anthropic"),
		);
		vi.stubGlobal("fetch", fetch);
		const config = { ...custom, sdkType: "anthropic" as const, authType: "bearer" as const };
		expect(await complete(config, "Hello")).toBe("Connected");
		const [request] = fetch.mock.calls[0] ?? [];
		expect((request as Request).headers.get("authorization")).toBe("Bearer test-credential");
		expect((request as Request).headers.has("x-api-key")).toBe(false);
	});
	test("tests saved or draft settings without persisting a draft key", async () => {
		const env = makeEnv();
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
		for (let i = 0; i < 3; i++)
			await expect(complete(custom, "prompt")).rejects.toMatchObject({
				status: 502,
				message: "AI 请求失败，请检查服务商、模型和密钥后重试",
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
