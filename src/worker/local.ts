// Fixtures are used only after a local-environment guard. Production never seeds demo data.
export const demoHost = "demo.geekhub.example";
export const demoSources = [
	{
		id: "cloudflare",
		title: "Cloudflare Blog",
		category: "engineering",
		description: "构建一个更好的互联网",
		site: "https://blog.cloudflare.com",
	},
	{
		id: "simon",
		title: "Simon Willison",
		category: "engineering",
		description: "AI、工具与独立开发的日常",
		site: "https://simonwillison.net",
	},
	{
		id: "design",
		title: "The Design of Things",
		category: "design",
		description: "好的设计，让注意力回到内容",
		site: "https://www.designbetter.co",
	},
	{
		id: "fieldnotes",
		title: "独立开发者的手记",
		category: "inspiration",
		description: "保持好奇，持续创造",
		site: "https://geekhub.hexly.ai",
	},
];
export const demoTitles = [
	[
		"The quiet craft of building for the web",
		"A small database at the edge of the world",
		"Rethinking the way we build the Internet",
		"Queues, retries, and the beauty of reliable systems",
		"Make the fast path the simple path",
		"A field guide to better observability",
	],
	[
		"Building small tools that bring back the joy",
		"What I learned from a week with local language models",
		"Good AI tools keep the human in the loop",
		"A little SQLite goes a very long way",
		"Notes on a more personal kind of software",
		"Making room for curiosity",
	],
	[
		"Less noise. More room to think.",
		"用留白，给阅读一点呼吸的空间",
		"The details are the design",
		"Interfaces that feel like a place",
		"Typography is how a page finds its voice",
		"A thoughtful use of color",
	],
	[
		"把信息流，变成自己的知识花园",
		"在周末，做一个只属于自己的小工具",
		"慢慢读，才读得到细节",
		"Keeping a notebook on the open web",
		"阅读是一场没有终点的漫步",
		"给下一次灵感留一扇窗",
	],
];

export function demoArticleContent(title: string): string {
	return `<p>Every good tool begins with a simple question: what deserves our attention?</p>
    <p>The web has always been a place for curious people. Somewhere between the feeds, the bookmarks, and the open tabs, there is an idea worth sitting with. This is a small invitation to slow down and follow that idea.</p>
    <h2>A little space for the important things</h2>
    <p>We built complicated systems to manage information, but the most useful tools often do less. A clear reading view. A place to save a thought. The freedom to choose what comes next.</p>
    <blockquote>The best interface is one that gives the reader room to think.</blockquote>
    <p>Instead of measuring everything by speed, we can ask whether our tools help us understand. A well-chosen default, an honest label, and a thoughtful detail make a real difference over time.</p>
    <h2>Small, dependable pieces</h2>
    <p>A database close to the reader stores each article. A queue takes care of the background work. The interface stays quiet while those pieces do their job.</p>
    <pre><code>const idea = await read();\nawait curiosity.follow(idea);</code></pre>
    <p>“${title}” is part of the GeekHub local reading collection. These demonstration articles live in the local SQLite database, ready for exploring the reader.</p>
    <p>保持好奇，也保留一点耐心。你正在寻找的那一段文字，也许就在下一篇文章里。</p>
    ${
			title === demoTitles[2]?.[0]
				? `<table role="presentation" style="width:1600px"><tr><td><h2>让内容决定顺序</h2><p>这一段原本放在邮件的布局表格中。阅读时，它应当成为一个普通段落，按内容顺序自然展开。</p><figure><img src="https://${demoHost}/reading.png" alt="阅读示例插图"><figcaption>保留图片，也保留图片说明。</figcaption></figure></td></tr></table>
    <h2>保留真正的数据表格</h2><table><caption>阅读方式对比</caption><thead><tr><th>内容</th><th>展示方式</th></tr></thead><tbody><tr><td>正文</td><td>自然段落与清楚的标题层级</td></tr><tr><td>图片</td><td>保持比例，适应可用宽度</td></tr><tr><td>代码</td><td><code>read | think | remember</code></td></tr></tbody></table>
    <p><a href="https://example.com/reading#notes">进一步阅读</a></p>`
				: ""
		}`;
}

export function localFeedXml(url: URL): string {
	const index = demoSources.findIndex((source) => url.pathname === `/rss/${source.id}`);
	const source = demoSources[index];
	if (!source) throw new Error("本地示例订阅源不存在");
	return `<rss version="2.0"><channel><title>${source.title}</title><link>${source.site}</link><description>${source.description}</description>${(demoTitles[index] ?? []).map((title, i) => `<item><guid>${source.id}-${i}</guid><title>${title}</title><link>https://${demoHost}/articles/${source.id}-${i}</link><pubDate>${new Date(Date.now() - (index * 25 + i * 240) * 60_000).toUTCString()}</pubDate><author>${source.title}</author><description><![CDATA[${demoArticleContent(title)}]]></description></item>`).join("")}</channel></rss>`;
}

export function localDiagnosticResponse(url: URL): Response {
	if (url.pathname.startsWith("/rss/")) {
		try {
			return new Response(localFeedXml(url), {
				headers: { "content-type": "application/rss+xml" },
			});
		} catch {
			return new Response("Missing feed", { status: 404 });
		}
	}
	const source = demoSources.find((source) => url.pathname === `/site/${source.id}`);
	if (source)
		return new Response(
			`<html><head><link rel="alternate" type="application/rss+xml" title="${source.title}" href="/rss/${source.id}?discovered=1"></head><body>${source.title}</body></html>`,
			{ headers: { "content-type": "text/html" } },
		);
	return new Response("Not found", { status: 404 });
}
