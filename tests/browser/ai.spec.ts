import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import type { AiSettings, ArticleDetail, ArticlePage, Feed } from "../../src/shared/contracts";

async function fixture(page: Page) {
	const response = await page.request.post("/api/feeds", {
		data: {
			url: `https://demo.geekhub.example/rss/simon?ai=${crypto.randomUUID()}`,
			title: "AI workflow fixture",
		},
	});
	expect(response.ok(), await response.text()).toBe(true);
	const feed = (await response.json()) as Feed;
	await expect
		.poll(
			async () => {
				const list = (await (
					await page.request.get(`/api/articles?feedId=${feed.id}`)
				).json()) as ArticlePage;
				return list.articles.length;
			},
			{ timeout: 20000 },
		)
		.toBeGreaterThan(1);
	const list = (await (
		await page.request.get(`/api/articles?feedId=${feed.id}`)
	).json()) as ArticlePage;
	const first = list.articles[0];
	const second = list.articles[1];
	if (!first || !second) throw new Error("Missing isolated fixture articles");
	return { feed, first, second };
}

test("AI results persist, cached views avoid requests, and extraction invalidates old results", async ({
	page,
}) => {
	const { feed, first, second } = await fixture(page);
	try {
		await page.goto(`/feeds/${feed.id}/articles/${first.id}`);
		await expect(page.locator(".prose")).toBeVisible();
		await expect(page.locator(".reader-assistant")).toContainText("自动化测试 · 模拟 AI");
		const calls: string[] = [];
		page.on("request", (request) => {
			if (request.method() === "POST" && request.url().endsWith(`/${first.id}/ai`))
				calls.push(request.postData() ?? "");
		});
		await page.getByRole("button", { name: "AI 摘要", exact: true }).click();
		const summary = page.getByRole("complementary", { name: "AI 摘要" });
		await expect(summary).toContainText("本地模拟摘要");
		await page.getByRole("button", { name: "翻译标题", exact: true }).click();
		await expect(page.locator(".article-context h1")).toContainText("阅读手记");
		await page.getByRole("button", { name: "翻译全文", exact: true }).click();
		await expect(page.locator(".prose")).toContainText("本地模拟译文");
		expect(calls).toHaveLength(3);
		await page.getByRole("button", { name: "收起摘要", exact: true }).click();
		await expect(summary).toHaveCount(0);
		await page.getByRole("button", { name: "查看摘要", exact: true }).click();
		await expect(summary).toBeVisible();
		await page.getByRole("button", { name: "显示原标题", exact: true }).click();
		await expect(page.locator(".article-context h1")).toHaveText(first.title);
		await page.getByRole("button", { name: "显示中文标题", exact: true }).click();
		await page.getByRole("button", { name: "阅读原文", exact: true }).click();
		await expect(page.locator(".prose")).toContainText("Every good tool");
		await page.getByRole("button", { name: "阅读译文", exact: true }).click();
		expect(calls).toHaveLength(3);
		await page.reload();
		await expect(summary).toContainText("本地模拟摘要");
		await expect(page.locator(".article-context h1")).toContainText("阅读手记");
		await expect(page.locator(".prose")).toContainText("本地模拟译文");
		// Manual choices apply to this visit; returning opens the persisted results again.
		await page.getByRole("button", { name: "阅读原文", exact: true }).click();
		await page.getByRole("button", { name: "收起摘要", exact: true }).click();
		await page.getByRole("button", { name: "显示原标题", exact: true }).click();
		await page.getByRole("button", { name: "返回文章列表", exact: true }).click();
		await page.locator(`[data-article-id="${second.id}"]`).click();
		await expect(page.locator(".article-context h1")).toHaveText(second.title);
		await expect(page.locator(".translation-note")).toHaveCount(0);
		await expect(summary).toHaveCount(0);
		await page.getByRole("button", { name: "返回文章列表", exact: true }).click();
		await page.locator(`[data-article-id="${first.id}"]`).click();
		await expect(page.locator(".article-context h1")).toContainText("阅读手记");
		await expect(summary).toContainText("本地模拟摘要");
		await expect(page.locator(".prose")).toContainText("本地模拟译文");
		expect(calls).toHaveLength(3);
		await page.getByRole("button", { name: "重新生成摘要", exact: true }).click();
		await expect(page.getByRole("button", { name: "重新生成摘要", exact: true })).toBeEnabled();
		expect(JSON.parse(calls[3] ?? "{}")).toEqual({ action: "summary", force: true });
		for (const [label, action] of [
			["重新翻译标题", "translate-title"],
			["重新翻译全文", "translate"],
		]) {
			const done = page.waitForResponse(
				(response) =>
					response.url().endsWith(`/${first.id}/ai`) && response.request().method() === "POST",
			);
			await page.getByRole("button", { name: label, exact: true }).click();
			expect((await done).ok()).toBe(true);
			await expect(page.getByRole("button", { name: label, exact: true })).toBeEnabled();
			expect(JSON.parse(calls.at(-1) ?? "{}")).toEqual({ action, force: true });
		}
		await page.getByRole("button", { name: "提取全文", exact: true }).click();
		await expect(page.locator(".extraction-complete")).toHaveText("全文已提取");
		await expect(page.locator(".translation-note")).toHaveCount(0);
		await expect(summary).toHaveCount(0);
		const saved = (await (
			await page.request.get(`/api/articles/${first.id}`)
		).json()) as ArticleDetail;
		expect(saved.summary).toBeNull();
		expect(saved.translated_content).toBeNull();
		await page.getByRole("button", { name: "翻译全文", exact: true }).click();
		await expect(page.locator(".prose")).toContainText("本地模拟译文");
		await page.screenshot({ path: `test-results/l3/ai-results-${test.info().project.name}.png` });
	} finally {
		await page.request.delete(`/api/feeds/${feed.id}`);
	}
});

test("AI failure stays visible, retries succeed, and pending requests belong to their article", async ({
	page,
}) => {
	const { feed, first, second } = await fixture(page);
	let release = () => {};
	try {
		await page.goto(`/feeds/${feed.id}/articles/${first.id}`);
		await expect(page.locator(".prose")).toBeVisible();
		const path = `**/api/articles/${first.id}/ai`;
		await page.route(path, (route) =>
			route.fulfill({ status: 429, json: { error: "AI 服务额度不足，请稍后重试" } }),
		);
		await page.getByRole("button", { name: "AI 摘要", exact: true }).click();
		await expect(page.locator(".assistant-error")).toContainText("额度不足");
		await page.getByRole("button", { name: "检查 AI 设置", exact: true }).click();
		await expect(page.getByRole("tab", { name: "AI 助手" })).toHaveAttribute(
			"aria-selected",
			"true",
		);
		await page.keyboard.press("Escape");
		await page.unroute(path);
		await page.getByRole("button", { name: "重试", exact: true }).click();
		await expect(page.getByRole("complementary", { name: "AI 摘要" })).toContainText(
			"本地模拟摘要",
		);
		await expect(page.locator(".assistant-error")).toHaveCount(0);
		await page.route(path, (route) =>
			route.fulfill({ status: 502, json: { error: "AI 请求超时，请重试" } }),
		);
		await page.getByRole("button", { name: "翻译全文", exact: true }).click();
		await expect(page.locator(".assistant-error")).toContainText("AI 请求超时");
		await expect(page.locator(".prose")).toContainText("Every good tool");
		await page.unroute(path);
		const gate = new Promise<void>((resolve) => {
			release = resolve;
		});
		await page.route(path, async (route) => {
			await gate;
			await route.continue();
		});
		await page.getByRole("button", { name: "重试", exact: true }).click();
		await expect(page.getByRole("button", { name: "正在翻译全文…", exact: true })).toBeDisabled();
		await expect(page.locator(".reader-assistant [role=status]")).toContainText("可切换文章");
		await page.getByRole("button", { name: "返回文章列表", exact: true }).click();
		await page.locator(`[data-article-id="${second.id}"]`).click();
		await expect(page.locator(".article-context h1")).toHaveText(second.title);
		await expect(page.locator(".reader-assistant [role=status]")).toHaveCount(0);
		release();
		await expect
			.poll(
				async () =>
					((await (await page.request.get(`/api/articles/${first.id}`)).json()) as ArticleDetail)
						.translated_content,
			)
			.toContain("本地模拟译文");
		await expect(page.locator(".translation-note")).toHaveCount(0);
		await expect(page.locator(".article-context h1")).toHaveText(second.title);
		await page.getByRole("button", { name: "返回文章列表", exact: true }).click();
		await page.locator(`[data-article-id="${first.id}"]`).click();
		await expect(page.locator(".prose")).toContainText("本地模拟译文");
		await page.route(`**/api/articles/${first.id}/full`, (route) =>
			route.fulfill({ status: 502, json: { error: "无法提取正文，可以打开原文阅读" } }),
		);
		await page.getByRole("button", { name: "提取全文", exact: true }).click();
		await expect(page.locator(".assistant-error")).toContainText("无法提取正文");
		await expect(page.locator(".prose")).toContainText("本地模拟译文");
		await page.unroute(`**/api/articles/${first.id}/full`);
		await page.getByRole("button", { name: "重试", exact: true }).click();
		await expect(page.locator(".extraction-complete")).toBeVisible();
	} finally {
		release();
		await page.request.delete(`/api/feeds/${feed.id}`);
	}
});

test("settings use accessible vertical navigation and AI configuration is required outside demo mode", async ({
	page,
}) => {
	await page.route("**/api/ai/settings", (route) =>
		route.fulfill({
			json: { provider: "minimax", model: "MiniMax-M2.5", hasApiKey: false, mock: false },
		}),
	);
	const { feed, first } = await fixture(page);
	try {
		await page.goto(`/feeds/${feed.id}/articles/${first.id}`);
		await expect(page.locator(".reader-assistant")).toContainText("尚未配置 AI");
		for (const name of ["AI 摘要", "翻译标题", "翻译全文"])
			await expect(page.getByRole("button", { name, exact: true })).toBeDisabled();
		await expect(page.getByRole("button", { name: "提取全文", exact: true })).toBeEnabled();
		await page.getByRole("button", { name: "AI 设置", exact: true }).click();
		const nav = page.getByRole("tablist", { name: "设置范围" });
		await expect(nav).toHaveAttribute("aria-orientation", "vertical");
		await page.getByRole("tab", { name: "阅读", exact: true }).focus();
		await page.keyboard.press("ArrowDown");
		await expect(page.getByRole("tab", { name: "AI 助手" })).toBeFocused();
		for (const name of [/^订阅源/, /^分类/, /^阅读$/, /^AI 助手$/, /^数据管理$/]) {
			await page.getByRole("tab", { name }).click();
			const content = page.getByRole("tabpanel");
			await expect(content).toBeVisible();
			await content.evaluate(async (element) => {
				await Promise.allSettled(element.getAnimations().map((animation) => animation.finished));
			});
			await expect(content).toHaveCSS("opacity", "1");
			const left = await nav.boundingBox();
			const right = await content.boundingBox();
			expect(left && right && left.x + left.width <= right.x).toBe(true);
			expect(
				await page
					.locator(".settings-content")
					.evaluate((element) => element.scrollWidth <= element.clientWidth + 1),
			).toBe(true);
			const violations = (
				await new AxeBuilder({ page })
					.include(".settings-dialog")
					.withTags(["wcag2a", "wcag2aa", "wcag21aa"])
					.analyze()
			).violations;
			expect(violations).toEqual([]);
		}
		await page.screenshot({
			path: `test-results/l3/settings-vertical-${test.info().project.name}.png`,
		});
	} finally {
		await page.request.delete(`/api/feeds/${feed.id}`);
	}
});

test("per-feed full translation persists, starts on opening and silently reuses cached text", async ({
	page,
}) => {
	const { feed, first, second } = await fixture(page);
	try {
		await page.goto(`/feeds/${feed.id}`);
		await page.getByRole("button", { name: "订阅设置", exact: true }).click();
		await page.getByRole("switch", { name: "自动翻译全文", exact: true }).check();
		await page.getByRole("button", { name: "保存订阅", exact: true }).click();
		await expect(page.getByRole("dialog", { name: "编辑订阅", exact: true })).toHaveCount(0);
		await page.reload();
		await page.getByRole("button", { name: "订阅设置", exact: true }).click();
		await expect(page.getByRole("switch", { name: "自动翻译全文", exact: true })).toBeChecked();
		await expect(
			page.getByRole("switch", { name: "自动翻译标题和简介", exact: true }),
		).not.toBeChecked();
		await page.getByRole("button", { name: "取消", exact: true }).click();
		const calls: string[] = [];
		page.on("request", (request) => {
			if (request.method() === "POST" && request.url().endsWith("/ai"))
				calls.push(request.postData() ?? "");
		});
		await page.locator(`[data-article-id="${first.id}"]`).click();
		await expect(page.locator(".prose")).toContainText("本地模拟译文");
		expect(calls.map((value) => JSON.parse(value))).toEqual([
			{ action: "translate", automatic: true },
		]);
		await expect(page.getByText(/已自动载入/)).toHaveCount(0);
		await page.getByRole("button", { name: "阅读原文", exact: true }).click();
		await expect(page.locator(".prose")).toContainText("Every good tool");
		await page.reload();
		await expect(page.locator(".prose")).toContainText("本地模拟译文");
		expect(calls).toHaveLength(1);
		await page.getByRole("button", { name: "返回文章列表", exact: true }).click();
		await page.getByRole("button", { name: "订阅设置", exact: true }).click();
		await page.getByRole("switch", { name: "自动翻译全文", exact: true }).uncheck();
		await page.getByRole("button", { name: "保存订阅", exact: true }).click();
		await expect(page.getByRole("dialog", { name: "编辑订阅", exact: true })).toHaveCount(0);
		await page.locator(`[data-article-id="${second.id}"]`).click();
		await expect(page.locator(".prose")).toContainText("Every good tool");
		await expect(page.getByRole("button", { name: "翻译全文", exact: true })).toBeEnabled();
		expect(calls).toHaveLength(1);
	} finally {
		await page.request.delete(`/api/feeds/${feed.id}`);
	}
});

test("feed switches align descriptions and automatically fetch before translating with cached reuse", async ({
	page,
}) => {
	const { feed, first, second } = await fixture(page);
	try {
		await page.goto(`/feeds/${feed.id}`);
		await page.getByRole("button", { name: "订阅设置", exact: true }).click();
		const options = page.locator(".feed-options");
		await expect(options.getByRole("switch")).toHaveCount(4);
		for (const control of await options.getByRole("switch").all()) {
			await expect(control).toHaveAccessibleName(/.+/);
			await expect(control).toHaveAccessibleDescription(/.+/);
		}
		await page.getByRole("switch", { name: "自动获取全文", exact: true }).check();
		await page.getByRole("switch", { name: "自动翻译全文", exact: true }).check();
		const layout = await options.locator(".feed-option").evaluateAll((rows) =>
			rows.map((row) => {
				const control = row.querySelector('[role="switch"]')?.getBoundingClientRect();
				const copy = row.querySelector(".feed-option-copy")?.getBoundingClientRect();
				if (!control || !copy) throw new Error("Missing feed option layout");
				return { right: control.right, width: control.width, gap: control.left - copy.right };
			}),
		);
		expect(new Set(layout.map((row) => row.right)).size).toBe(1);
		expect(new Set(layout.map((row) => row.width)).size).toBe(1);
		expect(layout.every((row) => row.gap >= 15)).toBe(true);
		const accessibility = await new AxeBuilder({ page })
			.withTags(["wcag2a", "wcag2aa", "wcag21aa"])
			.analyze();
		expect(accessibility.violations).toEqual([]);
		await page.screenshot({ path: `test-results/l3/feed-options-${test.info().project.name}.png` });
		await page.getByRole("button", { name: "保存订阅", exact: true }).click();
		await expect(page.getByRole("dialog", { name: "编辑订阅", exact: true })).toHaveCount(0);
		await page.reload();
		await page.getByRole("button", { name: "订阅设置", exact: true }).click();
		await expect(page.getByRole("switch", { name: "自动获取全文", exact: true })).toBeChecked();
		await expect(page.getByRole("switch", { name: "自动翻译全文", exact: true })).toBeChecked();
		await page.getByRole("button", { name: "取消", exact: true }).click();
		const calls: string[] = [];
		page.on("request", (request) => {
			if (request.method() === "POST" && /\/(full|ai)$/.test(request.url())) {
				calls.push(new URL(request.url()).pathname);
				expect(request.postDataJSON().automatic).toBe(true);
			}
		});
		await page.route(`**/api/articles/${first.id}/ai`, async (route) => {
			const extracted = (await (
				await page.request.get(`/api/articles/${first.id}`)
			).json()) as ArticleDetail;
			expect(extracted.full_content_fetched).toBe(1);
			await route.continue();
		});
		await page.locator(`[data-article-id="${first.id}"]`).click();
		await expect(page.locator(".prose")).toContainText("本地模拟译文");
		expect(calls).toEqual([`/api/articles/${first.id}/full`, `/api/articles/${first.id}/ai`]);
		await expect(page.locator(".notice")).toHaveCount(0);
		await page.reload();
		await expect(page.locator(".prose")).toContainText("本地模拟译文");
		expect(calls).toHaveLength(2);
		await page.getByRole("button", { name: "查看后台活动详情", exact: true }).click();
		await expect(page.getByRole("log")).toContainText("自动提取全文 · 已完成");
		await expect(page.getByRole("log")).toContainText("自动翻译全文 · 已完成");
		await page.keyboard.press("Escape");
		await page.getByRole("button", { name: "返回文章列表", exact: true }).click();
		await page.getByRole("button", { name: "订阅设置", exact: true }).click();
		await page.getByRole("switch", { name: "自动获取全文", exact: true }).uncheck();
		await page.getByRole("switch", { name: "自动翻译全文", exact: true }).uncheck();
		await page.getByRole("button", { name: "保存订阅", exact: true }).click();
		await expect(page.getByRole("dialog", { name: "编辑订阅", exact: true })).toHaveCount(0);
		await page.locator(`[data-article-id="${second.id}"]`).click();
		await expect(page.getByRole("button", { name: "提取全文", exact: true })).toBeEnabled();
		expect(calls).toHaveLength(2);
	} finally {
		await page.request.delete(`/api/feeds/${feed.id}`);
	}
});

test("AI Basalt selectors support preset and custom models and persist SDK selection", async ({
	page,
}) => {
	const original = (await (await page.request.get("/api/ai/settings")).json()) as AiSettings;
	try {
		await page.goto("/");
		await page.getByRole("button", { name: "阅读器设置", exact: true }).click();
		await page.getByRole("tab", { name: "AI 助手" }).click();
		const provider = page.getByRole("combobox", { name: "Provider", exact: true });
		await provider.click();
		await page.getByRole("option", { name: "Anthropic", exact: true }).click();
		const model = page.getByRole("combobox", { name: "Model", exact: true });
		await model.click();
		await page.getByRole("option", { name: "claude-sonnet-4-20250514", exact: true }).click();
		await expect(model).toHaveText("claude-sonnet-4-20250514");
		await model.click();
		await page.getByRole("option", { name: "Custom model...", exact: true }).click();
		await page.getByRole("textbox", { name: "Model", exact: true }).fill("custom-model");
		await page.getByRole("button", { name: "List", exact: true }).click();
		await expect(model).toHaveText("Select model...");
		await provider.click();
		await page.getByRole("option", { name: "Custom", exact: true }).click();
		await page.getByRole("textbox", { name: "Model", exact: true }).fill("test-model");
		await page.getByLabel("Base URL").fill("https://api.example.com/v1");
		const sdk = page.getByRole("combobox", { name: "SDK Type", exact: true });
		await sdk.click();
		await page.getByRole("option", { name: "OpenAI", exact: true }).click();
		await expect(page.locator('.next-ai-panel select:not([aria-hidden="true"])')).toHaveCount(0);
		await page.evaluate(() => {
			document.documentElement.classList.remove("dark");
			document.documentElement.classList.add("light");
			document.documentElement.dataset.mode = "light";
		});
		for (const control of await page
			.locator('.next-ai-panel input, .next-ai-panel [role="combobox"]')
			.all())
			await expect(control).toHaveCSS("background-color", "rgb(255, 255, 255)");
		await page.locator(".next-ai-panel").evaluate(async (element) => {
			await Promise.allSettled(
				element.getAnimations({ subtree: true }).map((animation) => animation.finished),
			);
		});
		expect((await new AxeBuilder({ page }).include(".next-ai-panel").analyze()).violations).toEqual(
			[],
		);
		await page.getByRole("button", { name: "Save Settings", exact: true }).click();
		await expect
			.poll(async () => (await (await page.request.get("/api/ai/settings")).json()).model)
			.toBe("test-model");
		await page.reload();
		await page.getByRole("button", { name: "阅读器设置", exact: true }).click();
		await page.getByRole("tab", { name: "AI 助手" }).click();
		await expect(sdk).toHaveText("OpenAI");
		await expect(page.getByRole("textbox", { name: "Model", exact: true })).toHaveValue(
			"test-model",
		);
	} finally {
		const { hasApiKey: _hasApiKey, mock: _mock, ...settings } = original;
		expect((await page.request.patch("/api/ai/settings", { data: settings })).ok()).toBe(true);
	}
});
