import { load } from "cheerio/slim";
import type {
	ConnectionCheck,
	DiagnosticJob,
	DiagnosticReport,
	Feed,
	FeedCandidate,
	FeedDiagnostic,
	FeedInspection,
} from "../shared/contracts";
import { publicUrl, resolveFeedUrl } from "../shared/validation";
import { getFeed, preferences } from "./data";
import { parseFeed, safeLink } from "./lib/content";
import { errorMessage, fail } from "./lib/errors";
import { fetchPublic, readBounded } from "./lib/network";
import { demoHost, localDiagnosticResponse } from "./local";

type DiagnosticRow = Omit<FeedDiagnostic, "report"> & {
	report: string | null;
	site_url: string | null;
};
const expiryMs = 120_000;

export async function getDiagnostic(
	db: D1Database,
	feedId: string,
): Promise<FeedDiagnostic | null> {
	const row = await db
		.prepare("SELECT * FROM feed_diagnostics WHERE feed_id = ?")
		.bind(feedId)
		.first<DiagnosticRow>();
	if (!row) return null;
	if (
		(row.status === "queued" || row.status === "running") &&
		Date.now() - Date.parse(row.requested_at) > expiryMs
	) {
		row.status = "error";
		row.error = "上次检查已超时，请重新检查";
	}
	return { ...row, report: row.report ? JSON.parse(row.report) : null };
}

export async function enqueueDiagnostic(
	env: Env,
	feed: Feed,
	siteUrl?: string,
): Promise<FeedDiagnostic | null> {
	const runId = crypto.randomUUID();
	const now = new Date().toISOString();
	const claimed = await env.DB.prepare(`INSERT INTO feed_diagnostics
    (feed_id, run_id, feed_url, site_url, status, requested_at) VALUES (?, ?, ?, ?, 'queued', ?)
    ON CONFLICT(feed_id) DO UPDATE SET run_id = excluded.run_id, feed_url = excluded.feed_url,
      site_url = excluded.site_url, status = 'queued', requested_at = excluded.requested_at,
      finished_at = NULL, error = NULL, report = NULL
    WHERE feed_diagnostics.status NOT IN ('queued', 'running') OR feed_diagnostics.requested_at < ?
    RETURNING run_id`)
		.bind(
			feed.id,
			runId,
			feed.url,
			siteUrl ?? null,
			now,
			new Date(Date.now() - expiryMs).toISOString(),
		)
		.first();
	if (claimed) {
		try {
			await env.FEED_QUEUE.send({
				kind: "diagnose",
				feedId: feed.id,
				runId,
			} satisfies DiagnosticJob);
		} catch {
			await env.DB.prepare(
				"UPDATE feed_diagnostics SET status = 'error', error = ? WHERE feed_id = ? AND run_id = ?",
			)
				.bind("诊断队列暂不可用，请重试", feed.id, runId)
				.run();
			fail(502, "诊断队列暂不可用，请重试");
		}
	}
	return getDiagnostic(env.DB, feed.id);
}

async function probe(env: Env, input: string, feed: boolean, deadline: AbortSignal) {
	const started = Date.now();
	const check: ConnectionCheck = {
		url: input,
		finalUrl: input,
		status: null,
		durationMs: 0,
		hops: [],
		error: null,
	};
	let body: string | null = null;
	const trace = (url: string, status: number) => {
		check.finalUrl = url;
		check.status = status;
		check.hops.push({ url, status });
	};
	try {
		const url = publicUrl(input);
		let response: Response;
		if (env.ENVIRONMENT === "local" && url.hostname === demoHost) {
			response = localDiagnosticResponse(url);
			trace(url.href, response.status);
			if (!response.ok) {
				await response.body?.cancel();
				throw new Error(`抓取失败：HTTP ${response.status}`);
			}
		} else {
			response = await fetchPublic(
				url.href,
				{
					Accept: feed
						? "application/rss+xml, application/atom+xml, application/xml, text/xml"
						: "text/html, application/xhtml+xml",
				},
				{ signal: AbortSignal.any([deadline, AbortSignal.timeout(10_000)]), trace },
			);
		}
		body = new TextDecoder().decode(
			await readBounded(response, feed ? 4 * 1024 * 1024 : 1024 * 1024),
		);
	} catch (error) {
		check.error =
			error instanceof DOMException && /Timeout|Abort/.test(error.name)
				? "连接超时，请稍后重试"
				: errorMessage(error).slice(0, 500);
	}
	check.durationMs = Date.now() - started;
	return { check, body };
}

export async function inspectFeed(
	env: Env,
	url: string,
	deadline: AbortSignal,
): Promise<FeedInspection> {
	const { check, body } = await probe(env, url, true, deadline);
	const result: FeedInspection = {
		...check,
		title: null,
		siteUrl: null,
		entries: null,
		readableEntries: 0,
		oldestAt: null,
		latestAt: null,
		undatedEntries: 0,
		futureEntries: 0,
		ageDays: null,
	};
	if (body === null) return result;
	try {
		const parsed = parseFeed(body, check.finalUrl);
		Object.assign(result, {
			title: parsed.title,
			siteUrl: parsed.declaredSiteUrl,
			entries: parsed.entries,
			readableEntries: parsed.articles.length,
			oldestAt: parsed.oldestAt,
			latestAt: parsed.latestAt,
			undatedEntries: parsed.undatedEntries,
			futureEntries: parsed.futureEntries,
			ageDays: parsed.latestAt
				? Math.max(0, Math.floor((Date.now() - Date.parse(parsed.latestAt)) / 86400_000))
				: null,
		});
	} catch (error) {
		result.error = errorMessage(error);
	}
	return result;
}

export function discoverFeedLinks(html: string, pageUrl: string): string[] {
	const $ = load(html);
	const base = safeLink($("base[href]").first().attr("href") ?? "", pageUrl) || pageUrl;
	const urls = new Set<string>();
	for (const element of $("link[href], a[href]").toArray()) {
		const link = $(element);
		const href = link.attr("href") ?? "";
		const type = link.attr("type") ?? "";
		const alternate = /(?:^|\s)alternate(?:\s|$)/i.test(link.attr("rel") ?? "");
		if (
			(alternate && /(?:rss|atom|xml)/i.test(type)) ||
			(element.tagName === "a" &&
				!/sitemap/i.test(href) &&
				/(?:\brss\b|\batom\b|\/feed\b|订阅)/i.test(`${href} ${link.text()}`))
		) {
			const url = safeLink(href, base);
			if (url) urls.add(url);
		}
		if (urls.size === 6) break;
	}
	return [...urls];
}

export async function diagnoseFeed(
	env: Env,
	feed: Feed,
	siteOverride?: string,
): Promise<DiagnosticReport> {
	const started = Date.now();
	const deadline = AbortSignal.timeout(55_000);
	const resolved = resolveFeedUrl(feed.url, (await preferences(env.DB)).rsshubUrl);
	const inspection = await inspectFeed(env, resolved, deadline);
	const hubOrigin = feed.url.startsWith("rsshub://") ? new URL(resolved).origin : null;
	const siteUrl =
		siteOverride ||
		[feed.site_url, inspection.siteUrl].find(
			(site) => site && new URL(site).origin !== hubOrigin,
		) ||
		(hubOrigin ? null : new URL(resolved).origin);
	const sites = siteUrl
		? await Promise.all(
				["https:", "http:"].map(async (protocol) => {
					const url = publicUrl(siteUrl);
					url.protocol = protocol;
					return probe(env, url.href, false, deadline);
				}),
			)
		: [];
	const candidates: FeedCandidate[] = [];
	const urls = new Map<string, FeedCandidate["source"]>();
	if (!inspection.error && inspection.finalUrl !== resolved) {
		candidates.push({ url: inspection.finalUrl, source: "redirect", inspection });
	}
	for (const site of sites)
		if (site.body !== null)
			for (const url of discoverFeedLinks(site.body, site.check.finalUrl)) urls.set(url, "page");
	if (siteUrl) {
		const base = new URL(sites.find((site) => !site.check.error)?.check.finalUrl || siteUrl);
		base.search = "";
		if (/\.[a-z0-9]+$/i.test(base.pathname)) base.pathname = base.pathname.replace(/[^/]+$/, "");
		else base.pathname = `${base.pathname.replace(/\/$/, "")}/`;
		for (const path of ["feed/", "rss.xml", "atom.xml", "feed.xml"]) {
			const url = new URL(path, base).href;
			if (!urls.has(url)) urls.set(url, "probe");
		}
	}
	urls.delete(resolved);
	urls.delete(inspection.finalUrl);
	// ponytail: cap discovery at six addresses and two concurrent probes; expand only for a demonstrated publisher pattern.
	const selected = [...urls].slice(0, 6 - candidates.length);
	for (let offset = 0; offset < selected.length; offset += 2) {
		candidates.push(
			...(await Promise.all(
				selected.slice(offset, offset + 2).map(async ([url, source]) => ({
					url,
					source,
					inspection: await inspectFeed(env, url, deadline),
				})),
			)),
		);
	}
	return {
		checkedAt: new Date(started).toISOString(),
		durationMs: Date.now() - started,
		staleAfterDays: 90,
		feed: inspection,
		siteUrl,
		sites: sites.map((site) => site.check),
		candidates,
	};
}

export async function runDiagnostic(env: Env, job: DiagnosticJob): Promise<void> {
	const row = await env.DB.prepare(`UPDATE feed_diagnostics SET status = 'running'
    WHERE feed_id = ? AND run_id = ? AND status = 'queued' RETURNING *`)
		.bind(job.feedId, job.runId)
		.first<DiagnosticRow>();
	if (!row) return;
	try {
		const feed = await getFeed(env.DB, job.feedId);
		const report = await diagnoseFeed(env, feed, row.site_url ?? undefined);
		await env.DB.prepare(
			"UPDATE feed_diagnostics SET status = 'success', report = ?, finished_at = ? WHERE feed_id = ? AND run_id = ?",
		)
			.bind(JSON.stringify(report), new Date().toISOString(), job.feedId, job.runId)
			.run();
	} catch (error) {
		await env.DB.prepare(
			"UPDATE feed_diagnostics SET status = 'error', error = ?, finished_at = ? WHERE feed_id = ? AND run_id = ?",
		)
			.bind(errorMessage(error).slice(0, 500), new Date().toISOString(), job.feedId, job.runId)
			.run();
	}
}
