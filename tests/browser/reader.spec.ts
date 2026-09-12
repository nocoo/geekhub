import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { APP_VERSION } from "../../src/shared/version";

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
	await page.getByRole("button", { name: /^(AI 摘要|查看摘要)$/ }).click();
	await expect(page.getByRole("complementary", { name: "AI 摘要" })).toContainText("本地模拟摘要");
	await page.getByRole("button", { name: "翻译全文", exact: true }).click();
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
	await expect(page.locator(".list-meta")).toContainText("最近更新");
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
	if (isMobile) await page.getByRole("button", { name: "切换订阅导航" }).click();
	await page.getByRole("button", { name: "管理订阅", exact: true }).click();
	await page.getByRole("tab", { name: /^分类/ }).click();
	const name = `浏览器分类 ${test.info().project.name}`;
	await page.getByRole("textbox", { name: "新分类名称" }).fill(name);
	await page.getByRole("button", { name: "添加分类", exact: true }).click();
	await expect(page.getByRole("textbox", { name: `分类 ${name}`, exact: true })).toBeVisible();
	await page.keyboard.press("Escape");
	await page.getByRole("button", { name: "添加订阅", exact: true }).click();
	await page
		.getByLabel("订阅地址")
		.fill(`https://demo.geekhub.example/rss/simon?browser=${test.info().project.name}`);
	await page.getByLabel("名称 可选").fill(`Browser feed ${test.info().project.name}`);
	await page.getByLabel("分类", { exact: true }).selectOption({ label: name });
	await page.getByRole("dialog").getByRole("button", { name: "添加订阅", exact: true }).click();
	await expect(page.getByRole("dialog", { name: "添加订阅", exact: true })).toHaveCount(0);
	await page.getByRole("button", { name: "管理订阅", exact: true }).click();
	const feed = page
		.locator(".manage-feed")
		.filter({ hasText: `Browser feed ${test.info().project.name}` });
	await expect(feed).toContainText("6 篇文章", { timeout: 20000 });
	await feed.getByRole("button", { name: /^编辑 / }).click();
	await feed.getByLabel("订阅名称").fill(`Updated feed ${test.info().project.name}`);
	await feed.getByRole("button", { name: "保存订阅" }).click();
	const updated = page
		.locator(".manage-feed")
		.filter({ hasText: `Updated feed ${test.info().project.name}` });
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
	await page.getByRole("button", { name: "设置", exact: true }).click();
	await page.getByLabel("文字大小").selectOption("20");
	await page.getByLabel("主题", { exact: true }).selectOption("light");
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
	if (isMobile) await page.keyboard.press("Escape");
	const activity = page.getByRole("button", { name: "查看订阅加载详情" });
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
	await expect(page.getByRole("log", { name: "订阅抓取日志" })).toBeVisible();
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
