import { Badge, Button } from "@nocoo/basalt";
import {
	ArrowLeft,
	ArrowUpRight,
	Bookmark,
	BookOpen,
	CalendarDays,
	Check,
	ChevronRight,
	CircleAlert,
	Compass,
	Flower2,
	Languages,
	LoaderCircle,
	Maximize2,
	RotateCw,
	Rss,
	Settings2,
	Sparkles,
	Star,
	UserRound,
} from "lucide-react";
import { lazy, Suspense, useRef, useState } from "react";
import type { AiAction, AiSettings, ArticleDetail, Preferences } from "../shared/contracts";
import { useReadingPosition } from "./lib/reader-position";

const ReaderContent = lazy(() => import("./ReaderContent"));

interface Props {
	article?: ArticleDetail;
	loading: boolean;
	error?: string;
	selected: boolean;
	navigationKey: string;
	preferences: Preferences;
	translation: boolean;
	onTranslation: (value: boolean) => void;
	onBack: () => void;
	onDiscover: () => void;
	onStatus: (value: Record<string, boolean>) => void;
	onAction: (action: AiAction | "full", force?: boolean) => void;
	onAiSettings: () => void;
	ai?: AiSettings;
	actionError?: { kind: AiAction | "full"; message?: string };
	statusBusy: boolean;
	actionBusy: AiAction | "full" | null;
}

export function Reader({
	article,
	loading,
	error,
	selected,
	navigationKey,
	preferences,
	translation,
	onTranslation,
	onBack,
	onDiscover,
	onStatus,
	onAction,
	onAiSettings,
	ai,
	actionError,
	statusBusy,
	actionBusy,
}: Props) {
	const scroll = useRef<HTMLDivElement>(null);
	const [showSummary, setShowSummary] = useState(true);
	const [showTitleTranslation, setShowTitleTranslation] = useState(true);
	const canGenerate = Boolean(ai?.hasApiKey || ai?.mock);
	const run = (kind: AiAction | "full", force = false) => {
		if (kind === "summary") setShowSummary(true);
		if (kind === "translate-title") setShowTitleTranslation(true);
		onAction(kind, force);
	};
	const content =
		translation && article?.translated_content ? article.translated_content : article?.content;
	useReadingPosition(
		scroll,
		`article:${navigationKey}`,
		Boolean(selected && article && !loading),
		content ? ".prose" : undefined,
	);
	if (!selected)
		return (
			<section className="reader empty-reader" aria-label="阅读器">
				<div className="reading-mark">
					<img src="/logo-256.png" width="112" height="112" alt="" />
					<span className="orbital-dot" />
					<span className="crosshair top">+</span>
					<span className="crosshair bottom">+</span>
				</div>
				<span className="eyebrow">A QUIETER CORNER OF THE INTERNET</span>
				<h2>读一点，想远一点。</h2>
				<p>
					从左侧挑一篇文章，
					<br />
					把时间留给真正值得的内容。
				</p>
				<Button variant="outline" size="sm" onClick={onDiscover}>
					<Compass size={15} className="icon-discover" aria-hidden="true" />
					发现好内容
					<ChevronRight size={14} />
				</Button>
				<div className="reader-keystrokes">
					<span>
						<kbd>J</kbd> / <kbd>K</kbd> 切换文章
					</span>
					<span>
						<kbd>/</kbd> 搜索文章
					</span>
					<span>
						<kbd>Esc</kbd> 返回列表
					</span>
				</div>
				<span className="reader-signature">CURATED BY YOU. READ AT YOUR PACE.</span>
			</section>
		);
	if (loading || !article)
		return (
			<section className="reader" aria-label="阅读器">
				<div className="reader-toolbar">
					<Button variant="ghost" size="sm" onClick={onBack}>
						<ArrowLeft size={16} />
						返回
					</Button>
				</div>
				<div className="empty-state" role={error ? "alert" : "status"}>
					{error || (
						<>
							<LoaderCircle className="spinning" size={22} />
							正在打开文章…
						</>
					)}
				</div>
			</section>
		);
	return (
		<section className="reader" aria-label="阅读器">
			<div className="reader-toolbar">
				<div>
					<Button variant="ghost" size="icon" aria-label="返回文章列表" onClick={onBack}>
						<ArrowLeft size={17} />
					</Button>
					<span className="reader-source-label">{article.feed_title}</span>
				</div>
				<div>
					<Button
						variant="ghost"
						size="icon"
						aria-label={article.is_starred ? "取消收藏" : "收藏文章"}
						aria-pressed={Boolean(article.is_starred)}
						disabled={statusBusy}
						onClick={() => onStatus({ is_starred: !article.is_starred })}
					>
						<Star size={17} className={article.is_starred ? "starred" : "icon-save"} />
					</Button>
					<Button
						variant="ghost"
						size="icon"
						aria-label={article.is_later ? "移出稍后阅读" : "稍后阅读"}
						aria-pressed={Boolean(article.is_later)}
						disabled={statusBusy}
						onClick={() => onStatus({ is_later: !article.is_later })}
					>
						<Bookmark size={17} className={article.is_later ? "bookmarked" : "icon-later"} />
					</Button>
					<Button
						variant="ghost"
						size="icon"
						aria-label={article.is_read ? "标为未读" : "标为已读"}
						disabled={statusBusy}
						onClick={() => onStatus({ is_read: !article.is_read })}
					>
						{article.is_read ? (
							<Check size={17} className="icon-reading" />
						) : (
							<BookOpen size={17} className="icon-reading" />
						)}
					</Button>
					<span className="toolbar-divider" />
					<Button variant="ghost" size="icon" asChild>
						<a href={article.url} target="_blank" rel="noopener noreferrer" aria-label="打开原文">
							<ArrowUpRight size={18} />
						</a>
					</Button>
				</div>
			</div>
			<div
				className="reader-scroll"
				ref={scroll}
				key={article.id}
				tabIndex={-1}
				role="document"
				aria-label="文章正文"
			>
				<article
					className={`reader-document font-${preferences.fontFamily}`}
					style={{ "--reader-font-size": `${preferences.fontSize}px` } as React.CSSProperties}
				>
					<header className="article-context">
						<div className="article-kicker">
							<Rss size={13} className="icon-feed" aria-hidden="true" />
							<span>{article.feed_title}</span>
						</div>
						<h1>
							{showTitleTranslation && article.translated_title
								? article.translated_title
								: article.title}
						</h1>
						{showTitleTranslation && article.translated_title && (
							<div className="original-title">
								{article.title}
								<Button
									variant="ghost"
									size="icon"
									aria-label="重新翻译标题"
									disabled={!canGenerate || Boolean(actionBusy)}
									onClick={() => run("translate-title", true)}
								>
									<RotateCw size={12} />
								</Button>
							</div>
						)}
						<div className="article-byline">
							<span>
								<UserRound size={13} aria-hidden="true" />
								{article.author || article.feed_title}
							</span>
							<time dateTime={article.published_at}>
								<CalendarDays size={13} aria-hidden="true" />
								{new Date(article.published_at).toLocaleDateString("zh-CN", {
									year: "numeric",
									month: "short",
									day: "numeric",
								})}
							</time>
							<a href={article.url} target="_blank" rel="noopener noreferrer">
								<ArrowUpRight size={13} className="icon-info" aria-hidden="true" />
								阅读原文
							</a>
						</div>
						<div className="reader-assistant">
							<div className="assistant-heading">
								<span>
									<Sparkles size={13} className="icon-ai" />
									阅读助手
								</span>
								<Button variant="ghost" size="icon" aria-label="AI 设置" onClick={onAiSettings}>
									<Settings2 size={14} />
								</Button>
							</div>
							{ai?.mock && <p className="assistant-hint">自动化测试 · 模拟 AI</p>}
							{ai && !canGenerate && (
								<p className="assistant-hint">尚未配置 AI，请先设置服务商和密钥。</p>
							)}
							<fieldset className="ai-toolbar" aria-label="阅读助手操作">
								<Button
									variant="ghost"
									size="sm"
									aria-pressed={Boolean(article.summary && showSummary)}
									disabled={!article.summary && (!canGenerate || Boolean(actionBusy))}
									onClick={() => (article.summary ? setShowSummary(!showSummary) : run("summary"))}
								>
									{actionBusy === "summary" ? (
										<LoaderCircle size={14} className="spinning" />
									) : (
										<Sparkles size={14} className="icon-ai" />
									)}
									{actionBusy === "summary"
										? "正在生成摘要…"
										: article.summary
											? showSummary
												? "收起摘要"
												: "查看摘要"
											: "AI 摘要"}
								</Button>
								<Button
									variant="ghost"
									size="sm"
									aria-pressed={Boolean(article.translated_title && showTitleTranslation)}
									disabled={!article.translated_title && (!canGenerate || Boolean(actionBusy))}
									onClick={() =>
										article.translated_title
											? setShowTitleTranslation(!showTitleTranslation)
											: run("translate-title")
									}
								>
									{actionBusy === "translate-title" ? (
										<LoaderCircle size={14} className="spinning" />
									) : (
										<Languages size={14} className="icon-info" />
									)}
									{actionBusy === "translate-title"
										? "正在翻译标题…"
										: article.translated_title
											? showTitleTranslation
												? "显示原标题"
												: "显示中文标题"
											: "翻译标题"}
								</Button>
								<Button
									variant="ghost"
									size="sm"
									aria-pressed={Boolean(translation && article.translated_content)}
									disabled={!article.translated_content && (!canGenerate || Boolean(actionBusy))}
									onClick={() =>
										article.translated_content ? onTranslation(!translation) : run("translate")
									}
								>
									{actionBusy === "translate" ? (
										<LoaderCircle size={14} className="spinning" />
									) : (
										<Languages size={14} className="icon-info" />
									)}
									{actionBusy === "translate"
										? "正在翻译全文…"
										: article.translated_content
											? translation
												? "阅读原文"
												: "阅读译文"
											: "翻译全文"}
								</Button>
								{article.full_content_fetched ? (
									<span className="extraction-complete">
										<Check size={14} className="icon-reading" />
										全文已提取
									</span>
								) : (
									<Button
										variant="ghost"
										size="sm"
										disabled={Boolean(actionBusy)}
										onClick={() => run("full")}
									>
										{actionBusy === "full" ? (
											<LoaderCircle size={14} className="spinning" />
										) : (
											<Maximize2 size={14} className="icon-feed" />
										)}
										{actionBusy === "full" ? "正在提取全文…" : "提取全文"}
									</Button>
								)}
							</fieldset>
							{actionBusy && (
								<p className="assistant-hint" role="status">
									{actionBusy === "full"
										? "正在从原网站提取正文…"
										: "正在处理，长文可能需要约一分钟…"}
									可切换文章，完成后结果自动保存。
								</p>
							)}
							{actionError && !actionBusy && (
								<div className="assistant-error" role="alert">
									<CircleAlert size={14} />
									<p>{actionError.message}</p>
									<Button variant="outline" size="sm" onClick={() => run(actionError.kind, true)}>
										重试
									</Button>
									{actionError.kind !== "full" && (
										<Button variant="ghost" size="sm" onClick={onAiSettings}>
											检查 AI 设置
										</Button>
									)}
								</div>
							)}
						</div>
					</header>
					<div className="article-body">
						{article.summary && showSummary && (
							<aside className="ai-summary" aria-label="AI 摘要">
								<div>
									<Sparkles size={14} className="icon-ai" aria-hidden="true" />
									<strong>阅读前，先抓住重点</strong>
									<Badge>AI 摘要</Badge>
								</div>
								<p>{article.summary}</p>
								<footer>
									<span>
										{article.ai_model === "local-mock" ? "本地模拟结果" : "AI 生成 · 以原文为准"}
									</span>
									<Button
										variant="ghost"
										size="sm"
										disabled={!canGenerate || Boolean(actionBusy)}
										onClick={() => run("summary", true)}
									>
										<RotateCw size={12} />
										重新生成摘要
									</Button>
								</footer>
							</aside>
						)}
						{translation && article.translated_content && (
							<div className="translation-note">
								<Languages size={14} className="icon-info" aria-hidden="true" />
								中文译文{" "}
								<Button variant="ghost" size="sm" onClick={() => onTranslation(false)}>
									切换原文
								</Button>
								<Button
									variant="ghost"
									size="sm"
									disabled={!canGenerate || Boolean(actionBusy)}
									onClick={() => run("translate", true)}
								>
									<RotateCw size={12} />
									重新翻译全文
								</Button>
							</div>
						)}
						{content ? (
							<Suspense fallback={<p role="status">正在整理正文…</p>}>
								<ReaderContent
									content={content}
									url={article.url}
									title={article.title}
									showImages={preferences.showImages}
								/>
							</Suspense>
						) : (
							<div className="empty-state">
								<p>订阅源只提供了文章标题，可以提取全文或打开原文。</p>
								<Button size="sm" disabled={Boolean(actionBusy)} onClick={() => onAction("full")}>
									提取全文
								</Button>
							</div>
						)}
						<div className="article-end">
							<Flower2 size={22} className="icon-reading" aria-hidden="true" />
							<p>这一篇，读完了。</p>
							<a href={article.url} target="_blank" rel="noopener noreferrer">
								到原站继续探索 <ArrowUpRight size={13} />
							</a>
						</div>
					</div>
				</article>
			</div>
		</section>
	);
}
