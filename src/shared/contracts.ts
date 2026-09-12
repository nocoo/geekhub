import type { AiSettingsReadonly } from "@nocoo/next-ai";

export interface User {
	id: string;
	email: string;
	name: string;
}
export interface Category {
	id: string;
	name: string;
	color: string;
	icon: string;
	sort_order: number;
}
export interface Feed {
	id: string;
	category_id: string | null;
	title: string;
	url: string;
	site_url: string;
	description: string;
	auto_translate: number;
	is_active: number;
	refresh_minutes: number;
	sort_order: number;
	status: "idle" | "queued" | "fetching" | "success" | "error";
	last_fetched_at: string | null;
	next_fetch_at: string | null;
	last_error: string | null;
	unread_count: number;
	total_count: number;
}
export interface Article {
	id: string;
	feed_id: string;
	feed_title: string;
	site_url: string;
	title: string;
	url: string;
	author: string;
	published_at: string;
	description: string;
	image_url: string | null;
	is_read: number;
	is_starred: number;
	is_later: number;
	auto_translate: number;
	translated_title: string | null;
	translated_description: string | null;
}
export interface ArticleDetail extends Article {
	content: string;
	summary: string | null;
	translated_content: string | null;
	ai_model: string | null;
	full_content_fetched: number;
}
export interface ArticlePage {
	articles: Article[];
	nextCursor: string | null;
}
export type ReaderView = "all" | "unread" | "starred" | "later";
export interface ReaderFilter {
	view: ReaderView;
	feedId?: string;
	categoryId?: string;
	search: string;
}
export interface Preferences {
	theme: "dark" | "light" | "system";
	fontSize: number;
	fontFamily: "serif" | "sans";
	showImages: boolean;
	rsshubUrl: string;
}
export const defaultPreferences: Preferences = {
	theme: "dark",
	fontSize: 18,
	fontFamily: "serif",
	showImages: true,
	rsshubUrl: "https://rsshub.app",
};
export interface Stats {
	feeds: number;
	articles: number;
	unread: number;
	starred: number;
	later: number;
	logs: number;
	bytes: number;
}
export interface FetchLog {
	id: number;
	feed_id: string | null;
	feed_title: string;
	level: "info" | "success" | "error";
	message: string;
	articles_added: number;
	duration_ms: number | null;
	created_at: string;
}
export interface DirectoryFeed {
	id: string;
	title: string;
	url: string;
	site_url: string;
	description: string;
	category: string;
	tags: string[];
	score: {
		overall?: number;
		contentQuality?: number;
		updateFrequency?: number;
		lastScoredAt?: string;
	};
	last_updated: string | null;
}
export interface Session {
	user: User & { avatarUrl: string | null };
	local: boolean;
}
export interface AiSettings extends AiSettingsReadonly {
	mock: boolean;
}
export type AiAction = "summary" | "translate" | "translate-title";
export interface FeedJob {
	feedId: string;
	token?: string;
}
export interface DiagnosticJob {
	kind: "diagnose";
	feedId: string;
	runId: string;
}
export type QueueJob = FeedJob | DiagnosticJob;

export interface ConnectionCheck {
	url: string;
	finalUrl: string;
	status: number | null;
	durationMs: number;
	hops: { url: string; status: number }[];
	error: string | null;
}
export interface FeedInspection extends ConnectionCheck {
	title: string | null;
	siteUrl: string | null;
	entries: number | null;
	readableEntries: number;
	oldestAt: string | null;
	latestAt: string | null;
	undatedEntries: number;
	futureEntries: number;
	ageDays: number | null;
}
export interface FeedCandidate {
	url: string;
	source: "page" | "redirect" | "probe";
	inspection: FeedInspection;
}
export interface DiagnosticReport {
	checkedAt: string;
	durationMs: number;
	staleAfterDays: number;
	feed: FeedInspection;
	siteUrl: string | null;
	sites: ConnectionCheck[];
	candidates: FeedCandidate[];
}
export interface FeedDiagnostic {
	feed_id: string;
	run_id: string;
	feed_url: string;
	status: "queued" | "running" | "success" | "error";
	requested_at: string;
	finished_at: string | null;
	error: string | null;
	report: DiagnosticReport | null;
}
