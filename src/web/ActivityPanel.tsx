import { Button, Input } from "@nocoo/basalt";
import {
	Activity,
	ArrowUpRight,
	Bug,
	Check,
	ChevronDown,
	CircleAlert,
	Clock3,
	FileText,
	Languages,
	LoaderCircle,
	Rss,
	Search,
	Sparkles,
	Trash2,
} from "lucide-react";
import { useState } from "react";
import type { Feed, FetchLog } from "../shared/contracts";
import { runningActivities } from "./lib/reader";

const kinds = {
	feed: { label: "订阅抓取", Icon: Rss },
	translation: { label: "自动与手动翻译", Icon: Languages },
	summary: { label: "AI 摘要", Icon: Sparkles },
	extraction: { label: "正文提取", Icon: FileText },
	diagnostic: { label: "订阅诊断", Icon: Bug },
};

export function ActivityPanel({
	logs,
	feeds,
	updatedAt,
	error,
	loading,
	onRetry,
	onClear,
	onDiagnose,
}: {
	logs: FetchLog[];
	feeds: Feed[];
	updatedAt: number;
	error?: string;
	loading: boolean;
	onRetry: () => void;
	onClear: () => void;
	onDiagnose: (feed: Feed) => void;
}) {
	const [category, setCategory] = useState("");
	const [level, setLevel] = useState("");
	const [feedId, setFeedId] = useState("");
	const [search, setSearch] = useState("");
	const running = runningActivities(logs, updatedAt);
	const filtered = logs.filter(
		(log) =>
			(!category || (log.category ?? "feed") === category) &&
			(!level || log.level === level) &&
			(!feedId || log.feed_id === feedId) &&
			`${log.message} ${log.feed_title} ${log.article_title ?? ""}`
				.toLowerCase()
				.includes(search.trim().toLowerCase()),
	);
	const sources = new Map(
		logs.filter((log) => log.feed_id).map((log) => [log.feed_id as string, log.feed_title]),
	);
	return (
		<div className="activity-console">
			<div className="activity-overview">
				<div className="activity-signal">
					<Activity size={18} aria-hidden="true" />
					<span>
						ACTIVITY STREAM
						<small>{error ? "连接中断" : loading ? "正在连接" : "自动同步 · 内存缓存"}</small>
					</span>
					<span className={`status-led ${running.length ? "pulsing" : ""}`} />
				</div>
				<dl className="activity-metrics">
					<div>
						<dt>进行中</dt>
						<dd>
							{running.length +
								feeds.filter((feed) => feed.status === "queued" || feed.status === "fetching")
									.length}
						</dd>
					</div>
					<div>
						<dt>已完成</dt>
						<dd>{logs.filter((log) => log.level === "success").length}</dd>
					</div>
					<div>
						<dt>异常</dt>
						<dd>{logs.filter((log) => log.level === "error").length}</dd>
					</div>
					<div>
						<dt>缓存记录</dt>
						<dd>
							{logs.length}
							<small> / 500</small>
						</dd>
					</div>
				</dl>
			</div>
			<fieldset className="activity-categories" aria-label="活动类型">
				<Button size="sm" variant="ghost" aria-pressed={!category} onClick={() => setCategory("")}>
					<Activity size={14} aria-hidden="true" />
					全部<span>{logs.length}</span>
				</Button>
				{Object.entries(kinds).map(([key, { label, Icon }]) => (
					<Button
						key={key}
						size="sm"
						variant="ghost"
						aria-pressed={category === key}
						onClick={() => setCategory(key)}
					>
						<Icon size={14} aria-hidden="true" />
						{label}
						<span>{logs.filter((log) => (log.category ?? "feed") === key).length}</span>
					</Button>
				))}
			</fieldset>
			<div className="activity-filters">
				<div className="activity-search">
					<Search size={14} aria-hidden="true" />
					<Input
						aria-label="搜索活动"
						placeholder="搜索文章、订阅或详情"
						value={search}
						onChange={(event) => setSearch(event.target.value)}
					/>
				</div>
				<select
					className="select-control"
					aria-label="按状态筛选日志"
					value={level}
					onChange={(event) => setLevel(event.target.value)}
				>
					<option value="">全部状态</option>
					<option value="info">开始 / 信息</option>
					<option value="success">已完成</option>
					<option value="error">失败</option>
				</select>
				<select
					className="select-control"
					aria-label="按订阅源筛选日志"
					value={feedId}
					onChange={(event) => setFeedId(event.target.value)}
				>
					<option value="">全部订阅源</option>
					{[...sources].map(([id, title]) => (
						<option value={id} key={id}>
							{title}
						</option>
					))}
				</select>
			</div>
			{error && (
				<div className="activity-error" role="alert">
					<CircleAlert size={16} />
					<span>活动更新失败：{error}</span>
					<Button size="sm" variant="outline" onClick={onRetry}>
						重试
					</Button>
				</div>
			)}
			<div
				className="activity-timeline"
				role="log"
				aria-label="后台活动日志"
				aria-live="off"
				aria-busy={loading}
			>
				{!filtered.length && (
					<div className="empty-state">
						<Activity size={28} aria-hidden="true" />
						<h3>{loading ? "正在读取活动…" : logs.length ? "没有匹配的活动" : "暂无后台活动"}</h3>
						<p>
							{logs.length
								? "调整筛选条件，查看其他记录。"
								: "订阅更新、翻译和诊断的进展会出现在这里。"}
						</p>
					</div>
				)}
				{filtered.map((log) => {
					const { label, Icon } = kinds[log.category ?? "feed"];
					const active = running.some((entry) => entry.id === log.id);
					const StatusIcon = active
						? LoaderCircle
						: log.level === "error"
							? CircleAlert
							: log.level === "success"
								? Check
								: Clock3;
					const feed = feeds.find((feed) => feed.id === log.feed_id);
					return (
						<details key={log.id} className="activity-entry" data-level={log.level}>
							<summary>
								<span className="activity-kind-icon">
									<Icon size={16} aria-hidden="true" />
								</span>
								<span className="activity-entry-copy">
									<span className="activity-entry-heading">
										<strong>{log.message}</strong>
										<time dateTime={log.created_at}>
											{new Date(log.created_at).toLocaleTimeString("zh-CN", { hour12: false })}
										</time>
									</span>
									<span className="activity-entry-context">
										{log.feed_title}
										{log.article_title && ` · ${log.article_title}`}
									</span>
									<span className="activity-entry-meta">
										<StatusIcon size={12} className={active ? "spinning" : ""} aria-hidden="true" />
										{active
											? "进行中"
											: log.level === "error"
												? "失败"
												: log.level === "success"
													? "完成"
													: "开始 / 信息"}
										<span>{label}</span>
										{log.automatic && <span>自动</span>}
										{log.duration_ms !== null && (
											<span>{(log.duration_ms / 1000).toFixed(1)} s</span>
										)}
									</span>
								</span>
								<ChevronDown className="activity-expand" size={14} aria-hidden="true" />
							</summary>
							<div className="activity-entry-detail">
								<dl>
									<div>
										<dt>记录时间</dt>
										<dd>{new Date(log.created_at).toLocaleString("zh-CN", { hour12: false })}</dd>
									</div>
									<div>
										<dt>详情</dt>
										<dd>{log.message}</dd>
									</div>
									{log.article_title && (
										<div>
											<dt>文章</dt>
											<dd>{log.article_title}</dd>
										</div>
									)}
									{log.articles_added > 0 && (
										<div>
											<dt>新增文章</dt>
											<dd>{log.articles_added} 篇</dd>
										</div>
									)}
								</dl>
								<div className="activity-entry-actions">
									{feed && (
										<Button size="sm" variant="outline" onClick={() => onDiagnose(feed)}>
											<Bug size={14} />
											诊断订阅源
										</Button>
									)}
									{feed && log.article_id && (
										<Button size="sm" variant="outline" asChild>
											<a
												href={`/feeds/${encodeURIComponent(feed.id)}/articles/${encodeURIComponent(log.article_id)}`}
											>
												<ArrowUpRight size={14} />
												打开文章
											</a>
										</Button>
									)}
								</div>
							</div>
						</details>
					);
				})}
			</div>
			<div className="activity-console-footer">
				<span>
					{filtered.length} 条记录 ·{" "}
					{updatedAt
						? `${new Date(updatedAt).toLocaleTimeString("zh-CN", { hour12: false })} 更新`
						: "等待同步"}
				</span>
				<Button size="sm" variant="ghost" disabled={!logs.length} onClick={onClear}>
					<Trash2 size={14} aria-hidden="true" />
					清空日志
				</Button>
			</div>
		</div>
	);
}
