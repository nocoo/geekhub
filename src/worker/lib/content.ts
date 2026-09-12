import { load } from "cheerio/slim";
import { XMLParser, XMLValidator } from "fast-xml-parser";
import sanitizeHtml from "sanitize-html";
import { publicUrl } from "../../shared/validation";

export function safeLink(value: string, base: string): string {
	if (!value.trim()) return "";
	try {
		const url = new URL(value, base);
		publicUrl(url.href);
		return url.href;
	} catch {
		return "";
	}
}

export function cleanHtml(html: string, base: string): string {
	return sanitizeHtml(html, {
		allowedTags: [
			...sanitizeHtml.defaults.allowedTags,
			"img",
			"figure",
			"figcaption",
			"picture",
			"source",
			"h1",
			"h2",
		],
		allowedAttributes: {
			a: ["href", "title", "target", "rel"],
			img: ["src", "alt", "title", "loading"],
			source: ["src", "type"],
			code: ["class"],
			th: ["colspan", "rowspan"],
			td: ["colspan", "rowspan"],
		},
		allowedSchemes: ["http", "https"],
		transformTags: {
			a: (_name, attrs) => ({
				tagName: "a",
				attribs: {
					href: safeLink(attrs.href ?? "", base),
					title: attrs.title ?? "",
					target: "_blank",
					rel: "noopener noreferrer",
				},
			}),
			img: (_name, attrs) => ({
				tagName: "img",
				attribs: {
					src:
						safeLink(attrs["data-src"] ?? "", base) ||
						safeLink(attrs["data-original"] ?? "", base) ||
						safeLink(attrs.src ?? "", base),
					alt: attrs.alt ?? "",
					title: attrs.title ?? "",
					loading: "lazy",
				},
			}),
		},
		exclusiveFilter: (frame) => frame.tag === "img" && !frame.attribs.src,
	});
}
export function plainText(html: string): string {
	return load(html).text().replace(/\s+/g, " ").trim();
}

export function extractArticle(html: string, url: string): { title: string; content: string } {
	const $ = load(html);
	const title =
		$("meta[property='og:title']").attr("content") || $("h1").first().text() || $("title").text();
	$(
		"script, style, nav, aside, footer, header, form, .comments, .sidebar, .advertisement",
	).remove();
	const selectors = [
		"#js_content",
		"article",
		"[role=article]",
		".post-content",
		".entry-content",
		".article-content",
		"main",
	];
	const selected = selectors
		.map((selector) => $(selector).first())
		.find((element) => element.text().trim().length >= 100);
	const content = cleanHtml(selected?.html() || $("body").html() || $.html(), url);
	if (plainText(content).length < 40) throw new Error("网页中没有可提取的正文");
	return { title: title.trim(), content };
}

function record(value: unknown): Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: {};
}
function list(value: unknown): unknown[] {
	return value === undefined ? [] : Array.isArray(value) ? value : [value];
}
function text(value: unknown): string {
	return typeof value === "string" || typeof value === "number"
		? String(value)
		: typeof record(value)["#text"] === "string"
			? String(record(value)["#text"])
			: "";
}
function atomLink(value: unknown): string {
	for (const link of list(value)) {
		const item = record(link);
		if (!item["@_rel"] || item["@_rel"] === "alternate") return text(item["@_href"]) || text(link);
	}
	return "";
}
export interface ParsedArticle {
	sourceId: string;
	title: string;
	url: string;
	author: string;
	publishedAt: string;
	content: string;
	description: string;
	imageUrl: string | null;
}
export interface ParsedFeed {
	title: string;
	siteUrl: string;
	declaredSiteUrl: string | null;
	description: string;
	articles: ParsedArticle[];
	entries: number;
	oldestAt: string | null;
	latestAt: string | null;
	undatedEntries: number;
	futureEntries: number;
}

function itemDate(item: Record<string, unknown>): Date {
	return new Date(text(item.pubDate ?? item.published ?? item.updated ?? item["dc:date"]));
}

export function parseFeed(xml: string, url: string, now = new Date().toISOString()): ParsedFeed {
	if (/<!DOCTYPE|<!ENTITY/i.test(xml) || XMLValidator.validate(xml) !== true)
		throw new Error("订阅源不是有效的 RSS / Atom XML");
	const parsed = record(
		new XMLParser({ ignoreAttributes: false, processEntities: true, trimValues: true }).parse(xml),
	);
	const channel = record(record(parsed.rss).channel);
	const atom = record(parsed.feed);
	const feed = Object.keys(channel).length ? channel : atom;
	if (!Object.keys(feed).length) throw new Error("没有找到 RSS 或 Atom 订阅内容");
	const declaredSiteUrl = safeLink(atomLink(feed.link), url) || null;
	const siteUrl = declaredSiteUrl || new URL(url).origin;
	const items = list(feed.item ?? feed.entry);
	const dates: string[] = [];
	let undatedEntries = 0;
	let futureEntries = 0;
	for (const value of items) {
		const date = itemDate(record(value));
		if (Number.isNaN(date.getTime())) undatedEntries++;
		else if (date.getTime() > Date.parse(now)) futureEntries++;
		else dates.push(date.toISOString());
	}
	dates.sort();
	const articles = items.slice(0, 200).flatMap((value) => {
		const item = record(value);
		const link = safeLink(atomLink(item.link), siteUrl);
		const title = plainText(text(item.title));
		if (!link || !title) return [];
		const content = cleanHtml(
			text(item["content:encoded"] ?? item.content ?? item.description ?? item.summary),
			link,
		);
		const date = itemDate(item);
		const $ = load(content);
		return [
			{
				sourceId: text(item.guid ?? item.id) || link,
				title,
				url: link,
				author: text(item["dc:creator"]) || text(record(item.author).name) || text(item.author),
				publishedAt: Number.isNaN(date.getTime()) ? now : date.toISOString(),
				content,
				description: plainText(text(item.description ?? item.summary) || content).slice(0, 600),
				imageUrl: $("img").first().attr("src") || null,
			},
		];
	});
	return {
		title: plainText(text(feed.title)) || new URL(url).hostname,
		siteUrl,
		declaredSiteUrl,
		description: plainText(text(feed.description ?? feed.subtitle)).slice(0, 1000),
		articles,
		entries: items.length,
		oldestAt: dates[0] ?? null,
		latestAt: dates.at(-1) ?? null,
		undatedEntries,
		futureEntries,
	};
}
