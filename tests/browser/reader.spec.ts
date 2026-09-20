import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import type {
	ArticleDetail,
	ArticlePage,
	Category,
	Feed,
	FeedDiagnostic,
} from "../../src/shared/contracts";
import { APP_VERSION } from "../../src/shared/version";

test("list header shows scoped totals, unread filters and subscription settings", async ({
	page,
}) => {
	const feeds = (await (await page.request.get("/api/feeds")).json()) as Feed[];
	const feed = feeds.find((item) => item.total_count > 0 && item.category_id);
	if (!feed) throw new Error("Missing populated feed fixture");
	await page.goto(`/feeds/${feed.id}`);
	const header = page.locator(".list-heading");
	await expect(header.getByRole("heading", { name: feed.title, exact: true })).toBeVisible();
	await expect(header.getByRole("button", { name: "查看范围内全部文章" })).toContainText(
		feed.total_count.toLocaleString("zh-CN"),
	);
	await expect(header.getByRole("button", { name: "只看范围内未读文章" })).toContainText(
		feed.unread_count.toLocaleString("zh-CN"),
	);
	await expect(header.locator(".list-stat").last()).toContainText(
		`${Math.round(((feed.total_count - feed.unread_count) / feed.total_count) * 100)}%`,
	);
	await header.getByRole("button", { name: "订阅设置", exact: true }).click();
	await expect(page.getByLabel("订阅名称")).toHaveValue(feed.title);
	await page.getByRole("button", { name: "取消", exact: true }).click();
	await header.getByRole("button", { name: "只看范围内未读文章" }).click();
	await expect(page).toHaveURL(new RegExp(`/feeds/${feed.id}\\?view=unread$`));
	await expect(header.getByRole("button", { name: "只看范围内未读文章" })).toHaveAttribute(
		"aria-pressed",
		"true",
	);
	await header.getByRole("button", { name: "查看范围内全部文章" }).click();
	await page.getByRole("button", { name: "在当前范围搜索" }).click();
	await expect(page.getByRole("textbox", { name: "搜索文章", exact: true })).toBeFocused();
	await page.getByRole("textbox", { name: "搜索文章", exact: true }).fill("no-such-header-result");
	await page.getByRole("textbox", { name: "搜索文章", exact: true }).press("Enter");
	await expect(header.locator(".list-count")).toHaveText("0 篇");
	await expect(header.getByRole("button", { name: "查看范围内全部文章" })).toContainText(
		feed.total_count.toLocaleString("zh-CN"),
	);
	await page.getByRole("button", { name: "清除搜索" }).click();
	await expect(header.locator(".list-meta")).toHaveCount(0);
	await page.goto(`/categories/${feed.category_id}`);
	const categoryTotal = feeds
		.filter((item) => item.category_id === feed.category_id)
		.reduce((sum, item) => sum + item.total_count, 0);
	await expect(header.getByRole("button", { name: "查看范围内全部文章" })).toContainText(
		categoryTotal.toLocaleString("zh-CN"),
	);
	await page.goto("/");
	await expect(header.getByRole("button", { name: "查看范围内全部文章" })).toContainText(
		feeds.reduce((sum, item) => sum + item.total_count, 0).toLocaleString("zh-CN"),
	);
	await header.getByRole("button", { name: "阅读器设置", exact: true }).click();
	await expect(page.getByRole("dialog", { name: "设置", exact: true })).toBeVisible();
});

test("sidebar menu edits grouped and ungrouped feeds and confirms deletion", async ({
	page,
	isMobile,
}) => {
	const name = `Sidebar menu ${test.info().project.name}`;
	const response = await page.request.post("/api/feeds", {
		data: {
			url: `https://demo.geekhub.example/rss/simon?menu=${test.info().project.name}`,
			title: name,
		},
	});
	expect(response.ok()).toBe(true);
	const feed = (await response.json()) as Feed;
	try {
		await page.goto("/");
		const sidebar = page.locator(".reader-sidebar");
		const touch = isMobile ? await page.context().newCDPSession(page) : null;
		let firstMenu = true;
		const openMenu = async (title: string) => {
			const trigger = sidebar.getByRole("button", { name: title, exact: true });
			if (!(await trigger.isVisible()))
				await page.getByRole("button", { name: "切换订阅导航" }).click();
			await trigger.scrollIntoViewIfNeeded();
			if (touch) {
				const bounds = await trigger.boundingBox();
				if (!bounds) throw new Error("Missing feed menu trigger");
				// Use a real touch sequence so the overlay sees matching pointer/touch events.
				await touch.send("Input.dispatchTouchEvent", {
					type: "touchStart",
					touchPoints: [{ x: bounds.x + 20, y: bounds.y + bounds.height / 2 }],
				});
				try {
					await expect(page.getByRole("menu")).toBeVisible();
				} finally {
					await touch.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
				}
			} else if (firstMenu) {
				await trigger.click({ button: "right" });
			} else {
				await trigger.focus();
				await trigger.press("Shift+F10");
			}
			firstMenu = false;
			await expect(page.getByRole("menu")).toBeVisible();
		};
		await expect(page.getByTestId("article-item").first()).toBeVisible();
		const before = page.url();
		await openMenu(name);
		expect(page.url()).toBe(before);
		await page.getByRole("menuitem", { name: "编辑订阅" }).click();
		await expect(page.getByRole("dialog", { name: "编辑订阅", exact: true })).toBeVisible();
		const renamed = `${name} updated`;
		await page.getByLabel("订阅名称").fill(renamed);
		const categories = (await (await page.request.get("/api/categories")).json()) as Category[];
		const category = categories[0];
		if (!category) throw new Error("Missing local category fixture");
		await page.getByRole("combobox", { name: "分类", exact: true }).click();
		await page.getByRole("option", { name: category.name, exact: true }).click();
		await page.getByRole("button", { name: "保存订阅", exact: true }).click();
		await expect(page.getByRole("dialog", { name: "编辑订阅", exact: true })).toHaveCount(0);
		await page.reload();
		await expect(page.getByTestId("article-item").first()).toBeVisible();
		await openMenu(renamed);
		await page.getByRole("menuitem", { name: "删除订阅" }).click();
		const confirm = page.getByRole("alertdialog");
		await expect(confirm).toContainText(renamed);
		await expect(confirm).toContainText("文章、收藏和稍后阅读记录将一并删除");
		await confirm.getByRole("button", { name: "保留", exact: true }).click();
		await expect(confirm).toHaveCount(0);
		const remaining = (await (await page.request.get("/api/feeds")).json()) as Feed[];
		expect(remaining.some((item) => item.id === feed.id && item.category_id === category.id)).toBe(
			true,
		);
		const subscription = sidebar.getByRole("button", { name: renamed, exact: true });
		if (isMobile) await subscription.tap();
		else await subscription.click();
		await expect(page).toHaveURL(new RegExp(`/feeds/${feed.id}$`));
		await openMenu(renamed);
		await page.getByRole("menuitem", { name: "删除订阅" }).click();
		await confirm.getByRole("button", { name: "确认删除", exact: true }).click();
		await expect(confirm).toHaveCount(0);
		await expect(sidebar.getByRole("button", { name: renamed, exact: true })).toHaveCount(0);
		const after = (await (await page.request.get("/api/feeds")).json()) as Feed[];
		expect(after.some((item) => item.id === feed.id)).toBe(false);
	} finally {
		await page.request.delete(`/api/feeds/${feed.id}`);
	}
});

test("reading, persistent states, AI summary, translation and original article", async ({
	page,
}) => {
	const errors: string[] = [];
	page.on("pageerror", (error) => errors.push(error.message));
	await page.goto("/");
	const row = page.getByTestId("article-item").first();
	await expect(row).toBeVisible();
	await row.click();
	await expect(page.locator(".prose")).toBeVisible();
	const star = page.getByRole("button", { name: /^(收藏文章|取消收藏)$/ });
	await expect(star).toBeEnabled();
	const wasStarred = await star.getAttribute("aria-pressed");
	await star.click();
	await expect(star).toHaveAttribute("aria-pressed", wasStarred === "true" ? "false" : "true");
	await page.reload();
	await expect(page.locator(".prose")).toBeVisible();
	await expect(page.getByRole("button", { name: /^(收藏文章|取消收藏)$/ })).toHaveAttribute(
		"aria-pressed",
		wasStarred === "true" ? "false" : "true",
	);
	const later = page
		.getByRole("region", { name: "阅读器", exact: true })
		.getByRole("button", { name: /^(稍后阅读|移出稍后阅读)$/ });
	await later.click();
	await expect(later).toBeEnabled();
	const summaryAction = page.getByRole("button", { name: /^(AI 摘要|查看摘要)$/ });
	if (await summaryAction.isVisible()) await summaryAction.click();
	await expect(page.getByRole("complementary", { name: "AI 摘要" })).toContainText("本地模拟摘要");
	const translationAction = page.getByRole("button", { name: /^(翻译全文|阅读译文)$/ });
	if (await translationAction.isVisible()) await translationAction.click();
	await expect(page.locator(".prose")).toContainText("本地模拟译文");
	await page.getByRole("button", { name: "阅读原文", exact: true }).click();
	await expect(page.locator(".prose")).toContainText("Every good tool");
	await expect(page.getByRole("link", { name: "打开原文", exact: true })).toHaveAttribute(
		"rel",
		"noopener noreferrer",
	);
	await page.screenshot({ path: `test-results/l3/reader-${test.info().project.name}.png` });
	await page.getByRole("button", { name: "返回文章列表" }).click();
	await expect(page.getByTestId("article-item").first()).toBeVisible();
	expect(errors).toEqual([]);
});

test("search, navigation and feed/category CRUD", async ({ page, isMobile }) => {
	await page.goto("/");
	await expect(page.getByTestId("article-item").first()).toBeVisible();
	await page.getByTestId("article-item").first().click();
	await expect(page.locator(".prose")).toBeVisible();
	if (isMobile) await page.getByRole("button", { name: "切换订阅导航" }).click();
	await page
		.locator(".reader-sidebar")
		.getByRole("button", { name: "搜索文章", exact: true })
		.click();
	await expect(page.getByRole("textbox", { name: "搜索文章", exact: true })).toBeFocused();
	await page.getByRole("textbox", { name: "搜索文章", exact: true }).fill("quiet craft");
	await page.getByRole("textbox", { name: "搜索文章", exact: true }).press("Enter");
	await expect(page.getByRole("dialog", { name: "搜索文章", exact: true })).toHaveCount(0);
	await expect(page.getByTestId("article-item")).toHaveCount(1);
	await expect(page.getByTestId("article-item")).toBeVisible();
	await page.getByRole("button", { name: "清除搜索" }).click();
	await expect(page.locator(".list-meta")).toHaveCount(0);
	await expect(page.getByRole("button", { name: "查看当前同步状态" })).toBeVisible();
	if (!isMobile) {
		await page.getByRole("button", { name: "切换订阅导航" }).click();
		await page.getByRole("button", { name: "搜索文章", exact: true }).click();
		await expect(page.getByRole("textbox", { name: "搜索文章", exact: true })).toBeFocused();
		await page.keyboard.press("Escape");
		await expect(page.locator(".search-dialog")).toHaveCount(0);
		await page.getByRole("button", { name: "切换订阅导航" }).click();
	}
	await page.keyboard.press("/");
	await expect(page.getByRole("textbox", { name: "搜索文章", exact: true })).toBeFocused();
	await page.keyboard.press("Escape");
	await expect(page.locator(".search-dialog")).toHaveCount(0);
	await page.getByRole("button", { name: "设置", exact: true }).click();
	await page.getByRole("tab", { name: /^分类/ }).click();
	const name = `浏览器分类 ${test.info().project.name}`;
	await page.getByRole("textbox", { name: "新分类名称" }).fill(name);
	await page.getByRole("button", { name: "添加分类", exact: true }).click();
	await expect(page.getByRole("textbox", { name: `分类 ${name}`, exact: true })).toBeVisible();
	await page.getByRole("tab", { name: /^订阅源/ }).click();
	await page.getByRole("dialog").getByRole("button", { name: "添加订阅", exact: true }).click();
	await page
		.getByLabel("订阅地址")
		.fill(`https://demo.geekhub.example/rss/simon?browser=${test.info().project.name}`);
	await page.getByLabel("名称 可选").fill(`Browser feed ${test.info().project.name}`);
	await page.getByRole("combobox", { name: "分类", exact: true }).click();
	await page.getByRole("option", { name, exact: true }).click();
	await page.getByRole("dialog").getByRole("button", { name: "添加订阅", exact: true }).click();
	await expect(page.getByRole("textbox", { name: "筛选订阅源" })).toBeVisible();
	const feed = page
		.locator(".manage-feed")
		.filter({ hasText: `Browser feed ${test.info().project.name}` });
	await expect(feed).toContainText("6 篇文章", { timeout: 20000 });
	await feed.getByRole("button", { name: /^编辑 / }).click();
	await feed.getByLabel("订阅名称").fill(`Updated feed ${test.info().project.name}`);
	await feed
		.getByLabel("RSS 地址", { exact: true })
		.fill(`https://demo.geekhub.example/rss/simon?edited=${test.info().project.name}`);
	await feed.getByLabel("主站地址").fill("https://demo.geekhub.example/site/simon");
	await feed.getByRole("button", { name: "保存订阅" }).click();
	const updated = page
		.locator(".manage-feed")
		.filter({ hasText: `Updated feed ${test.info().project.name}` });
	await expect(updated).toContainText(`edited=${test.info().project.name}`);
	await expect(updated).toContainText("6 篇文章");
	await updated.getByRole("button", { name: /^删除 / }).click();
	await page.getByRole("alertdialog").getByRole("button", { name: "确认删除" }).click();
	await expect(updated).toHaveCount(0);
	await page.getByRole("tab", { name: /^分类/ }).click();
	await page.getByRole("button", { name: `删除分类 ${name}` }).click();
	await page.getByRole("alertdialog").getByRole("button", { name: "确认删除" }).click();
	await expect(page.getByRole("textbox", { name: `分类 ${name}` })).toHaveCount(0);
});

test("reading preferences, public next-ai settings and logs", async ({ page, isMobile }) => {
	await page.goto("/");
	await expect(page.getByTestId("article-item").first()).toBeVisible();
	if (isMobile) await page.getByRole("button", { name: "切换订阅导航" }).click();
	await expect(page.locator(".brand .version")).toHaveText(`v${APP_VERSION}`);
	await expect(page.getByText("本地读者", { exact: true })).toBeVisible();
	if (isMobile) await page.keyboard.press("Escape");
	await page.getByRole("button", { name: "设置", exact: true }).click();
	await page.getByRole("tab", { name: "阅读", exact: true }).click();
	await page.getByRole("combobox", { name: "文字大小" }).click();
	await page.getByRole("option", { name: "20 px", exact: true }).click();
	await page.getByRole("combobox", { name: "主题", exact: true }).click();
	await page.getByRole("option", { name: "浅色", exact: true }).click();
	await page.getByRole("button", { name: "保存阅读偏好" }).click();
	await expect(page.getByText("阅读偏好已保存", { exact: true })).toBeVisible();
	await expect(page.locator("html")).toHaveClass(/light/);
	await page.getByRole("tab", { name: "AI 助手" }).click();
	await expect(page.locator(".next-ai-panel")).toBeVisible();
	await page.getByRole("button", { name: /测试连接|Test Connection/i }).click();
	await expect(page.locator(".next-ai-panel")).toContainText(/连接成功|成功|Success/i);
	await page.getByRole("tab", { name: "数据管理" }).click();
	await expect(page.locator(".stats-grid")).toContainText("已保存文章");
	await page.keyboard.press("Escape");
	await expect(page.locator(".app-dialog")).toHaveCount(0);
	const activity = page.getByRole("button", { name: "查看后台活动详情" });
	const refresh = page.getByRole("button", { name: "刷新订阅", exact: true });
	const activityBox = await activity.boundingBox();
	const refreshBox = await refresh.boundingBox();
	expect(activityBox).not.toBeNull();
	expect(refreshBox).not.toBeNull();
	if (!activityBox || !refreshBox) throw new Error("Header controls are missing");
	expect(activityBox.y).toBeLessThan(56);
	expect(activityBox.height).toBeLessThanOrEqual(40);
	expect(activityBox.x + activityBox.width).toBeLessThan(refreshBox.x);
	await activity.click();
	await expect(page.getByRole("log", { name: "后台活动日志" })).toBeVisible();
	await expect(page.getByRole("dialog")).toContainText("最近 500 条内存记录");
	await page.keyboard.press("Escape");
	await expect(page.locator(".app-dialog")).toHaveCount(0);
	await page.screenshot({ path: `test-results/l3/light-${test.info().project.name}.png` });
});

test("accessible reader, responsive layout and discovery", async ({ page, isMobile }) => {
	await page.goto("/");
	await expect(page.getByTestId("article-item").first()).toBeVisible();
	await page.getByTestId("article-item").first().click();
	await expect(page.locator(".prose")).toBeVisible();
	const results = await new AxeBuilder({ page })
		.withTags(["wcag2a", "wcag2aa", "wcag21aa"])
		.analyze();
	expect(results.violations).toEqual([]);
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
		true,
	);
	if (isMobile) await page.getByRole("button", { name: "切换订阅导航" }).click();
	await page.getByRole("button", { name: "发现好内容", exact: true }).first().click();
	await expect(page.getByRole("dialog")).toContainText("Cloudflare Blog");
	await page.getByRole("textbox", { name: "搜索发现内容" }).fill("不存在的搜索内容");
	await expect(page.getByRole("dialog")).toContainText("没有找到匹配的订阅源");
});

async function chooseSidebar(page: Page, isMobile: boolean, name: string) {
	if (isMobile) await page.getByRole("button", { name: "切换订阅导航" }).click();
	await page.locator(".reader-sidebar").getByRole("button", { name }).click();
}

async function settledFeed(page: Page, id: string) {
	await expect
		.poll(
			async () => {
				const feeds = (await (await page.request.get("/api/feeds")).json()) as Feed[];
				return feeds.find((feed) => feed.id === id)?.status;
			},
			{ timeout: 15000 },
		)
		.toBe("success");
}

test("feed/category paths, browser history, search and article positions survive reloads", async ({
	page,
	isMobile,
}) => {
	await page.goto("/");
	await expect(page.getByTestId("article-item").first()).toBeVisible();
	await chooseSidebar(page, isMobile, "Cloudflare Blog");
	await expect(page).toHaveURL(/\/feeds\/cloudflare$/);
	const row = page.getByTestId("article-item").last();
	await row.scrollIntoViewIfNeeded();
	const id = await row.getAttribute("data-article-id");
	const listTop = await page.locator(".article-scroll").evaluate((element) => element.scrollTop);
	await row.click();
	await expect(page).toHaveURL(new RegExp(`/feeds/cloudflare/articles/${id}$`));
	await expect(page.locator(".prose")).toBeVisible();
	await page.locator(".reader-scroll").evaluate((element) => {
		element.scrollTop = 320;
	});
	await expect
		.poll(() => page.locator(".reader-scroll").evaluate((element) => element.scrollTop))
		.toBe(320);
	await page.reload();
	await expect(page.locator(".reader-source-label")).toHaveText("Cloudflare Blog");
	await expect(page.locator(`[data-article-id="${id}"]`)).toHaveAttribute("aria-current", "true");
	await expect
		.poll(() => page.locator(".reader-scroll").evaluate((element) => element.scrollTop))
		.toBe(320);
	await page.goBack();
	await expect(page).toHaveURL(/\/feeds\/cloudflare$/);
	await expect(page.locator(".article-scroll")).toBeVisible();
	await expect
		.poll(() => page.locator(".article-scroll").evaluate((element) => element.scrollTop))
		.toBe(listTop);
	await page.goForward();
	await expect(page).toHaveURL(new RegExp(`/feeds/cloudflare/articles/${id}$`));
	await expect
		.poll(() => page.locator(".reader-scroll").evaluate((element) => element.scrollTop))
		.toBe(320);
	await chooseSidebar(page, isMobile, "Simon Willison");
	await expect(page).toHaveURL(/\/feeds\/simon$/);
	await page.goBack();
	await expect(page).toHaveURL(new RegExp(`/feeds/cloudflare/articles/${id}$`));
	await expect(page.locator(".reader-source-label")).toHaveText("Cloudflare Blog");
	await chooseSidebar(page, isMobile, "分类 技术与工程");
	await expect(page).toHaveURL(/\/categories\/engineering$/);
	await page.keyboard.press("/");
	await page.getByRole("textbox", { name: "搜索文章", exact: true }).fill("quiet craft");
	await page.getByRole("textbox", { name: "搜索文章", exact: true }).press("Enter");
	await expect(page).toHaveURL(/\/categories\/engineering\?q=quiet\+craft$/);
	await page.getByTestId("article-item").first().click();
	await expect(page.locator(".prose")).toBeVisible();
	const searched = page.url();
	await page.reload();
	await expect(page).toHaveURL(searched);
	await expect(page.locator(".article-context h1")).toContainText("quiet craft");
	await page.getByRole("button", { name: "返回文章列表" }).click();
	await expect(page).toHaveURL(/\/categories\/engineering\?q=quiet\+craft$/);
	await expect(page.getByTestId("article-item")).toHaveCount(1);
	await page.goto(`/?article=${id}`);
	await expect(page).toHaveURL(new RegExp(`/articles/${id}$`));
	await expect(page.locator(".prose")).toBeVisible();
	await page.goto("/feeds/cloudflare/articles/missing-article");
	await expect(page.getByRole("alert")).toContainText("文章不存在");
	await page.getByRole("button", { name: "返回", exact: true }).click();
	await expect(page).toHaveURL(/\/feeds\/cloudflare$/);
});

test("reload and history restore a later article page and both scroll containers", async ({
	page,
}) => {
	const added: Feed[] = [];
	try {
		for (const source of ["simon", "design"]) {
			const response = await page.request.post("/api/feeds", {
				data: {
					title: `History ${source}`,
					url: `https://demo.geekhub.example/rss/${source}?history=${test.info().project.name}`,
				},
			});
			expect(response.status()).toBe(201);
			const feed = (await response.json()) as Feed;
			added.push(feed);
			await settledFeed(page, feed.id);
		}
		await page.goto("/");
		const rows = page.getByTestId("article-item");
		await expect(rows).toHaveCount(30);
		await page.getByRole("button", { name: "加载更多文章", exact: true }).click();
		await expect.poll(() => rows.count()).toBeGreaterThan(30);
		const count = await rows.count();
		const last = rows.last();
		await last.scrollIntoViewIfNeeded();
		const id = await last.getAttribute("data-article-id");
		const top = await page.locator(".article-scroll").evaluate((element) => element.scrollTop);
		expect(top).toBeGreaterThan(1000);
		await last.click();
		await expect(page.locator(".prose")).toBeVisible();
		await page.locator(".reader-scroll").evaluate((element) => {
			element.scrollTop = 360;
		});
		await page.reload();
		await expect(rows).toHaveCount(count);
		await expect(page.locator(`[data-article-id="${id}"]`)).toHaveAttribute("aria-current", "true");
		await expect
			.poll(() => page.locator(".reader-scroll").evaluate((element) => element.scrollTop))
			.toBe(360);
		await page.goBack();
		await expect(page).toHaveURL(/\/$/);
		await expect
			.poll(() => page.locator(".article-scroll").evaluate((element) => element.scrollTop))
			.toBe(top);
		await page.goForward();
		await expect(page).toHaveURL(new RegExp(`/articles/${id}$`));
		await expect
			.poll(() => page.locator(".reader-scroll").evaluate((element) => element.scrollTop))
			.toBe(360);
	} finally {
		for (const feed of added) await page.request.delete(`/api/feeds/${feed.id}`);
	}
});

test("Markdown reading keeps images, typography and responsive reading space", async ({
	page,
	isMobile,
}) => {
	const errors: string[] = [];
	const remoteImages: string[] = [];
	page.on("pageerror", (error) => errors.push(error.message));
	page.on("request", (request) => {
		if (
			request.resourceType() === "image" &&
			new URL(request.url()).hostname === "demo.geekhub.example"
		)
			remoteImages.push(request.url());
	});
	// Only the image bytes are a browser fixture; articles are served by the isolated Worker / D1.
	await page.route("**/api/images?url=*reading.png", async (route) => {
		const response = await page.request.get("/logo-256.png");
		await route.fulfill({ response });
	});
	const result = (await (
		await page.request.get("/api/articles?feedId=design")
	).json()) as ArticlePage;
	const article = result.articles.find(
		(article) => article.title === "Less noise. More room to think.",
	);
	if (!article) throw new Error("Missing local Markdown reading fixture");
	await page.goto(`/feeds/design/articles/${article.id}`);
	const prose = page.locator(".prose");
	await expect(prose).toBeVisible();
	const fonts = await page.evaluate(async () => {
		const faces = await document.fonts.load('18px "TsangerJinKai02"', "中文阅读");
		return faces.map((face) => face.status);
	});
	expect(fonts.length).toBeGreaterThan(0);
	expect(fonts.every((status) => status === "loaded")).toBe(true);
	await expect(prose).toHaveCSS("font-family", /TsangerJinKai02/);
	if (!isMobile) await page.setViewportSize({ width: 1920, height: 1000 });
	const context = await page.locator(".article-context").boundingBox();
	const body = await page.locator(".article-body").boundingBox();
	if (!context || !body) throw new Error("Missing article layout");
	if (isMobile) {
		expect(body.y).toBeGreaterThanOrEqual(context.y + context.height);
	} else {
		expect(body.x).toBeGreaterThan(context.x + context.width);
		expect(body.y).toBe(context.y);
		expect(body.width).toBeGreaterThanOrEqual(600);
	}
	await expect(prose.getByRole("heading", { name: "让内容决定顺序" })).toBeVisible();
	await expect(prose.getByRole("table")).toHaveCount(1);
	await expect(prose.getByRole("cell", { name: "read | think | remember" })).toHaveText(
		"read | think | remember",
	);
	const picture = prose.getByRole("img", { name: "阅读示例插图" });
	await picture.scrollIntoViewIfNeeded();
	await expect
		.poll(() => picture.evaluate((image) => (image as HTMLImageElement).naturalWidth))
		.toBe(256);
	await expect(picture).toHaveAttribute("src", /^\/api\/images\?/);
	await expect(prose.getByRole("link", { name: "进一步阅读" })).toHaveAttribute(
		"href",
		"https://example.com/reading#notes",
	);
	await expect(prose.locator("[style], [class=original-layout], iframe, script")).toHaveCount(0);
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
		true,
	);
	const accessibility = await new AxeBuilder({ page })
		.withTags(["wcag2a", "wcag2aa", "wcag21aa"])
		.analyze();
	expect(accessibility.violations).toEqual([]);
	await page.screenshot({
		path: `test-results/l3/markdown-reader-${test.info().project.name}.png`,
	});
	expect(remoteImages).toEqual([]);
	expect(errors).toEqual([]);
});

test("keyboard navigation, reading actions and editable/modal guards", async ({
	page,
	isMobile,
}) => {
	await page.goto("/");
	const rows = page.getByTestId("article-item");
	await expect(rows.first()).toBeVisible();
	const ids = await rows.evaluateAll((elements) =>
		elements.map((element) => element.getAttribute("data-article-id")),
	);
	await page.keyboard.press("j");
	await expect(page.locator(".prose")).toBeVisible();
	await expect(page).toHaveURL(new RegExp(`/articles/${ids[0]}$`));
	await page.keyboard.press("j");
	await expect(page).toHaveURL(new RegExp(`/articles/${ids[1]}$`));
	await page.keyboard.press("k");
	await expect(page).toHaveURL(new RegExp(`/articles/${ids[0]}$`));
	const star = page.getByRole("button", { name: /^(收藏文章|取消收藏)$/ });
	await expect(star).toBeEnabled();
	const starred = await star.getAttribute("aria-pressed");
	await page.keyboard.press("s");
	await expect(star).toHaveAttribute("aria-pressed", starred === "true" ? "false" : "true");
	const later = page
		.getByRole("region", { name: "阅读器", exact: true })
		.getByRole("button", { name: /^(稍后阅读|移出稍后阅读)$/ });
	await expect(later).toBeEnabled();
	const saved = await later.getAttribute("aria-pressed");
	await page.keyboard.press("l");
	await expect(later).toHaveAttribute("aria-pressed", saved === "true" ? "false" : "true");
	await expect(page.getByRole("button", { name: "标为未读", exact: true })).toBeEnabled();
	await page.keyboard.press("m");
	await expect(page.getByRole("button", { name: "标为已读", exact: true })).toBeEnabled();
	// The saved translation is shorter; use the long original to exercise native scrolling.
	const original = page.getByRole("button", { name: "阅读原文", exact: true });
	if (await original.isVisible()) await original.click();
	await expect
		.poll(() =>
			page
				.locator(".reader-scroll")
				.evaluate((element) => element.scrollHeight > element.clientHeight),
		)
		.toBe(true);
	await page.locator(".reader-scroll").focus();
	await page.keyboard.press("ArrowDown");
	await expect(page).toHaveURL(new RegExp(`/articles/${ids[0]}$`));
	await expect
		.poll(() => page.locator(".reader-scroll").evaluate((element) => element.scrollTop))
		.toBeGreaterThan(0);
	await page.keyboard.press("/");
	const search = page.getByRole("textbox", { name: "搜索文章", exact: true });
	await expect(search).toBeFocused();
	await search.pressSequentially("jkslmro");
	await expect(page).toHaveURL(new RegExp(`/articles/${ids[0]}$`));
	await expect(search).toHaveValue("jkslmro");
	await page.keyboard.press("Escape");
	await expect(page.getByRole("dialog")).toHaveCount(0);
	await page.getByRole("button", { name: "设置", exact: true }).click();
	await page.getByRole("tab", { name: /^订阅源/ }).focus();
	await page.keyboard.press("j");
	await expect(page).toHaveURL(new RegExp(`/articles/${ids[0]}$`));
	await page.getByRole("textbox", { name: "筛选订阅源" }).fill("jkslmro");
	await expect(page.getByText("没有匹配的订阅源。", { exact: true })).toBeVisible();
	await page.keyboard.press("Escape");
	await expect(page.getByRole("dialog")).toHaveCount(0);
	await page.keyboard.press("Escape");
	await expect(page).toHaveURL(/\/$/);
	await rows.first().focus();
	await page.keyboard.press("ArrowDown");
	await expect(page).toHaveURL(new RegExp(`/articles/${ids[0]}$`));
	await page.keyboard.press("ArrowDown");
	await expect(rows.nth(1)).toHaveAttribute("aria-current", "true");
	if (!isMobile) {
		await expect(rows.nth(1)).toBeFocused();
		await expect(
			page.locator('.article-item:focus-visible:not([aria-current="true"])'),
		).toHaveCount(0);
	}
	await page.goBack();
	await expect(rows.first()).toHaveAttribute("aria-current", "true");
	if (!isMobile) await expect(rows.first()).toBeFocused();
	await expect(page.locator('.article-item:focus-visible:not([aria-current="true"])')).toHaveCount(
		0,
	);
	await page.goForward();
	await expect(rows.nth(1)).toHaveAttribute("aria-current", "true");
	if (!isMobile) await expect(rows.nth(1)).toBeFocused();
	await page.keyboard.press("ArrowUp");
	await expect(rows.first()).toHaveAttribute("aria-current", "true");
	if (!isMobile) await expect(rows.first()).toBeFocused();
	await expect(
		page.getByRole("link", { name: "GeekHub GitHub 项目", exact: true }),
	).toHaveAttribute("href", "https://github.com/nocoo/geekhub");
});

test("J/K smoothly positions selection at the golden ratio and respects motion preferences", async ({
	page,
	isMobile,
}) => {
	const categoryResponse = await page.request.post("/api/categories", {
		data: { name: `Keyboard ${test.info().project.name}`, color: "violet" },
	});
	expect(categoryResponse.ok()).toBe(true);
	const category = (await categoryResponse.json()) as Category;
	const feeds: Feed[] = [];
	try {
		for (const source of ["simon", "design", "cloudflare", "fieldnotes"]) {
			const response = await page.request.post("/api/feeds", {
				data: {
					title: `Keyboard ${source}`,
					url: `https://demo.geekhub.example/rss/${source}?keyboard=${test.info().project.name}`,
					category_id: category.id,
				},
			});
			expect(response.ok()).toBe(true);
			const feed = (await response.json()) as Feed;
			feeds.push(feed);
			await settledFeed(page, feed.id);
		}
		await page.emulateMedia({ reducedMotion: "no-preference" });
		await page.goto(`/categories/${category.id}`);
		const rows = page.getByTestId("article-item");
		await expect(rows.first()).toBeVisible();
		const list = page.locator(".article-scroll");
		const selected = list.locator('[aria-current="true"]');
		await page.keyboard.press("j");
		await expect(rows.first()).toHaveAttribute("aria-current", "true");
		if (isMobile) {
			for (let i = 0; i < 8; i++) await page.keyboard.press("j");
			await expect(rows.nth(8)).toHaveAttribute("aria-current", "true");
			await expect(page.locator(".prose")).toBeVisible();
			expect(await page.evaluate(() => window.scrollY)).toBe(0);
			await page.keyboard.press("Escape");
			await expect(rows.first()).toBeInViewport();
			return;
		}
		await expect(rows.first()).toBeFocused();
		expect(await list.evaluate((element) => element.scrollTop)).toBe(0);
		await list.evaluate((element) => {
			const positions: number[] = [];
			element.addEventListener("scroll", () => {
				positions.push(element.scrollTop);
				element.setAttribute("data-scroll-samples", JSON.stringify(positions));
			});
		});
		// Rapid repeats must retarget the animation, including while mark-read responses arrive.
		for (let i = 0; i < 12; i++) await page.keyboard.press("j");
		await expect(rows.nth(12)).toBeFocused();
		const alignmentError = () =>
			selected.evaluate((row) => {
				const container = row.closest(".article-scroll");
				if (!container) throw new Error("Missing list container");
				const bounds = row.getBoundingClientRect();
				return Math.abs(
					bounds.top +
						bounds.height / 2 -
						container.getBoundingClientRect().top -
						container.clientHeight * 0.382,
				);
			});
		await expect.poll(alignmentError).toBeLessThan(2);
		const top = await list.evaluate((element) => element.scrollTop);
		const samples = JSON.parse(
			(await list.getAttribute("data-scroll-samples")) ?? "[]",
		) as number[];
		expect(samples.filter((position) => position > 0 && position < top - 2).length).toBeGreaterThan(
			2,
		);
		await page.keyboard.press("k");
		await expect(rows.nth(11)).toBeFocused();
		await expect.poll(alignmentError).toBeLessThan(2);
		expect(await list.evaluate((element) => element.scrollTop)).toBeLessThan(top);
		await page.screenshot({ path: "test-results/l3/keyboard-golden-position.png" });

		await page.emulateMedia({ reducedMotion: "reduce" });
		await page.keyboard.press("j");
		await expect(rows.nth(12)).toBeFocused();
		expect(await alignmentError()).toBeLessThan(2);
		const count = await rows.count();
		for (let i = 13; i < count; i++) await page.keyboard.press("j");
		await expect(rows.last()).toBeFocused();
		expect(
			await list.evaluate((element) =>
				Math.abs(element.scrollTop - (element.scrollHeight - element.clientHeight)),
			),
		).toBeLessThan(2);
		for (let i = 1; i < count; i++) await page.keyboard.press("k");
		await expect(rows.first()).toBeFocused();
		expect(await list.evaluate((element) => element.scrollTop)).toBe(0);
	} finally {
		await page.goto("about:blank");
		for (const feed of feeds) await page.request.delete(`/api/feeds/${feed.id}`);
		await page.request.delete(`/api/categories/${category.id}`);
	}
});

test("background updates load automatically while preserving list anchors, prose and selection", async ({
	page,
	isMobile,
}) => {
	await page.goto("/");
	await expect(page.getByTestId("article-item").first()).toBeVisible();
	await chooseSidebar(page, isMobile, "未读文章");
	const rows = page.getByTestId("article-item");
	await expect(rows.nth(3)).toBeVisible();
	const originalIds = await rows.evaluateAll((elements) =>
		elements.map((element) => element.getAttribute("data-article-id")),
	);
	const visiblePositions = () =>
		page.locator(".article-scroll").evaluate((element) => {
			const bounds = element.getBoundingClientRect();
			return Array.from(element.querySelectorAll<HTMLElement>("[data-article-id]"))
				.filter((row) => {
					const rect = row.getBoundingClientRect();
					return rect.bottom > bounds.top && rect.top < bounds.bottom;
				})
				.map((row) => ({
					id: row.dataset.articleId,
					offset: row.getBoundingClientRect().top - bounds.top,
				}));
		});
	await rows.nth(3).scrollIntoViewIfNeeded();
	const mobilePositions = await visiblePositions();
	await rows.nth(3).click();
	await expect(page.locator(".prose")).toBeVisible();
	await expect(page.getByRole("button", { name: "标为未读", exact: true })).toBeEnabled();
	const selectedUrl = page.url();
	await page
		.locator(".prose p")
		.first()
		.evaluate((element) => {
			element.setAttribute("data-reading-probe", "retained");
			const range = document.createRange();
			range.selectNodeContents(element);
			window.getSelection()?.removeAllRanges();
			window.getSelection()?.addRange(range);
		});
	await page.locator(".reader-scroll").evaluate((element) => {
		element.scrollTop = 240;
	});
	const proseScroll = await page.locator(".reader-scroll").evaluate((element) => element.scrollTop);
	if (!isMobile)
		await page.locator(".article-scroll").evaluate((element) => {
			element.scrollTop = 430;
		});
	const positions = isMobile ? mobilePositions : await visiblePositions();
	const anchor = positions.find((row) => row.id !== originalIds[3]);
	if (!anchor) throw new Error("No surviving visible article to anchor");
	const added = (await (
		await page.request.post("/api/feeds", {
			data: {
				title: `Background ${test.info().project.name}`,
				url: `https://demo.geekhub.example/rss/design?background=${test.info().project.name}`,
			},
		})
	).json()) as Feed;
	try {
		await page.keyboard.press("r");
		await settledFeed(page, added.id);
		await expect.poll(() => rows.count()).toBeGreaterThan(originalIds.length);
		await expect(page.getByText(/已自动载入 \d+ 篇新文章/).first()).toBeVisible();
		await expect(
			page.getByRole("button", { name: "有内容更新，点击载入", exact: true }),
		).toHaveCount(0);
		expect(page.url()).toBe(selectedUrl);
		await expect(page.locator('[data-reading-probe="retained"]')).toHaveCount(1);
		expect(await page.evaluate(() => window.getSelection()?.toString())).toContain(
			"Every good tool",
		);
		expect(await page.locator(".reader-scroll").evaluate((element) => element.scrollTop)).toBe(
			proseScroll,
		);
		if (isMobile) await page.getByRole("button", { name: "返回文章列表" }).click();
		const offsetOf = (id: string) =>
			page
				.locator(`[data-article-id="${id}"]`)
				.evaluate(
					(element) =>
						element.getBoundingClientRect().top -
						(element.parentElement?.getBoundingClientRect().top ?? 0),
				);
		await expect
			.poll(async () => Math.abs((await offsetOf(anchor.id ?? "")) - anchor.offset))
			.toBeLessThan(2);
		await expect(rows.first()).not.toHaveAttribute("data-article-id", originalIds[0] ?? "");
		// A later refresh removing the first visible unread row keeps the next row anchored.
		await page.locator(".article-scroll").evaluate((element) => {
			element.scrollTop = Math.max(element.scrollTop, 240);
		});
		const [removed, remaining] = await visiblePositions();
		if (!removed || !remaining) throw new Error("Two visible articles are needed");
		await page.request.patch(`/api/articles/${removed.id}`, { data: { is_read: true } });
		await page.request.patch(`/api/feeds/${added.id}`, {
			data: { url: `${added.url}&after-read=1` },
		});
		await page.keyboard.press("r");
		await settledFeed(page, added.id);
		await expect(page.locator(`[data-article-id="${removed.id}"]`)).toHaveCount(0);
		await expect
			.poll(async () => Math.abs((await offsetOf(remaining.id ?? "")) - remaining.offset))
			.toBeLessThan(2);
		await page.screenshot({
			path: `test-results/l3/stable-reader-${test.info().project.name}.png`,
		});
	} finally {
		await page.request.delete(`/api/feeds/${added.id}`);
	}
});

test("subscription and category ordering persists, including moving between groups", async ({
	page,
	isMobile,
}) => {
	const suffix = test.info().project.name;
	const category = (await (
		await page.request.post("/api/categories", {
			data: { name: `排序分类 ${suffix}`, color: "violet" },
		})
	).json()) as Category;
	const first = (await (
		await page.request.post("/api/feeds", {
			data: {
				title: `Order A ${suffix}`,
				url: `https://demo.geekhub.example/rss/simon?order-a=${suffix}`,
				category_id: category.id,
			},
		})
	).json()) as Feed;
	const second = (await (
		await page.request.post("/api/feeds", {
			data: {
				title: `Order B ${suffix}`,
				url: `https://demo.geekhub.example/rss/design?order-b=${suffix}`,
				category_id: category.id,
			},
		})
	).json()) as Feed;
	try {
		await page.goto("/");
		await expect(page.getByTestId("article-item").first()).toBeVisible();
		await page.getByRole("button", { name: "设置", exact: true }).click();
		// Wait for both the dialog scale and tab entrance before capturing drag coordinates.
		await page.getByRole("dialog").evaluate(async (element) => {
			await Promise.allSettled(
				element.getAnimations({ subtree: true }).map((animation) => animation.finished),
			);
		});
		await expect(page.getByRole("tabpanel")).toHaveCSS("opacity", "1");
		const group = page.locator(`[data-category-id="${category.id}"]`);
		const orderedIds = () =>
			group
				.locator("[data-feed-id]")
				.evaluateAll((elements) => elements.map((element) => element.getAttribute("data-feed-id")));
		await expect(group).toBeVisible();
		if (isMobile)
			await group.getByRole("button", { name: `上移 ${second.title}`, exact: true }).click();
		else
			await group
				.getByRole("button", { name: `拖动排序 ${second.title}`, exact: true })
				.dragTo(group.locator(`[data-feed-id="${first.id}"]`), { targetPosition: { x: 20, y: 4 } });
		await expect.poll(orderedIds).toEqual([second.id, first.id]);
		await page.reload();
		await page.getByRole("button", { name: "设置", exact: true }).click();
		// Wait for both the dialog scale and tab entrance before capturing drag coordinates.
		await page.getByRole("dialog").evaluate(async (element) => {
			await Promise.allSettled(
				element.getAnimations({ subtree: true }).map((animation) => animation.finished),
			);
		});
		await expect(page.getByRole("tabpanel")).toHaveCSS("opacity", "1");
		await expect.poll(orderedIds).toEqual([second.id, first.id]);
		if (isMobile) {
			await group.getByRole("button", { name: `编辑 ${second.title}`, exact: true }).click();
			await group.getByRole("combobox", { name: "分类", exact: true }).click();
			await page.getByRole("option", { name: "未分类", exact: true }).click();
			await group.getByRole("button", { name: "保存订阅", exact: true }).click();
		} else {
			const uncategorized = page.locator('[data-category-id=""]');
			await uncategorized.scrollIntoViewIfNeeded();
			await group
				.getByRole("button", { name: `拖动排序 ${second.title}`, exact: true })
				.dragTo(uncategorized);
		}
		await expect(page.locator(`[data-category-id=""] [data-feed-id="${second.id}"]`)).toBeVisible();
		await page.getByRole("tab", { name: /^分类/ }).click();
		const orderBefore = await page
			.locator("[data-category-order-id]")
			.evaluateAll((elements) =>
				elements.map((element) => element.getAttribute("data-category-order-id")),
			);
		await page.getByRole("button", { name: `上移 分类 ${category.name}`, exact: true }).click();
		await expect
			.poll(async () =>
				(
					await page
						.locator("[data-category-order-id]")
						.evaluateAll((elements) =>
							elements.map((element) => element.getAttribute("data-category-order-id")),
						)
				).indexOf(category.id),
			)
			.toBe(orderBefore.indexOf(category.id) - 1);
		await page.getByRole("tab", { name: /^订阅源/ }).click();
		await page
			.locator('.settings-tabs [role="tabpanel"][data-state="active"]')
			.evaluate(async (element) => {
				await Promise.all(element.getAnimations().map((animation) => animation.finished));
			});
		const axe = await new AxeBuilder({ page })
			.withTags(["wcag2a", "wcag2aa", "wcag21aa"])
			.analyze();
		expect(axe.violations).toEqual([]);
		expect(
			await page
				.locator(".app-dialog")
				.evaluate((element) => element.scrollWidth <= element.clientWidth),
		).toBe(true);
		await page.screenshot({ path: `test-results/l3/settings-${suffix}.png` });
	} finally {
		await page.request.delete(`/api/feeds/${first.id}`);
		await page.request.delete(`/api/feeds/${second.id}`);
		await page.request.delete(`/api/categories/${category.id}`);
	}
});

test("diagnostic scoring recommends a verified replacement for an unavailable feed", async ({
	page,
	isMobile,
}) => {
	const created = await page.request.post("/api/feeds", {
		data: {
			title: `Retired ${test.info().project.name}`,
			url: `https://demo.geekhub.example/rss/retired?score=${test.info().project.name}`,
		},
	});
	expect(created.status()).toBe(201);
	const feed = (await created.json()) as Feed;
	try {
		const updated = await page.request.patch(`/api/feeds/${feed.id}`, {
			data: { site_url: "https://demo.geekhub.example/site/simon" },
		});
		expect(updated.ok()).toBe(true);
		await page.goto("/");
		await expect(page.getByTestId("article-item").first()).toBeVisible();
		await chooseSidebar(page, isMobile, feed.title);
		await page.getByRole("button", { name: `诊断 ${feed.title}`, exact: true }).click();
		const dialog = page.getByRole("dialog", { name: "订阅源诊断", exact: true });
		await expect(dialog.getByTestId("diagnostic-total")).toHaveText("25/ 100", { timeout: 15000 });
		await expect(dialog.locator(".diagnostic-score")).toHaveAttribute(
			"data-recommendation",
			"replace",
		);
		await expect(dialog.locator(".score-total")).toContainText("暂定评分");
		await expect(
			dialog.locator(".score-dimensions").getByText("未知", { exact: true }),
		).toHaveCount(3);
		await expect(dialog.locator(".score-radar-point")).toHaveCount(2);
		await expect(dialog.locator(".score-radar-area")).toHaveCount(0);
		await expect(dialog.locator(".diagnostic-score")).toContainText("总分上限为 39 分");
		await dialog.getByRole("button", { name: "查看推荐地址", exact: true }).click();
		const replacement = dialog.locator(`#recommended-${feed.id}`);
		await expect(replacement).toBeFocused();
		await expect(replacement).toBeInViewport();
		await expect(replacement).toContainText("推荐核对后替换");
		await expect(replacement).toContainText("discovered=1");
		await replacement.getByRole("button", { name: "使用此地址", exact: true }).click();
		await expect(dialog).toHaveCount(0);
		const feeds = (await (await page.request.get("/api/feeds")).json()) as Feed[];
		expect(feeds.find((item) => item.id === feed.id)?.url).toContain("discovered=1");
		await settledFeed(page, feed.id);
	} finally {
		await page.request.delete(`/api/feeds/${feed.id}`);
	}
});

test("the feed-title diagnostic verifies a replacement and supports pausing without losing articles", async ({
	page,
	isMobile,
}) => {
	const suffix = test.info().project.name;
	const feed = (await (
		await page.request.post("/api/feeds", {
			data: {
				title: `Diagnostic ${suffix}`,
				url: `https://demo.geekhub.example/rss/simon?diagnostic=${suffix}`,
			},
		})
	).json()) as Feed;
	try {
		await settledFeed(page, feed.id);
		const diagnosticPath = `/api/feeds/${feed.id}/diagnostics`;
		const starts: string[] = [];
		page.on("request", (request) => {
			if (new URL(request.url()).pathname === diagnosticPath && request.method() === "POST")
				starts.push(request.url());
		});
		await page.request.patch(`/api/feeds/${feed.id}`, {
			data: { site_url: "https://demo.geekhub.example/site/simon" },
		});
		const articles = (await (
			await page.request.get(`/api/articles?feedId=${feed.id}`)
		).json()) as ArticlePage;
		const retained = articles.articles[0];
		if (!retained) throw new Error("Diagnostic fixture articles are missing");
		await page.request.patch(`/api/articles/${retained.id}`, {
			data: { is_starred: true, is_later: true },
		});
		await page.goto("/");
		await expect(page.getByTestId("article-item").first()).toBeVisible();
		await chooseSidebar(page, isMobile, feed.title);
		await page.getByRole("button", { name: `诊断 ${feed.title}`, exact: true }).click();
		const dialog = page.getByRole("dialog", { name: "订阅源诊断", exact: true });
		await expect(dialog.getByText("当前 RSS", { exact: true })).toBeVisible({ timeout: 15000 });
		await expect(dialog.getByTestId("diagnostic-total")).toHaveText(/\d+\/ 100/);
		await expect(dialog.locator(".score-dimensions dt")).toHaveCount(5);
		await expect(dialog.getByRole("img", { name: /^诊断维度雷达图/ })).toBeVisible();
		await dialog.getByText("评分规则与依据", { exact: true }).click();
		await expect(dialog.locator(".score-rules")).toContainText("本次已知项覆盖 100% 权重");
		await dialog.getByText("评分规则与依据", { exact: true }).click();
		await expect(dialog.locator(".diagnostic-metrics").first()).toContainText("6 条");
		await expect(dialog.locator(".site-checks")).toContainText("HTTPS");
		await expect(dialog.locator(".site-checks")).toContainText("HTTP 200");
		const candidate = dialog.locator(".candidate-card").first();
		await expect(candidate).toContainText("主站声明");
		await expect(candidate).toContainText("discovered=1");
		const axe = await new AxeBuilder({ page })
			.withTags(["wcag2a", "wcag2aa", "wcag21aa"])
			.analyze();
		expect(axe.violations).toEqual([]);
		expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
			true,
		);
		await page.screenshot({ path: `test-results/l3/diagnostic-${suffix}.png` });
		const completed = (await (await page.request.get(diagnosticPath)).json()) as FeedDiagnostic;
		await dialog.getByRole("button", { name: "关闭窗口", exact: true }).click();
		await expect(dialog).toHaveCount(0);
		const reread = page.waitForResponse(
			(response) =>
				new URL(response.url()).pathname === diagnosticPath &&
				response.request().method() === "GET",
		);
		await page.getByRole("button", { name: `诊断 ${feed.title}`, exact: true }).click();
		await reread;
		await expect(dialog.getByText("当前 RSS", { exact: true })).toBeVisible();
		const reused = (await (await page.request.get(diagnosticPath)).json()) as FeedDiagnostic;
		expect(reused.run_id).toBe(completed.run_id);
		expect(starts).toHaveLength(1);
		await candidate.getByRole("button", { name: "使用此地址", exact: true }).click();
		await expect(dialog).toHaveCount(0);
		let current = ((await (await page.request.get("/api/feeds")).json()) as Feed[]).find(
			(item) => item.id === feed.id,
		);
		expect(current?.url).toContain("discovered=1");
		const preserved = (await (
			await page.request.get(`/api/articles/${retained.id}`)
		).json()) as ArticleDetail;
		expect([preserved.is_starred, preserved.is_later]).toEqual([1, 1]);
		await page.request.patch(`/api/feeds/${feed.id}`, {
			data: { site_url: "https://demo.geekhub.example/site/simon" },
		});
		await page.reload();
		await expect(page.getByTestId("article-item").first()).toBeVisible();
		await chooseSidebar(page, isMobile, feed.title);
		await page.getByRole("button", { name: `诊断 ${feed.title}`, exact: true }).click();
		await dialog.getByRole("button", { name: "暂停订阅，保留文章", exact: true }).click();
		await expect(dialog).toHaveCount(0);
		current = ((await (await page.request.get("/api/feeds")).json()) as Feed[]).find(
			(item) => item.id === feed.id,
		);
		expect(current?.is_active).toBe(0);
		expect(current?.total_count).toBe(6);
	} finally {
		await page.request.delete(`/api/feeds/${feed.id}`);
	}
});
