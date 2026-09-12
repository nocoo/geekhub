import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";
import { publicUrl } from "../../shared/validation";

const converter = new TurndownService({
	headingStyle: "atx",
	codeBlockStyle: "fenced",
	bulletListMarker: "-",
	emDelimiter: "*",
});
converter.use(gfm);
converter.addRule("caption", {
	filter: "figcaption",
	replacement: (content) => `\n\n*${content.trim()}*\n\n`,
});
converter.addRule("tableCell", {
	filter: ["th", "td"],
	replacement: (content, node) =>
		`${(node as HTMLTableCellElement).cellIndex === 0 ? "| " : " "}${content
			.trim()
			.replace(/\n+/g, " ")
			.replace(/(?<!\\)\|/g, "\\|")} |`,
});

export function readerUrl(value: string, base: string): string {
	if (!value.trim()) return "";
	try {
		const url = new URL(value, base);
		publicUrl(url.href);
		return url.href;
	} catch {
		return "";
	}
}

export function readerImageUrl(value: string, base: string): string {
	const url = readerUrl(value, base);
	return url ? `/api/images?${new URLSearchParams({ url })}` : "";
}

export function readerMarkdown(html: string, base: string, title: string): string {
	const document = new DOMParser().parseFromString(html, "text/html");
	for (const node of document.querySelectorAll(
		"script, style, iframe, object, embed, form, nav, footer, noscript, svg, [hidden], [aria-hidden='true']",
	))
		node.remove();
	for (const link of document.querySelectorAll("a")) {
		const href = readerUrl(link.getAttribute("href") ?? "", base);
		if (href) link.setAttribute("href", href);
		else link.removeAttribute("href");
	}
	for (const image of document.querySelectorAll("img")) {
		const src = readerUrl(image.getAttribute("src") ?? "", base);
		if (src) image.setAttribute("src", src);
		else image.replaceWith(document.createTextNode(image.alt));
	}
	const heading = document.querySelector("h1");
	if (heading?.textContent.trim() === title.trim()) heading.remove();
	for (const table of Array.from(document.querySelectorAll("table")).reverse()) {
		const caption = table.querySelector("caption");
		if (caption) {
			const label = document.createElement("p");
			label.replaceChildren(...caption.childNodes);
			table.parentNode?.insertBefore(label, table);
			caption.remove();
		}
		const rows = Array.from(table.rows);
		const columns = rows[0]?.cells.length ?? 0;
		if (!columns) {
			table.remove();
			continue;
		}
		const layout =
			table.getAttribute("role") === "presentation" ||
			rows.some((row) => row.cells.length !== columns) ||
			Boolean(
				table.querySelector("table, [colspan]:not([colspan='1']), [rowspan]:not([rowspan='1'])"),
			) ||
			(!table.querySelector("th") &&
				(columns < 2 ||
					rows.length < 2 ||
					Boolean(table.querySelector("p, div, h1, h2, h3, img"))));
		if (layout) {
			for (const cell of table.querySelectorAll("thead, tbody, tfoot, tr, td, th")) {
				const block = document.createElement("div");
				block.replaceChildren(...cell.childNodes);
				cell.replaceWith(block);
			}
			table.replaceWith(...table.childNodes);
			continue;
		}
		// GFM needs a header. An empty header preserves every row of headerless data tables.
		if (!rows[0]?.querySelector("th")) {
			const header = table.createTHead().insertRow(0);
			for (let index = 0; index < columns; index++)
				header.appendChild(document.createElement("th"));
		}
		// The GFM converter expects table sections and rows to contain elements, not indentation.
		for (const row of table.querySelectorAll("thead, tbody, tfoot, tr"))
			for (const node of Array.from(row.childNodes))
				if (node.nodeType !== Node.ELEMENT_NODE) node.remove();
	}
	if (!document.body.children.length) return document.body.textContent.trim();
	return converter.turndown(document.body);
}
