// @vitest-environment jsdom
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { readerImageUrl, readerMarkdown, readerUrl } from "../../src/web/lib/reader-markdown";
import ReaderContent from "../../src/web/ReaderContent";

afterEach(cleanup);

const base = "https://example.com/blog/article";

test("HTML becomes semantic Markdown with headings, lists, code, captions, images and links", () => {
	const html = `<div style="display:grid" class="original-layout">
    <h1>Article title</h1><h2>A section</h2><p>A <strong>clear</strong> paragraph with <em>emphasis</em> and <s>old words</s>.</p>
    <ul><li>First<ul><li>Nested</li></ul></li><li>Second</li></ul>
    <blockquote>Make room for reading.</blockquote>
    <pre><code class="language-js">const html = "&lt;div&gt;";\nconst fence = "&#96;&#96;&#96;";</code></pre>
    <figure><img src="/images/chart_(1).png" alt="A useful chart"><figcaption>Figure one</figcaption></figure>
    <p><a href="../reference#section">Reference</a></p><hr></div>`;
	const markdown = readerMarkdown(html, base, "Article title");
	expect(markdown).toContain("## A section");
	expect(markdown).not.toContain("Article title");
	expect(markdown).toContain("**clear**");
	expect(markdown).toContain("*emphasis*");
	expect(markdown).toContain('const html = "<div>";');
	expect(markdown).toContain("*Figure one*");
	expect(markdown).not.toMatch(/original-layout|style=|<figure|<div style/);
	const view = render(<ReaderContent content={html} url={base} title="Article title" showImages />);
	expect(view.getByRole("heading", { name: "A section" }).tagName).toBe("H2");
	expect(view.container.querySelectorAll("ul")).toHaveLength(2);
	expect(view.container.querySelector("pre code")?.textContent).toContain('const html = "<div>";');
	expect(view.getByRole("img", { name: "A useful chart" }).getAttribute("src")).toBe(
		"/api/images?url=https%3A%2F%2Fexample.com%2Fimages%2Fchart_%281%29.png",
	);
	expect(view.getByRole("link", { name: "Reference" }).getAttribute("href")).toBe(
		"https://example.com/reference#section",
	);
	expect(view.getByRole("link", { name: "Reference" }).getAttribute("rel")).toBe(
		"noopener noreferrer",
	);
});

test("data tables retain headers, all rows, empty cells and literal pipes", () => {
	const html = `<table><caption>Measurements</caption><thead>\n<tr>\n<th>Tool</th>\n<th>Result</th>\n</tr></thead><tbody>\n<tr><td><code>a|b</code></td><td><p>First</p><p>Second</p></td></tr><tr><td>Empty</td><td></td></tr></tbody></table>
    <table><tr><td>North</td><td>20</td></tr><tr><td>South</td><td>30</td></tr></table>`;
	const markdown = readerMarkdown(html, base, "");
	expect(markdown).not.toContain("<table");
	const view = render(<ReaderContent content={html} url={base} title="" showImages />);
	expect(view.getAllByRole("table")).toHaveLength(2);
	expect(view.getAllByRole("row")).toHaveLength(6);
	expect(view.getByRole("cell", { name: "a|b" }).textContent).toBe("a|b");
	expect(view.getByRole("cell", { name: "First Second" })).toBeTruthy();
	expect(view.getByRole("cell", { name: "North" })).toBeTruthy();
	expect(view.getByRole("cell", { name: "South" })).toBeTruthy();
	expect(view.getByText("Measurements")).toBeTruthy();
});

test("newsletter layouts, nested tables and merged cells become readable blocks without losing content", () => {
	const html = `<table role="presentation"><tr><td><h2>Newsletter</h2><p>Opening paragraph</p>
    <table><tr><td><img src="/photo.jpg" alt="Photo"></td></tr></table></td></tr></table>
    <table><tr><th colspan="2">Merged heading</th></tr><tr><td>Left</td><td>Right</td></tr></table>
    <table><tr><td>Single cell</td></tr></table><table><caption>Empty table caption</caption></table>
    <table><tr><td><div>Column layout</div></td><td>Alongside</td></tr><tr><td>More</td><td>Last</td></tr></table>
    <table><tr><th>One</th><th>Two</th></tr><tr><td>A</td><td>B</td><td>Extra cell preserved</td></tr></table>`;
	const markdown = readerMarkdown(html, base, "Unrelated title");
	expect(markdown).not.toMatch(/<table|\|/);
	const view = render(
		<ReaderContent content={html} url={base} title="Unrelated title" showImages />,
	);
	expect(view.queryAllByRole("table")).toHaveLength(0);
	for (const text of [
		"Newsletter",
		"Opening paragraph",
		"Merged heading",
		"Left",
		"Right",
		"Single cell",
		"Empty table caption",
		"Column layout",
		"Last",
		"Extra cell preserved",
	])
		expect(view.getByText(text)).toBeTruthy();
	expect(view.getByRole("img", { name: "Photo" })).toBeTruthy();
});

test("active and hidden HTML and unsafe destinations never reach the rendered document", () => {
	const html = `<nav>Navigation</nav><footer>Footer</footer><script>alert(1)</script><style>secret</style>
    <iframe src="https://example.com/frame">Embedded</iframe><p hidden>Hidden words</p><p aria-hidden="true">Invisible</p>
    <p onclick="bad()" style="position:fixed">Readable <a href="javascript:alert(1)">unsafe link</a> <a>no link</a></p>
    <img src="http://127.0.0.1/private" alt="Unavailable image"><img><img src="data:image/svg+xml,bad" alt="Data image">`;
	const markdown = readerMarkdown(html, base, "");
	expect(markdown).not.toMatch(
		/Navigation|Footer|alert|secret|Embedded|Hidden|Invisible|onclick|position/,
	);
	const view = render(<ReaderContent content={html} url={base} title="" showImages />);
	expect(view.container.querySelector("script, style, iframe, [onclick], [style]")).toBeNull();
	expect(view.queryAllByRole("link")).toHaveLength(0);
	expect(view.queryAllByRole("img")).toHaveLength(0);
	expect(view.container.textContent).toContain("Unavailable image");
	for (const url of [
		"",
		"javascript:alert(1)",
		"data:image/png,bad",
		"http://localhost/",
		"https://user:password@example.com/",
		"http://[::1]/",
	])
		expect(readerImageUrl(url, base)).toBe("");
	expect(readerUrl("#section", base)).toBe(`${base}#section`);
});

test("plain Markdown stays readable while embedded raw HTML is not executed", () => {
	const content =
		"## Already Markdown\n\n- [x] Read it\n- [ ] Save it\n\n![unsafe](javascript:bad)\n\n[invalid](http://127.0.0.1/)";
	const view = render(<ReaderContent content={content} url={base} title="" showImages />);
	expect(view.getByRole("heading", { name: "Already Markdown" })).toBeTruthy();
	expect(view.getAllByRole("checkbox")).toHaveLength(2);
	expect(view.queryAllByRole("img")).toHaveLength(0);
	expect(view.queryAllByRole("link")).toHaveLength(0);
	expect(readerMarkdown("  Just text &amp; words  ", base, "")).toBe("Just text & words");
	expect(readerMarkdown("", base, "")).toBe("");
});

test("image preferences and failure fallbacks preserve the paragraph DOM and text selection", () => {
	const content =
		'<p>Keep this reading position.</p><img src="/image.png" alt="Diagram"><img src="/other.png">';
	const props = { content, url: base, title: "", showImages: true };
	const view = render(<ReaderContent {...props} />);
	const paragraph = view.getByText("Keep this reading position.");
	const range = document.createRange();
	range.selectNodeContents(paragraph);
	window.getSelection()?.removeAllRanges();
	window.getSelection()?.addRange(range);
	const image = view.getByRole("img", { name: "Diagram" });
	expect(image.getAttribute("referrerpolicy")).toBe("no-referrer");
	expect(image.getAttribute("loading")).toBe("lazy");
	view.rerender(<ReaderContent {...props} />);
	expect(view.getByText("Keep this reading position.")).toBe(paragraph);
	expect(window.getSelection()?.toString()).toBe("Keep this reading position.");
	fireEvent.error(image);
	expect(view.getByRole("img", { name: "Diagram" }).tagName).toBe("SPAN");
	const unlabelled = view.container.querySelector("img");
	if (!unlabelled) throw new Error("Expected an unlabelled image");
	fireEvent.error(unlabelled);
	expect(view.getByRole("img", { name: "图片暂不可用" })).toBeTruthy();
	view.rerender(<ReaderContent {...props} showImages={false} />);
	expect(view.queryAllByRole("img")).toHaveLength(0);
	expect(view.getByText("Keep this reading position.")).toBe(paragraph);
});
