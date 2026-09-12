import { describe, expect, test, vi } from "vitest";
import type {
	ConnectionCheck,
	DiagnosticReport,
	FeedCandidate,
	FeedInspection,
} from "../../src/shared/contracts";
import { assessDiagnostic } from "../../src/web/lib/diagnostic-score";

const inspection = (patch: Partial<FeedInspection> = {}): FeedInspection => ({
	url: "https://example.com/rss",
	finalUrl: "https://example.com/rss",
	status: 200,
	durationMs: 800,
	hops: [{ url: "https://example.com/rss", status: 200 }],
	error: null,
	title: "Example",
	siteUrl: "https://example.com/",
	entries: 10,
	readableEntries: 10,
	oldestAt: "2026-09-01T00:00:00.000Z",
	latestAt: "2026-09-11T00:00:00.000Z",
	undatedEntries: 0,
	futureEntries: 0,
	ageDays: 1,
	...patch,
});
const connection = (patch: Partial<ConnectionCheck> = {}): ConnectionCheck => ({
	url: "https://example.com/",
	finalUrl: "https://example.com/",
	status: 200,
	durationMs: 300,
	hops: [{ url: "https://example.com/", status: 200 }],
	error: null,
	...patch,
});
const report = (patch: Partial<DiagnosticReport> = {}): DiagnosticReport => ({
	checkedAt: "2026-09-12T00:00:00.000Z",
	durationMs: 2000,
	staleAfterDays: 90,
	feed: inspection(),
	siteUrl: "https://example.com/",
	sites: [connection()],
	candidates: [],
	...patch,
});
const failed = (patch: Partial<FeedInspection> = {}) =>
	inspection({
		status: null,
		error: "连接超时，请稍后重试",
		entries: null,
		readableEntries: 0,
		oldestAt: null,
		latestAt: null,
		ageDays: null,
		...patch,
	});
const candidate = (path: string, patch: Partial<FeedInspection> = {}): FeedCandidate => ({
	url: `https://example.com/${path}`,
	source: "page",
	inspection: inspection({ finalUrl: `https://example.com/${path}`, ...patch }),
});
const scores = (input: DiagnosticReport) =>
	Object.fromEntries(assessDiagnostic(input).dimensions.map((item) => [item.id, item.score]));

describe("diagnostic assessment", () => {
	test("a healthy feed has five weighted dimensions and a clear keep recommendation", () => {
		const result = assessDiagnostic(report());
		expect(result.total).toBe(100);
		expect(result.coverage).toBe(100);
		expect(result.dimensions.map((item) => item.weight)).toEqual([30, 30, 20, 10, 10]);
		expect(result.dimensions.every((item) => item.score === 100)).toBe(true);
		expect(result.recommendation.action).toBe("keep");
		expect(result.replacement).toBeNull();
		expect(result.limit).toBeNull();
	});

	test("combines observed completeness, age, speed and HTTP-only access by their weights", () => {
		const input = report({
			feed: inspection({
				ageDays: 45,
				readableEntries: 8,
				undatedEntries: 2,
				futureEntries: 1,
				durationMs: 4000,
			}),
			sites: [connection({ url: "http://example.com/", finalUrl: "http://example.com/" })],
		});
		expect(scores(input)).toEqual({
			availability: 100,
			freshness: 60,
			integrity: 78,
			speed: 60,
			site: 60,
		});
		expect(assessDiagnostic(input)).toMatchObject({
			total: 76,
			coverage: 100,
			recommendation: { action: "review" },
		});
	});

	test("freshness steps and staleness caps change at the documented boundaries", () => {
		for (const [ageDays, expected] of [
			[0, 100],
			[7, 100],
			[8, 85],
			[30, 85],
			[31, 60],
			[89, 60],
			[90, 30],
			[179, 30],
			[180, 10],
			[359, 10],
			[360, 0],
		]) {
			const result = assessDiagnostic(report({ feed: inspection({ ageDays }) }));
			expect(result.dimensions.find((item) => item.id === "freshness")?.score).toBe(expected);
			if (ageDays !== undefined && ageDays >= 90) {
				expect(result.total).toBeLessThanOrEqual(59);
				expect(result.recommendation.action).toBe("pause");
				expect(result.limit).toContain("59");
			}
		}
		expect(
			scores(report({ staleAfterDays: 60, feed: inspection({ ageDays: 60 }) })).freshness,
		).toBe(30);
	});

	test("speed scoring distinguishes successful slow responses and never rewards fast errors", () => {
		for (const [durationMs, expected] of [
			[0, 100],
			[1000, 100],
			[1001, 85],
			[3000, 85],
			[3001, 60],
			[5000, 60],
			[5001, 30],
			[10000, 30],
			[10001, 10],
		]) {
			expect(scores(report({ feed: inspection({ durationMs }) })).speed).toBe(expected);
		}
		const slow = assessDiagnostic(report({ feed: inspection({ durationMs: 6000 }) }));
		expect(slow.recommendation.reason).toContain("响应速度");
		expect(scores(report({ feed: failed({ durationMs: 5 }) })).speed).toBeNull();
	});

	test("missing and future-only dates are unknown and cannot inflate the score into a keep decision", () => {
		for (const dates of [{ undatedEntries: 10 }, { futureEntries: 10 }]) {
			const result = assessDiagnostic(
				report({
					feed: inspection({ ...dates, ageDays: null, oldestAt: null, latestAt: null }),
					siteUrl: null,
					sites: [],
				}),
			);
			expect(result).toMatchObject({
				total: 93,
				coverage: 60,
				recommendation: { action: "review" },
			});
			expect(
				result.dimensions.filter((item) => item.score === null).map((item) => item.id),
			).toEqual(["freshness", "site"]);
			expect(result.recommendation.reason).toContain("暂定");
		}
	});

	test("the 200-entry reading sample does not penalize larger feeds or reward volume", () => {
		for (const entries of [1, 200, 500]) {
			const input = report({
				feed: inspection({ entries, readableEntries: Math.min(entries, 200) }),
			});
			expect(scores(input).integrity).toBe(100);
			expect(assessDiagnostic(input).total).toBe(100);
		}
		expect(
			scores(
				report({ feed: inspection({ entries: 500, readableEntries: 100, undatedEntries: 250 }) }),
			).integrity,
		).toBe(50);
	});

	test("an HTTP 200 parse failure cannot get a healthy score, including missing parser results", () => {
		for (const error of ["没有找到 RSS 或 Atom 订阅内容", null]) {
			const result = assessDiagnostic(report({ feed: failed({ status: 200, error }) }));
			expect(result).toMatchObject({
				total: 25,
				coverage: 40,
				recommendation: { action: "review" },
			});
			expect(result.limit).toContain("39");
			expect(result.dimensions.find((item) => item.id === "availability")?.score).toBe(0);
		}
	});

	test("empty feeds and feeds without readable entries have explicit caps", () => {
		for (const feed of [
			inspection({ entries: 0, readableEntries: 0, ageDays: null }),
			inspection({ readableEntries: 0 }),
		]) {
			const result = assessDiagnostic(report({ feed }));
			expect(result.total).toBe(49);
			expect(result.limit).toContain("没有可读文章");
			expect(result.recommendation.title).toBe("建议检查源内容");
		}
	});

	test("site scores honor the final protocol, including redirects, failures and missing sites", () => {
		const blocked = connection({ error: "HTTP 403", status: 403 });
		const unavailable = connection({ error: "连接失败", status: null });
		expect(scores(report({ sites: [connection(), blocked] })).site).toBe(100);
		expect(scores(report({ sites: [connection({ url: "http://example.com/" })] })).site).toBe(100);
		expect(scores(report({ sites: [connection({ finalUrl: "http://example.com/" })] })).site).toBe(
			60,
		);
		expect(scores(report({ sites: [blocked, unavailable] })).site).toBe(0);
		expect(scores(report({ sites: [connection({ status: 304 })] })).site).toBe(0);
		expect(scores(report({ sites: [] })).site).toBeNull();
		const result = assessDiagnostic(report({ sites: [blocked, unavailable] }));
		expect(result.recommendation).toMatchObject({ action: "review", title: "建议保留并复查" });
		expect(result.recommendation.reason).toContain("主站可达性");
	});

	test("temporary failures require a recheck; missing and gone endpoints may be paused", () => {
		for (const status of [403, 429, 500, null]) {
			expect(assessDiagnostic(report({ feed: failed({ status }) })).recommendation.title).toBe(
				"建议稍后复查",
			);
		}
		for (const status of [404, 410]) {
			expect(assessDiagnostic(report({ feed: failed({ status }) })).recommendation.action).toBe(
				"pause",
			);
		}
	});

	test("recommends the freshest verified replacement, rejecting empty, undated, stale and identical destinations", () => {
		const latest = candidate("newest", { ageDays: 1 });
		const input = report({
			feed: failed({ status: 410 }),
			candidates: [
				candidate("failure", { error: "bad XML" }),
				candidate("empty", { entries: 0, readableEntries: 0 }),
				candidate("unreadable", { readableEntries: 0 }),
				candidate("undated", { ageDays: null }),
				candidate("old", { ageDays: 90 }),
				candidate("rss"),
				candidate("other", { ageDays: 2 }),
				latest,
			],
		});
		const before = structuredClone(input);
		const result = assessDiagnostic(input);
		expect(result.replacement).toBe(latest);
		expect(result.recommendation.action).toBe("replace");
		expect(result.recommendation.reason).toContain("核对内容属于同一订阅");
		expect(input).toEqual(before);
		for (const feed of [
			inspection({ ageDays: 180 }),
			inspection({ entries: 0, readableEntries: 0 }),
		]) {
			expect(assessDiagnostic({ ...input, feed }).replacement).toBe(latest);
		}
		expect(assessDiagnostic({ ...input, feed: inspection() }).replacement).toBeNull();
	});

	test("reopening a saved report preserves its score instead of silently changing its observation time", () => {
		vi.useFakeTimers();
		try {
			const input = report();
			const original = assessDiagnostic(input);
			vi.setSystemTime(new Date("2030-01-01"));
			expect(assessDiagnostic(input)).toEqual(original);
		} finally {
			vi.useRealTimers();
		}
	});
});
