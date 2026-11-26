import { expect, test } from "@playwright/test";
import type { ArticlePage, Feed, FetchLog } from "../../src/shared/contracts";

async function openActivity(page: import("@playwright/test").Page) {
	await page.getByRole("button", { name: "查看后台活动详情", exact: true }).click();
}

test("empty lists are centered and offer actions for the actual feed state", async ({ page }) => {
	const feeds = (await (await page.request.get("/api/feeds")).json()) as Feed[];
	const original = feeds[0];
	if (!original) throw new Error("Missing feed");
	let feed: Feed = { ...original, total_count: 0, unread_count: 0, status: "success" };
	let hasFeeds = true;
	await page.route("**/api/feeds", (route) => route.fulfill({ json: hasFeeds ? [feed] : [] }));
	await page.route("**/api/articles?**", (route) =>
		route.fulfill({ json: { articles: [], nextCursor: null } }),
	);
	await page.goto(`/feeds/${feed.id}`);
	const empty = page.locator(".article-scroll > .empty-state");
	await expect(empty).toContainText("订阅暂无文章");
	await expect(empty.getByRole("button", { name: "添加订阅" })).toHaveCount(0);
	const offset = await empty.evaluate((element) => {
		const parent = element.parentElement?.getBoundingClientRect();
		const first = element.firstElementChild?.getBoundingClientRect();
		const last = element.lastElementChild?.getBoundingClientRect();
		if (!parent || !first || !last) throw new Error("Missing empty state layout");
		return Math.abs((first.top + last.bottom) / 2 - (parent.top + parent.bottom) / 2);
	});
	expect(offset).toBeLessThan(3);
	let refreshes = 0;
	await page.route(`**/api/feeds/${feed.id}/refresh`, (route) => {
		refreshes++;
		return route.fulfill({ status: 202, json: { queued: true } });
	});
	await empty.getByRole("button", { name: "刷新订阅", exact: true }).click();
	await expect.poll(() => refreshes).toBe(1);
	feed = { ...feed, status: "error", last_error: "HTTP 503 · upstream unavailable" };
	await page.reload();
	await expect(empty).toContainText("订阅更新失败");
	await expect(empty).toContainText("HTTP 503");
	await empty.getByRole("button", { name: "诊断订阅源" }).click();
	await expect(page.getByRole("dialog", { name: "订阅源诊断" })).toBeVisible();
	await page.keyboard.press("Escape");
	feed = { ...feed, status: "queued" };
	await page.reload();
	await expect(empty.getByRole("button", { name: "正在同步…" })).toBeDisabled();
	await page.goto(`/feeds/${feed.id}?q=missing`);
	await expect(empty.getByRole("button", { name: "重置关键词" })).toBeVisible();
	await empty.getByRole("button", { name: "重置关键词" }).click();
	await expect(page).not.toHaveURL(/q=/);
	hasFeeds = false;
	await page.goto("/");
	await expect(empty.getByRole("button", { name: "添加订阅" })).toBeVisible();
});

test("automatic full translation appears in the activity center without a toast", async ({
	page,
}) => {
	const response = await page.request.post("/api/feeds", {
		data: {
			url: `https://demo.geekhub.example/rss/simon?activity=${crypto.randomUUID()}`,
			title: `Activity workflow ${crypto.randomUUID().slice(0, 8)}`,
			auto_translate_content: true,
		},
	});
	expect(response.ok()).toBe(true);
	const feed = (await response.json()) as Feed;
	try {
		await expect
			.poll(
				async () =>
					(
						(await (
							await page.request.get(`/api/articles?feedId=${feed.id}`)
						).json()) as ArticlePage
					).articles.length,
			)
			.toBeGreaterThan(0);
		const article = (
			(await (await page.request.get(`/api/articles?feedId=${feed.id}`)).json()) as ArticlePage
		).articles[0];
		if (!article) throw new Error("Missing article");
		await page.goto(`/feeds/${feed.id}/articles/${article.id}`);
		await expect(page.locator(".prose")).toContainText("本地模拟译文");
		await expect(page.locator("[data-sonner-toast]")).toHaveCount(0);
		await openActivity(page);
		await page.getByRole("button", { name: /自动与手动翻译/ }).click();
		await page.getByRole("combobox", { name: "按订阅源筛选日志" }).click();
		await page.getByRole("option", { name: feed.title, exact: true }).click();
		await expect(page.getByRole("log")).toContainText("自动翻译全文 · 已完成");
		await page.getByRole("combobox", { name: "按状态筛选日志" }).click();
		await page.getByRole("option", { name: "已完成", exact: true }).click();
		const entry = page.locator(".activity-entry").filter({ hasText: "自动翻译全文 · 已完成" });
		await entry.locator("summary").click();
		await expect(entry.getByRole("link", { name: "打开文章" })).toHaveAttribute(
			"href",
			`/feeds/${feed.id}/articles/${article.id}`,
		);
		await expect(entry.locator(".activity-entry-detail")).toContainText(article.title);
		await page.screenshot({ path: `test-results/l3/activity-${test.info().project.name}.png` });
	} finally {
		await page.request.delete(`/api/feeds/${feed.id}`);
	}
});

test("activity categories, errors and search keep separate task details", async ({ page }) => {
	const base = {
		feed_id: null,
		feed_title: "Reading activity",
		articles_added: 0,
		duration_ms: 1200,
		created_at: new Date().toISOString(),
	};
	const logs: FetchLog[] = [
		{
			...base,
			id: 3,
			category: "translation",
			level: "error",
			message: "自动翻译全文 · AI 请求超时",
			article_title: "Long article",
		},
		{ ...base, id: 2, category: "summary", level: "success", message: "生成摘要 · 已完成" },
		{ ...base, id: 1, category: "feed", level: "success", message: "发现 3 篇新文章" },
	];
	await page.route("**/api/logs", (route) => route.fulfill({ json: logs }));
	await page.goto("/");
	await openActivity(page);
	await expect(page.locator(".activity-entry")).toHaveCount(3);
	await page.getByRole("button", { name: /自动与手动翻译/ }).click();
	await expect(page.locator(".activity-entry")).toHaveCount(1);
	await page.getByRole("combobox", { name: "按状态筛选日志" }).click();
	await page.getByRole("option", { name: "失败", exact: true }).click();
	await expect(page.getByRole("log")).toContainText("AI 请求超时");
	await page.getByLabel("搜索活动").fill("unmatched");
	await expect(page.getByRole("log")).toContainText("没有匹配的活动");
	await page.getByLabel("搜索活动").fill("Long article");
	await expect(page.locator(".activity-entry")).toHaveCount(1);
	expect(
		await page.locator(".activity-console").evaluate((el) => el.scrollWidth <= el.clientWidth),
	).toBe(true);
});
