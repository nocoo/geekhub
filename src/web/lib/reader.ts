import type { InfiniteData } from "@tanstack/react-query";
import type {
	Article,
	ArticleDetail,
	ArticlePage,
	Feed,
	FetchLog,
	ReaderFilter,
} from "../../shared/contracts";
import { api } from "./api";

export const viewLabels = {
	all: "全部文章",
	unread: "未读文章",
	starred: "我的收藏",
	later: "稍后阅读",
};

export function runningActivities(logs: FetchLog[], now = Date.now()) {
	const seen = new Set<string>();
	return logs.filter((log) => {
		if (!log.activity_id || seen.has(log.activity_id)) return false;
		seen.add(log.activity_id);
		return log.level === "info" && now - Date.parse(log.created_at) < 120_000;
	});
}

export function emptyReaderState(filter: ReaderFilter, feeds: Feed[]) {
	if (filter.search)
		return {
			title: "还没有找到这篇文章",
			description: "试试其他关键词，或清除搜索。",
			action: "search",
		};
	if (!feeds.length)
		return filter.feedId
			? { title: "订阅已不存在", description: "返回全部文章，继续阅读其他订阅。", action: "home" }
			: {
					title: filter.categoryId ? "这个分类还没有订阅" : "给好内容留一个位置",
					description: "添加一个订阅源，开始今天的阅读。",
					action: "add",
				};
	if (filter.view !== "all" && feeds.some((feed) => feed.total_count > 0))
		return {
			title: { unread: "未读文章已读完", starred: "还没有收藏文章", later: "还没有稍后阅读的文章" }[
				filter.view
			],
			description: "可以查看当前范围内的全部文章。",
			action: "all",
		};
	if (feeds.some((feed) => feed.status === "queued" || feed.status === "fetching"))
		return { title: "正在同步订阅", description: "文章会自动出现在这里。", action: "syncing" };
	const failed = feeds.find((feed) => feed.status === "error");
	if (failed)
		return {
			title: "订阅更新失败",
			description: failed.last_error || "暂时无法获取文章，请重试或检查订阅源。",
			action: "refresh",
		};
	return {
		title: "订阅暂无文章",
		description: "刷新订阅获取最新内容，也可以检查订阅源。",
		action: "refresh",
	};
}

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

export function patchArticles(
	data: InfiniteData<ArticlePage> | undefined,
	matches: (article: Article) => boolean,
	patch: Partial<Article>,
): InfiniteData<ArticlePage> | undefined {
	return (
		data && {
			...data,
			pages: data.pages.map((page) => ({
				...page,
				articles: page.articles.map((article) =>
					matches(article) ? { ...article, ...patch } : article,
				),
			})),
		}
	);
}

export function feedRevision(feeds: Feed[], filter: ReaderFilter): string {
	return feeds
		.filter(
			(feed) =>
				(!filter.feedId || feed.id === filter.feedId) &&
				(!filter.categoryId || feed.category_id === filter.categoryId),
		)
		.map((feed) => `${feed.id}:${feed.url}:${feed.total_count}`)
		.sort()
		.join("|");
}

export type ReaderShortcut =
	| "next"
	| "previous"
	| "search"
	| "back"
	| "read"
	| "star"
	| "later"
	| "original"
	| "refresh";
export function readerShortcut(event: KeyboardEvent, blocked: boolean): ReaderShortcut | null {
	if (
		blocked ||
		event.defaultPrevented ||
		event.isComposing ||
		event.ctrlKey ||
		event.metaKey ||
		event.altKey
	)
		return null;
	const target = event.target instanceof Element ? event.target : null;
	if (
		target?.closest(
			"input, textarea, select, [contenteditable]:not([contenteditable='false']), [role='textbox'], [role='combobox'], [role='dialog'], [role='alertdialog'], [role='menu']",
		)
	)
		return null;
	if (event.key.startsWith("Arrow") && target?.closest(".reader-scroll, .reader-sidebar"))
		return null;
	const shortcuts: Record<string, ReaderShortcut> = {
		j: "next",
		ArrowDown: "next",
		k: "previous",
		ArrowUp: "previous",
		"/": "search",
		Escape: "back",
		m: "read",
		s: "star",
		l: "later",
		o: "original",
		r: "refresh",
	};
	const shortcut = shortcuts[event.key.length === 1 ? event.key.toLowerCase() : event.key] ?? null;
	if (event.repeat && shortcut !== "next" && shortcut !== "previous") return null;
	return shortcut;
}

export function adjacentArticle(
	articles: Article[],
	selected: string | null,
	direction: 1 | -1,
): Article | undefined {
	const index = articles.findIndex((article) => article.id === selected);
	return articles[index < 0 ? (direction === 1 ? 0 : articles.length - 1) : index + direction];
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
				body: { action: "translate-title", automatic: true },
			});
			await onTranslated(result);
		} catch {
			// A failed paid request is not automatically retried. The reader offers explicit retry.
		}
	}
}
