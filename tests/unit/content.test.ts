import { describe, expect, test } from "vitest";
import {
	cleanHtml,
	extractArticle,
	parseFeed,
	plainText,
	safeLink,
} from "../../src/worker/lib/content";
import { demoSources, localFeedXml } from "../../src/worker/local";
import { rss } from "./support";

describe("RSS and Atom parsing", () => {
	test("normalizes RSS, strips script content, resolves images and preserves source IDs", () => {
		const parsed = parseFeed(
			`<rss><channel><title>Sample</title><link>https://example.com/blog/</link><description>Welcome</description><item><guid isPermaLink="false">one</guid><title>Title &amp; more</title><link>/one</link><dc:creator>Author</dc:creator><pubDate>2026-01-01</pubDate><content:encoded><![CDATA[<h2>Safe</h2><script>alert(1)</script><img src="/pic.jpg" onerror="alert(1)"><a href="javascript:alert(1)">bad</a>]]></content:encoded></item></channel></rss>`,
			"https://example.com/feed",
		);
		expect(parsed.title).toBe("Sample");
		expect(parsed.siteUrl).toBe("https://example.com/blog/");
		expect(parsed.articles[0]).toMatchObject({
			sourceId: "one",
			title: "Title & more",
			author: "Author",
			url: "https://example.com/one",
			imageUrl: "https://example.com/pic.jpg",
			publishedAt: "2026-01-01T00:00:00.000Z",
		});
		expect(parsed.articles[0]?.content).not.toMatch(/script|onerror|javascript/);
		expect(parseFeed(rss(210), "https://example.com/rss").articles).toHaveLength(200);
	});
	test("supports Atom alternate links, object author/content and missing dates", () => {
		const parsed = parseFeed(
			`<feed><title>Atom</title><subtitle>Notes</subtitle><link rel="self" href="https://example.com/feed"/><link rel="alternate" href="https://example.com/blog/"/><entry><id>entry-id</id><title>Entry</title><link rel="self" href="/self"/><link href="/entry"/><author><name>Ada</name></author><updated>invalid</updated><content type="html">&lt;p&gt;Body&lt;/p&gt;</content><summary>Summary</summary></entry></feed>`,
			"https://example.com/feed",
			"2026-02-01T00:00:00.000Z",
		);
		expect(parsed.articles[0]).toMatchObject({
			sourceId: "entry-id",
			author: "Ada",
			content: "<p>Body</p>",
			description: "Summary",
			publishedAt: "2026-02-01T00:00:00.000Z",
		});
		expect(parsed.siteUrl).toBe("https://example.com/blog/");
	});
	test("handles empty feeds, fallback titles, author text, numeric IDs and invalid entries", () => {
		expect(
			parseFeed("<rss><channel><title>Empty</title></channel></rss>", "https://example.com/rss")
				.articles,
		).toEqual([]);
		const parsed = parseFeed(
			`<feed><link rel="self" href="/self"/><entry><id>42</id><title>123</title><link href="/valid"/><author>Writer</author><published>2026-01-01</published><summary>Text</summary></entry><entry><title>Missing link</title></entry><entry><link href="/no-title"/></entry><entry><title>Unsafe</title><link href="http://127.0.0.1/"/></entry></feed>`,
			"https://example.com/feed",
		);
		expect(parsed.title).toBe("example.com");
		expect(parsed.siteUrl).toBe("https://example.com");
		expect(parsed.articles).toHaveLength(1);
		expect(parsed.articles[0]?.sourceId).toBe("42");
		expect(
			parseFeed(
				'<feed><entry><title>x</title><link href="/a"/><dc:date>2026-01-02</dc:date></entry></feed>',
				"https://example.com/feed",
			).articles[0]?.sourceId,
		).toBe("https://example.com/a");
		expect(
			parseFeed(
				'<feed><entry><title type="html">42</title><link href="/a"/><description><bad/></description></entry></feed>',
				"https://example.com/feed",
			).articles,
		).toEqual([]);
	});
	test.each([
		"not xml",
		"<rss><channel></rss>",
		'<!DOCTYPE rss [<!ENTITY x SYSTEM "file:///etc/passwd">]><rss/>',
		"<something/>",
	])("rejects invalid or entity-bearing feed %s", (xml) => {
		expect(() => parseFeed(xml, "https://example.com")).toThrow();
	});
	test("local source fixtures are parseable and unknown fixture routes fail", () => {
		for (const source of demoSources)
			expect(
				parseFeed(
					localFeedXml(new URL(`https://demo.geekhub.example/rss/${source.id}`)),
					"https://demo.geekhub.example/rss",
				).articles,
			).toHaveLength(6);
		expect(() => localFeedXml(new URL("https://demo.geekhub.example/rss/missing"))).toThrow();
	});
});

describe("untrusted article HTML", () => {
	test("sanitizes active content and unsafe links/images", () => {
		const html = cleanHtml(
			'<div style="color:red" onclick="bad()"><iframe src="https://example.com"></iframe><img src="javascript:alert(1)"><img><a href="/safe" title="safe">link</a><a>missing</a><img src="/ok.png" alt="OK"><svg onload="bad()"></svg><form><input></form><p>Text</p></div>',
			"https://example.com/post",
		);
		expect(html).not.toMatch(/style=|onclick|iframe|javascript|svg|onload|<form|<input/);
		expect(html).toContain('rel="noopener noreferrer"');
		expect(html).toContain('src="https://example.com/ok.png"');
		expect(safeLink("", "https://example.com")).toBe("");
		expect(safeLink("http://localhost", "https://example.com")).toBe("");
		expect(plainText("<p> A\n B </p><p> C </p>")).toBe("A B C");
	});
	test("extracts main text using metadata or title fallbacks", () => {
		const body = "A long article about careful reading and clear interfaces. ".repeat(4);
		const result = extractArticle(
			`<head><meta property="og:title" content=" Metadata "></head><nav>navigation</nav><article><h1>Heading</h1><p>${body}</p></article><footer>Footer</footer>`,
			"https://example.com",
		);
		expect(result.title).toBe("Metadata");
		expect(result.content).not.toContain("navigation");
		expect(
			extractArticle(`<h1>Heading</h1><main>${body}</main>`, "https://example.com").title,
		).toBe("Heading");
		expect(
			extractArticle(
				`<html><head><title>Fallback</title></head><body>${body}</body></html>`,
				"https://example.com",
			).title,
		).toBe("Fallback");
		expect(extractArticle(`<div>${body}</div>`, "https://example.com").content).toContain("A long");
		expect(() => extractArticle("<p>short</p>", "https://example.com")).toThrow("正文");
	});
});
