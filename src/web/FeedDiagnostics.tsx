import { Badge, Button, Input, LayerCard } from "@nocoo/basalt";
import { ArrowRight, ExternalLink, LoaderCircle, Pause, RefreshCw, Trash2 } from "lucide-react";
import type { ConnectionCheck, Feed, FeedInspection } from "../shared/contracts";
import { DiagnosticScore } from "./DiagnosticScore";
import { type Save, useDiagnosticViewModel } from "./lib/panels-view-model";

const timestamp = (value: string | null) =>
	value ? new Date(value).toLocaleString("zh-CN", { hour12: false }) : "未提供";

function Connection({ check }: { check: ConnectionCheck }) {
	return (
		<div className="connection-result">
			<div>
				<Badge>{check.status === null ? "未连接" : `HTTP ${check.status}`}</Badge>
				<span>{check.durationMs} ms</span>
			</div>
			{check.error && <p className="inline-error">{check.error}</p>}
			{check.hops.length > 1 && (
				<details>
					<summary>{check.hops.length - 1} 次跳转</summary>
					<pre>{check.hops.map((hop) => `${hop.status} ${hop.url}`).join("\n")}</pre>
				</details>
			)}
			<a className="diagnostic-url" href={check.finalUrl} target="_blank" rel="noopener noreferrer">
				{check.finalUrl}
				<ExternalLink size={12} />
			</a>
		</div>
	);
}

function Coverage({
	inspection,
	staleAfterDays,
}: {
	inspection: FeedInspection;
	staleAfterDays: number;
}) {
	return (
		<>
			<dl className="diagnostic-metrics">
				<div>
					<dt>返回文章</dt>
					<dd>{inspection.entries === null ? "无法解析" : `${inspection.entries} 条`}</dd>
				</div>
				<div>
					<dt>距最近发布</dt>
					<dd>{inspection.ageDays === null ? "时间未知" : `${inspection.ageDays} 天`}</dd>
				</div>
				<div>
					<dt>最早发布</dt>
					<dd>{timestamp(inspection.oldestAt)}</dd>
				</div>
				<div>
					<dt>最近发布</dt>
					<dd>{timestamp(inspection.latestAt)}</dd>
				</div>
			</dl>
			{inspection.ageDays !== null && inspection.ageDays >= staleAfterDays && (
				<p className="diagnostic-warning">
					已超过 {staleAfterDays} 天没有发布新内容，可能停更；可结合主站和替代地址决定是否保留。
				</p>
			)}
			{inspection.entries === 0 && (
				<p className="diagnostic-warning">源可以解析，但没有返回文章。</p>
			)}
			{inspection.entries !== null && inspection.entries > inspection.readableEntries && (
				<p className="field-hint">
					前 {Math.min(200, inspection.entries)} 条中可读取 {inspection.readableEntries}{" "}
					条；缺少标题或安全链接的条目不会入库。时间范围覆盖全部返回条目。
				</p>
			)}
			{(inspection.undatedEntries > 0 || inspection.futureEntries > 0) && (
				<p className="field-hint">
					{inspection.undatedEntries} 条未提供有效时间，{inspection.futureEntries}{" "}
					条日期超前；这些时间不用于判断新鲜度。
				</p>
			)}
		</>
	);
}

export function FeedDiagnostics({
	feed,
	pending,
	save,
	onDone,
	remove,
}: {
	feed: Feed;
	pending: boolean;
	save: Save;
	onDone: () => void;
	remove: (path: string, name: string, description: string) => Promise<void>;
}) {
	const vm = useDiagnosticViewModel(feed.id);
	const report = vm.query.data?.report;
	const candidates = report?.candidates.filter((candidate) => !candidate.inspection.error) ?? [];
	const failedCandidates =
		report?.candidates.filter((candidate) => candidate.inspection.error) ?? [];
	return (
		<div className="form-stack feed-diagnostics">
			<div className="diagnostic-source">
				<RssLabel feed={feed} />
				<Button
					size="sm"
					variant="outline"
					disabled={vm.busy}
					onClick={() => vm.start.mutate(undefined)}
				>
					<RefreshCw size={13} />
					重新检查
				</Button>
			</div>
			{vm.busy && (
				<div className="diagnostic-progress" role="status">
					<LoaderCircle className="spinning" size={20} />
					<div>
						<strong>正在检查这个订阅源…</strong>
						<p>检查 RSS、主站的 HTTP / HTTPS 和可替代的订阅地址。可以关闭窗口，稍后查看。</p>
					</div>
				</div>
			)}
			{vm.error && (
				<p className="inline-error" role="alert">
					{vm.error}
				</p>
			)}
			{report && !vm.busy && (
				<>
					<p className="field-hint">
						检查于 {timestamp(report.checkedAt)} · 用时 {(report.durationMs / 1000).toFixed(1)} 秒 ·
						上次更新成功：{timestamp(feed.last_fetched_at)}
					</p>
					{vm.assessment && (
						<DiagnosticScore
							assessment={vm.assessment}
							onShowReplacement={() => document.getElementById(`recommended-${feed.id}`)?.focus()}
						/>
					)}
					<LayerCard className="diagnostic-card">
						<h3>当前 RSS</h3>
						<Connection check={report.feed} />
						<Coverage inspection={report.feed} staleAfterDays={report.staleAfterDays} />
					</LayerCard>
					<div className="diagnostic-section-heading">
						<h3>主站连通性</h3>
						<span>分别尝试 HTTPS 与 HTTP，并跟随安全跳转</span>
					</div>
					<div className="site-checks">
						{report.sites.map((site) => (
							<LayerCard key={site.url} className="diagnostic-card">
								<h4>{new URL(site.url).protocol === "https:" ? "HTTPS" : "HTTP"}</h4>
								<Connection check={site} />
							</LayerCard>
						))}
					</div>
					{!report.siteUrl && (
						<p className="field-hint">没有找到主站地址。可在下面填写网站首页后重新发现 RSS。</p>
					)}
					<form
						className="diagnostic-site-form"
						onSubmit={(event) => {
							event.preventDefault();
							const siteUrl = new FormData(event.currentTarget).get("siteUrl");
							if (typeof siteUrl === "string") vm.start.mutate(siteUrl);
						}}
					>
						<label className="field-label" htmlFor={`diagnostic-site-${feed.id}`}>
							用于重新发现的主站
							<Input
								id={`diagnostic-site-${feed.id}`}
								name="siteUrl"
								type="url"
								required
								maxLength={2048}
								defaultValue={report.siteUrl ?? ""}
								placeholder="https://example.com/blog/"
							/>
						</label>
						<Button type="submit" size="sm" variant="outline" disabled={vm.busy}>
							从主站重新发现
						</Button>
					</form>
					<div className="diagnostic-section-heading">
						<h3>可替代的 RSS</h3>
						<span>{candidates.length} 个地址通过解析检查</span>
					</div>
					{candidates.map((candidate) => (
						<LayerCard
							key={candidate.url}
							className="diagnostic-card candidate-card"
							id={candidate === vm.assessment?.replacement ? `recommended-${feed.id}` : undefined}
							tabIndex={candidate === vm.assessment?.replacement ? -1 : undefined}
						>
							<div className="candidate-heading">
								<h4>{candidate.inspection.title}</h4>
								<Badge>
									{candidate.source === "page"
										? "主站声明"
										: candidate.source === "redirect"
											? "当前源的跳转地址"
											: "常见地址验证"}
								</Badge>
							</div>
							{candidate === vm.assessment?.replacement && <Badge>推荐核对后替换</Badge>}
							<Connection check={candidate.inspection} />
							<Coverage inspection={candidate.inspection} staleAfterDays={report.staleAfterDays} />
							<Button
								size="sm"
								disabled={pending}
								onClick={() =>
									void save(
										`/feeds/${feed.id}`,
										"PATCH",
										{
											url: candidate.inspection.finalUrl,
											site_url: candidate.inspection.siteUrl || report.siteUrl || feed.site_url,
											is_active: true,
										},
										onDone,
									)
								}
							>
								<ArrowRight size={14} />
								使用此地址
							</Button>
						</LayerCard>
					))}
					{!candidates.length && (
						<p className="field-hint">
							没有找到可解析的替代地址。可以填写其他主站地址再查，或手动修改 RSS。
						</p>
					)}
					{failedCandidates.length > 0 && (
						<details className="failed-candidates">
							<summary>查看另外 {failedCandidates.length} 个地址的检查结果</summary>
							{failedCandidates.map((candidate) => (
								<Connection key={candidate.url} check={candidate.inspection} />
							))}
						</details>
					)}
				</>
			)}
			<details className="manual-replacement">
				<summary>手动修改 RSS 地址</summary>
				<form
					className="form-stack"
					onSubmit={(event) => {
						event.preventDefault();
						const url = new FormData(event.currentTarget).get("url");
						void save(`/feeds/${feed.id}`, "PATCH", { url, is_active: true }, onDone);
					}}
				>
					<label className="field-label" htmlFor={`diagnostic-rss-${feed.id}`}>
						新的 RSS 地址
						<Input
							id={`diagnostic-rss-${feed.id}`}
							name="url"
							required
							maxLength={2048}
							placeholder="https://example.com/feed.xml 或 rsshub:// 路由"
						/>
					</label>
					<Button type="submit" size="sm" disabled={pending}>
						替换地址并更新
					</Button>
				</form>
			</details>
			<p className="field-hint">替换地址会保留已有文章与阅读状态。暂停后可在设置中恢复更新。</p>
			<div className="diagnostic-decisions">
				<Button
					variant="outline"
					size="sm"
					disabled={pending || !feed.is_active}
					onClick={() => void save(`/feeds/${feed.id}`, "PATCH", { is_active: false }, onDone)}
				>
					<Pause size={14} />
					{feed.is_active ? "暂停订阅，保留文章" : "已暂停订阅"}
				</Button>
				<Button
					variant="ghost"
					size="sm"
					disabled={pending}
					onClick={() =>
						void remove(
							`/feeds/${feed.id}`,
							`「${feed.title}」`,
							"该订阅和所有文章、收藏、稍后阅读记录将被删除。若想保留文章，请使用暂停订阅。",
						)
					}
				>
					<Trash2 size={14} />
					删除订阅
				</Button>
				<Button variant="ghost" size="sm" onClick={onDone}>
					保留当前订阅
				</Button>
			</div>
		</div>
	);
}

function RssLabel({ feed }: { feed: Feed }) {
	return (
		<div>
			<strong>{feed.title}</strong>
			<code>{feed.url}</code>
		</div>
	);
}
