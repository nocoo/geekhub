import { Badge, Button } from "@nocoo/basalt";
import {
	ArrowLeft,
	ArrowUpRight,
	Bookmark,
	BookOpen,
	Check,
	ChevronRight,
	Languages,
	LoaderCircle,
	Maximize2,
	Sparkles,
	Star,
} from "lucide-react";
import { lazy, Suspense, useRef } from "react";
import type { AiAction, ArticleDetail, Preferences } from "../shared/contracts";
import { dateLabel } from "./lib/reader";
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
	onAction: (action: AiAction | "full") => void;
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
	statusBusy,
	actionBusy,
}: Props) {
	const scroll = useRef<HTMLDivElement>(null);
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
					<CompassIcon />
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
						<Star size={17} className={article.is_starred ? "starred" : ""} />
					</Button>
					<Button
						variant="ghost"
						size="icon"
						aria-label={article.is_later ? "移出稍后阅读" : "稍后阅读"}
						aria-pressed={Boolean(article.is_later)}
						disabled={statusBusy}
						onClick={() => onStatus({ is_later: !article.is_later })}
					>
						<Bookmark size={17} className={article.is_later ? "accent" : ""} />
					</Button>
					<Button
						variant="ghost"
						size="icon"
						aria-label={article.is_read ? "标为未读" : "标为已读"}
						disabled={statusBusy}
						onClick={() => onStatus({ is_read: !article.is_read })}
					>
						{article.is_read ? <Check size={17} /> : <BookOpen size={17} />}
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
					<div className="article-kicker">
						<span className="status-led" />
						{article.feed_title}
						<span>/</span>
						<time dateTime={article.published_at}>
							{new Date(article.published_at).toLocaleDateString("zh-CN", {
								year: "numeric",
								month: "long",
								day: "numeric",
							})}
						</time>
					</div>
					<h1>{article.translated_title || article.title}</h1>
					{article.translated_title && <p className="original-title">{article.title}</p>}
					<div className="article-byline">
						<span>{article.author || article.feed_title}</span>
						<span>·</span>
						<span>{dateLabel(article.published_at)}</span>
						<a href={article.url} target="_blank" rel="noopener noreferrer">
							原文 <ArrowUpRight size={12} />
						</a>
					</div>
					<div className="ai-toolbar">
						<Button
							variant="ghost"
							size="sm"
							disabled={Boolean(actionBusy)}
							onClick={() => onAction("summary")}
						>
							<Sparkles size={14} />
							{actionBusy === "summary" ? "正在提炼…" : article.summary ? "查看摘要" : "AI 摘要"}
						</Button>
						<Button
							variant="ghost"
							size="sm"
							disabled={Boolean(actionBusy) || Boolean(article.translated_title)}
							onClick={() => onAction("translate-title")}
						>
							<Languages size={14} />
							{actionBusy === "translate-title"
								? "翻译中…"
								: article.translated_title
									? "标题已翻译"
									: "翻译标题"}
						</Button>
						<Button
							variant="ghost"
							size="sm"
							disabled={Boolean(actionBusy)}
							onClick={() =>
								article.translated_content ? onTranslation(!translation) : onAction("translate")
							}
						>
							<Languages size={15} />
							{actionBusy === "translate" ? "正在翻译…" : translation ? "阅读原文" : "翻译全文"}
						</Button>
						<Button
							variant="ghost"
							size="sm"
							disabled={Boolean(actionBusy) || Boolean(article.full_content_fetched)}
							onClick={() => onAction("full")}
						>
							<Maximize2 size={13} />
							{actionBusy === "full"
								? "提取中…"
								: article.full_content_fetched
									? "已提取全文"
									: "提取全文"}
						</Button>
						{actionBusy && <LoaderCircle size={14} className="spinning accent" />}
					</div>
					{article.summary && (
						<aside className="ai-summary" aria-label="AI 摘要">
							<div>
								<Sparkles size={14} />
								<strong>阅读前，先抓住重点</strong>
								<Badge>AI 摘要</Badge>
							</div>
							<p>{article.summary}</p>
							<span>由 {article.ai_model} 生成 · 以原文为准</span>
						</aside>
					)}
					{translation && (
						<div className="translation-note">
							<Languages size={14} />
							中文译文{" "}
							<Button variant="ghost" size="sm" onClick={() => onTranslation(false)}>
								切换原文
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
						<span>✳</span>
						<p>这一篇，读完了。</p>
						<a href={article.url} target="_blank" rel="noopener noreferrer">
							到原站继续探索 <ArrowUpRight size={13} />
						</a>
					</div>
				</article>
			</div>
		</section>
	);
}

function CompassIcon() {
	return <BookOpen size={15} />;
}
