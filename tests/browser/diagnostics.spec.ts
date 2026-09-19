import { expect, test } from "@playwright/test";
import type { Feed, FeedDiagnostic } from "../../src/shared/contracts";

test("metadata-only RSS cannot score highly and legacy reports request a body recheck", async ({
	page,
}) => {
	const response = await page.request.post("/api/feeds", {
		data: {
			url: `https://demo.geekhub.example/rss/simon?content=none&diagnostic=${crypto.randomUUID()}`,
			title: "Metadata-only RSS",
		},
	});
	expect(response.status()).toBe(201);
	const feed = (await response.json()) as Feed;
	try {
		await page.request.patch(`/api/feeds/${feed.id}`, {
			data: { site_url: "https://demo.geekhub.example/site/missing" },
		});
		await page.goto(`/feeds/${feed.id}`);
		await page.getByRole("button", { name: `诊断 ${feed.title}`, exact: true }).click();
		const dialog = page.getByRole("dialog", { name: "订阅源诊断", exact: true });
		await expect(dialog.getByTestId("diagnostic-total")).toHaveText("49/ 100", { timeout: 20000 });
		await expect(dialog.locator(".diagnostic-score")).toHaveAttribute(
			"data-recommendation",
			"review",
		);
		await expect(dialog.locator(".score-dimensions")).toContainText("0 条有有效正文或摘要");
		await expect(dialog.locator(".score-dimensions")).toContainText("40 / 100");
		await expect(dialog).toContainText("未返回有效正文或摘要，总分上限为 49 分");
		await expect(dialog).toContainText("订阅内容不足，建议检查正文");
		const path = `/api/feeds/${feed.id}/diagnostics`;
		const persisted = (await (await page.request.get(path)).json()) as FeedDiagnostic;
		expect(persisted.report?.feed).toMatchObject({
			entries: 6,
			readableEntries: 6,
			contentEntries: 0,
		});
		let reruns = 0;
		page.on("request", (request) => {
			if (request.method() === "POST" && request.url().endsWith(path)) reruns++;
		});
		await page.reload();
		await page.getByRole("button", { name: `诊断 ${feed.title}`, exact: true }).click();
		await expect(dialog.getByTestId("diagnostic-total")).toHaveText("49/ 100");
		expect(reruns).toBe(0);
		await page.screenshot({
			path: `test-results/l3/diagnostic-content-${test.info().project.name}.png`,
		});
		// Older D1 reports lack body coverage; never reuse the former metadata-only full score.
		if (!persisted.report) throw new Error("Missing persisted report");
		delete persisted.report.feed.contentEntries;
		await page.route(`**${path}`, (route) => route.fulfill({ json: persisted }));
		await page.reload();
		await page.getByRole("button", { name: `诊断 ${feed.title}`, exact: true }).click();
		await expect(dialog.getByTestId("diagnostic-total")).toHaveText("79/ 100");
		await expect(dialog.locator(".score-total")).toContainText("暂定评分");
		await expect(dialog.locator(".score-dimensions")).toContainText("旧报告没有检查正文");
	} finally {
		await page.request.delete(`/api/feeds/${feed.id}`);
	}
});
