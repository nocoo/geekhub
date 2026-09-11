import type { Article, ArticleDetail, ReaderFilter } from "../../shared/contracts";
import { api } from "./api";

export const viewLabels = {
	all: "全部文章",
	unread: "未读文章",
	starred: "我的收藏",
	later: "稍后阅读",
};

export function articleQuery(filter: ReaderFilter, cursor?: string): string {
	const params = new URLSearchParams({ view: filter.view, search: filter.search });
	if (filter.feedId) params.set("feedId", filter.feedId);
	if (filter.categoryId) params.set("categoryId", filter.categoryId);
	if (cursor) params.set("cursor", cursor);
	return `/articles?${params}`;
}

export function dateLabel(date: string, now = Date.now()): string {
	const value = new Date(date);
	const minutes = Math.floor((now - value.getTime()) / 60000);
	if (Number.isNaN(value.getTime())) return "";
	if (minutes < 1) return "刚刚";
	if (minutes < 60) return `${minutes} 分钟前`;
	if (minutes < 1440) return `${Math.floor(minutes / 60)} 小时前`;
	if (minutes < 10080) return `${Math.floor(minutes / 1440)} 天前`;
	return value.toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
}

export function titleOf(article: Pick<Article, "title" | "translated_title">): string {
	return article.translated_title || article.title;
}
export function sizeLabel(bytes: number): string {
	return bytes < 1048576 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1048576).toFixed(1)} MB`;
}

export function readerNodes(html: string, showImages: boolean): DocumentFragment {
	const document = new DOMParser().parseFromString(html, "text/html");
	// The Worker sanitized this HTML. Rewrite image requests through the authenticated proxy.
	for (const image of document.querySelectorAll("img")) {
		if (!showImages) image.remove();
		else {
			image.src = `/api/images?${new URLSearchParams({ url: image.getAttribute("src") ?? "" })}`;
			image.referrerPolicy = "no-referrer";
		}
	}
	const fragment = document.createDocumentFragment();
	fragment.append(...document.body.childNodes);
	return fragment;
}

export async function translateTitles(
	articles: Article[],
	attempted: Set<string>,
	isActive: () => boolean,
	onTranslated: (article: ArticleDetail) => Promise<void>,
): Promise<void> {
	for (const article of articles) {
		if (!isActive()) return;
		if (!article.auto_translate || article.translated_title || attempted.has(article.id)) continue;
		attempted.add(article.id);
		try {
			const result = await api<ArticleDetail>(`/articles/${article.id}/ai`, {
				method: "POST",
				body: { action: "translate-title" },
			});
			await onTranslated(result);
		} catch {
			// A failed paid request is not automatically retried. The reader offers explicit retry.
		}
	}
}
