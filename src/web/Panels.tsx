import {
	Badge,
	Button,
	ConfirmDialog,
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	Input,
	LayerCard,
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
	useConfirm,
} from "@nocoo/basalt";
import { AiConfigProvider, AiSettingsPanel } from "@nocoo/next-ai/react";
import { ArrowUpRight, Check, Compass, Plus, Sparkles, Terminal, Trash2, X } from "lucide-react";
import { useState } from "react";
import type { Category, Feed, FetchLog, Preferences, Stats } from "../shared/contracts";
import { FeedDiagnostics } from "./FeedDiagnostics";
import { aiAdapter } from "./lib/api";
import {
	type Panel,
	type Save,
	useDirectoryViewModel,
	usePanelViewModel,
} from "./lib/panels-view-model";
import { sizeLabel } from "./lib/reader";
import type { SavedChange } from "./lib/reader-view-model";
import { Categories, Subscriptions } from "./Subscriptions";

interface Props {
	panel: Panel;
	onClose: () => void;
	feeds: Feed[];
	categories: Category[];
	preferences: Preferences;
	stats?: Stats;
	logs: FetchLog[];
	local: boolean;
	onChanged: (change: SavedChange) => Promise<void>;
	diagnosticFeed?: Feed;
	onDiagnose: (feed: Feed) => void;
	onNotice: (message: string) => void;
}

const titles = {
	add: ["添加订阅", "让值得关注的声音，出现在你的阅读空间。"],
	discover: ["发现好内容", "独立的声音、深入的思考，以及下一次灵感。"],
	settings: ["设置", "整理订阅与分类，调整阅读和 AI 偏好。"],
	diagnose: ["订阅源诊断", "检查内容是否仍在更新，找到更合适的订阅地址。"],
	logs: ["抓取日志", "订阅源的最近活动。"],
};

export function Panels(props: Props) {
	const { pending, save } = usePanelViewModel(props.onChanged, props.onNotice);
	const { confirm, dialogProps } = useConfirm();
	const remove = async (path: string, name: string, description: string) => {
		if (
			await confirm({
				title: `删除${name}？`,
				description,
				confirmLabel: "确认删除",
				cancelLabel: "保留",
				variant: "destructive",
			})
		)
			if (await save(path, "DELETE")) {
				if (props.panel === "diagnose") props.onClose();
			}
	};
	const title = props.panel ? titles[props.panel] : ["", ""];
	return (
		<>
			<Dialog
				open={Boolean(props.panel)}
				onOpenChange={(open) => {
					if (!open) props.onClose();
				}}
			>
				<DialogContent
					key={props.panel}
					size={props.panel === "add" ? "lg" : "xl"}
					className="app-dialog"
				>
					<DialogHeader>
						<DialogTitle>{title[0]}</DialogTitle>
						<DialogDescription>{title[1]}</DialogDescription>
					</DialogHeader>
					{props.panel === "add" && (
						<AddFeed
							categories={props.categories}
							pending={pending}
							save={save}
							onClose={props.onClose}
						/>
					)}
					{props.panel === "discover" && (
						<Discover feeds={props.feeds} pending={pending} save={save} />
					)}
					{props.panel === "settings" && (
						<Settings
							feeds={props.feeds}
							categories={props.categories}
							remove={remove}
							onDiagnose={props.onDiagnose}
							preferences={props.preferences}
							stats={props.stats}
							local={props.local}
							pending={pending}
							save={save}
							onRefresh={() =>
								props.onChanged({ path: "/ai/settings", method: "PATCH", result: null })
							}
							onNotice={props.onNotice}
							confirm={confirm}
						/>
					)}
					{props.panel === "logs" && (
						<Logs
							logs={props.logs}
							feeds={props.feeds}
							onClear={() =>
								void remove("/logs", "抓取日志", "仅清除抓取日志，订阅源和文章不受影响。")
							}
						/>
					)}
					{props.panel === "diagnose" && props.diagnosticFeed && (
						<FeedDiagnostics
							key={props.diagnosticFeed.id}
							feed={props.diagnosticFeed}
							pending={pending}
							save={save}
							remove={remove}
							onDone={props.onClose}
						/>
					)}
					<DialogClose asChild>
						<Button variant="ghost" size="icon" className="panel-close" aria-label="关闭窗口">
							<X size={16} />
						</Button>
					</DialogClose>
				</DialogContent>
			</Dialog>
			<ConfirmDialog {...dialogProps} />
		</>
	);
}

function AddFeed({
	categories,
	pending,
	save,
	onClose,
}: {
	categories: Category[];
	pending: boolean;
	save: Save;
	onClose: () => void;
}) {
	return (
		<form
			className="form-stack"
			onSubmit={(event) => {
				event.preventDefault();
				const data = new FormData(event.currentTarget);
				void save(
					"/feeds",
					"POST",
					{
						url: data.get("url"),
						title: data.get("title") || undefined,
						category_id: data.get("category") || null,
					},
					onClose,
				);
			}}
		>
			<label className="field-label" htmlFor="add-feed-url">
				订阅地址
				<Input
					id="add-feed-url"
					autoFocus
					name="url"
					type="text"
					required
					maxLength={2048}
					placeholder="https://example.com/feed.xml"
				/>
			</label>
			<p className="field-hint">支持 RSS、Atom 和 rsshub:// 路由。</p>
			<label className="field-label" htmlFor="add-feed-title">
				名称 <span>可选</span>
				<Input id="add-feed-title" name="title" maxLength={200} placeholder="为这个订阅取个名字" />
			</label>
			<label className="field-label">
				分类
				<select name="category" className="select-control" aria-label="分类">
					<option value="">未分类</option>
					{categories.map((category) => (
						<option key={category.id} value={category.id}>
							{category.name}
						</option>
					))}
				</select>
			</label>
			<div className="form-actions">
				<Button variant="ghost" type="button" onClick={onClose}>
					取消
				</Button>
				<Button type="submit" disabled={pending}>
					<Plus size={15} />
					{pending ? "添加中…" : "添加订阅"}
				</Button>
			</div>
		</form>
	);
}

function Discover({ feeds, pending, save }: { feeds: Feed[]; pending: boolean; save: Save }) {
	const [search, setSearch] = useState("");
	const [visible, setVisible] = useState(36);
	const { directory, matches } = useDirectoryViewModel(search);
	return (
		<div className="form-stack">
			<div className="discovery-intro">
				<Compass size={32} />
				<div>
					<h3>订阅你关心的世界。</h3>
					<p>没有推荐算法，只有你自己选择的好内容。</p>
				</div>
			</div>
			<Input
				aria-label="搜索发现内容"
				placeholder="寻找网站、主题或作者…"
				value={search}
				onChange={(event) => {
					setSearch(event.target.value);
					setVisible(36);
				}}
			/>
			{directory.isError && <p role="alert">{directory.error.message}</p>}
			{directory.isPending && <p role="status">正在加载发现列表…</p>}
			{directory.data && (
				<p className="muted">{matches.length.toLocaleString()} 个精选博客 · 按评分排列</p>
			)}
			<div className="discovery-grid">
				{matches.slice(0, visible).map((item) => {
					const subscribed = Boolean(item.url) && feeds.some((feed) => feed.url === item.url);
					return (
						<LayerCard key={item.id} className="discovery-card">
							<div>
								<span className="source-icon">{item.title.slice(0, 1)}</span>
								<Badge>{item.category}</Badge>
								{item.score.overall !== undefined && <Badge>评分 {item.score.overall}</Badge>}
							</div>
							<h3>{item.title}</h3>
							<p>{item.description}</p>
							<footer>
								<a href={item.site_url} target="_blank" rel="noopener noreferrer">
									访问网站 <ArrowUpRight size={13} />
								</a>
								<Button
									size="sm"
									variant={subscribed ? "ghost" : "outline"}
									disabled={!item.url || subscribed || pending}
									onClick={() => void save("/feeds", "POST", { title: item.title, url: item.url })}
								>
									{subscribed ? <Check size={13} /> : <Plus size={13} />}
									{!item.url ? "暂无可用 RSS" : subscribed ? "已订阅" : "订阅"}
								</Button>
							</footer>
						</LayerCard>
					);
				})}
			</div>
			{matches.length > visible && (
				<Button variant="outline" onClick={() => setVisible((count) => count + 36)}>
					加载更多（已显示 {visible} / {matches.length}）
				</Button>
			)}
			{directory.data && !matches.length && <p className="empty-state">没有找到匹配的订阅源。</p>}
		</div>
	);
}

function Settings({
	feeds,
	categories,
	remove,
	onDiagnose,
	preferences,
	stats,
	local,
	pending,
	save,
	onRefresh,
	onNotice,
	confirm,
}: {
	feeds: Feed[];
	categories: Category[];
	remove: (path: string, name: string, description: string) => Promise<void>;
	onDiagnose: (feed: Feed) => void;
	preferences: Preferences;
	stats?: Stats;
	local: boolean;
	pending: boolean;
	save: Save;
	onRefresh: () => Promise<void>;
	onNotice: (message: string) => void;
	confirm: ReturnType<typeof useConfirm>["confirm"];
}) {
	const [adding, setAdding] = useState(false);
	return (
		<Tabs defaultValue="feeds" className="settings-tabs">
			<TabsList className="panel-tabs" aria-label="设置范围">
				<TabsTrigger value="feeds">
					订阅源 <Badge>{feeds.length}</Badge>
				</TabsTrigger>
				<TabsTrigger value="categories">
					分类 <Badge>{categories.length}</Badge>
				</TabsTrigger>
				<TabsTrigger value="reading">阅读</TabsTrigger>
				<TabsTrigger value="ai">AI 助手</TabsTrigger>
				<TabsTrigger value="data">数据管理</TabsTrigger>
			</TabsList>
			<TabsContent value="feeds">
				{adding ? (
					<AddFeed
						categories={categories}
						pending={pending}
						save={save}
						onClose={() => setAdding(false)}
					/>
				) : (
					<Subscriptions
						feeds={feeds}
						categories={categories}
						pending={pending}
						save={save}
						remove={remove}
						onAdd={() => setAdding(true)}
						onDiagnose={onDiagnose}
					/>
				)}
			</TabsContent>
			<TabsContent value="categories">
				<Categories
					feeds={feeds}
					categories={categories}
					pending={pending}
					save={save}
					remove={remove}
				/>
			</TabsContent>
			<TabsContent value="reading">
				<form
					className="form-stack"
					onSubmit={(event) => {
						event.preventDefault();
						const data = new FormData(event.currentTarget);
						void save(
							"/settings",
							"PATCH",
							{
								theme: data.get("theme"),
								fontSize: Number(data.get("fontSize")),
								fontFamily: data.get("fontFamily"),
								showImages: data.get("showImages") === "on",
								rsshubUrl: data.get("rsshubUrl"),
							},
							() => onNotice("阅读偏好已保存"),
						);
					}}
				>
					<div className="form-grid">
						<label className="field-label">
							主题
							<select
								name="theme"
								className="select-control"
								aria-label="主题"
								defaultValue={preferences.theme}
							>
								<option value="dark">深色</option>
								<option value="light">浅色</option>
								<option value="system">跟随系统</option>
							</select>
						</label>
						<label className="field-label">
							正文字体
							<select
								name="fontFamily"
								className="select-control"
								defaultValue={preferences.fontFamily}
							>
								<option value="serif">衬线 · 适合长文</option>
								<option value="sans">无衬线 · 清晰简洁</option>
							</select>
						</label>
					</div>
					<label className="field-label">
						文字大小
						<select name="fontSize" className="select-control" defaultValue={preferences.fontSize}>
							{[14, 16, 18, 20, 22, 24].map((size) => (
								<option value={size} key={size}>
									{size} px
								</option>
							))}
						</select>
					</label>
					<label className="checkbox-label">
						<input type="checkbox" name="showImages" defaultChecked={preferences.showImages} />
						显示文章中的图片
					</label>
					<label className="field-label" htmlFor="settings-rsshub">
						RSSHub 实例
						<Input
							id="settings-rsshub"
							name="rsshubUrl"
							type="url"
							defaultValue={preferences.rsshubUrl}
							required
						/>
					</label>
					<p className="field-hint">rsshub:// 路由将通过此实例转换为订阅地址。</p>
					<div className="form-actions">
						<Button type="submit" disabled={pending}>
							保存阅读偏好
						</Button>
					</div>
				</form>
				<div className="shortcut-guide">
					<h3>键盘快捷键</h3>
					<dl>
						{[
							["J / K", "下一篇 / 上一篇"],
							["↑ / ↓", "在列表中切换文章"],
							["/", "搜索文章"],
							["Esc", "返回列表或关闭窗口"],
							["M", "切换已读"],
							["S", "收藏 / 取消收藏"],
							["L", "稍后阅读"],
							["O", "打开原文"],
							["R", "刷新订阅"],
						].map(([key, label]) => (
							<div key={key}>
								<dt>
									<kbd>{key}</kbd>
								</dt>
								<dd>{label}</dd>
							</div>
						))}
					</dl>
					<p className="field-hint">
						输入文字和打开弹窗时，阅读快捷键暂停；正文中的方向键保留滚动。
					</p>
				</div>
			</TabsContent>
			<TabsContent value="ai">
				<div className="form-stack">
					{local && (
						<p className="local-ai-note">
							<Sparkles size={16} />
							未配置密钥时提供本地模拟摘要与翻译；保存密钥后使用真实模型。
						</p>
					)}
					<AiConfigProvider adapter={aiAdapter}>
						<AiSettingsPanel
							className="next-ai-panel"
							onSaveSuccess={() => {
								void onRefresh();
								onNotice("AI 设置已保存");
							}}
							onTestError={onNotice}
						/>
					</AiConfigProvider>
					<p className="field-hint">
						密钥加密保存。切换服务商或自定义地址后，需要重新填写密钥。仅在你使用 AI
						或启用自动翻译时发送文章内容。
					</p>
					<Button
						variant="outline"
						size="sm"
						disabled={pending}
						onClick={() =>
							void save("/ai/settings", "PATCH", { apiKey: "" }, () => onNotice("AI 密钥已移除"))
						}
					>
						移除已保存的密钥
					</Button>
				</div>
			</TabsContent>
			<TabsContent value="data">
				<div className="form-stack">
					<div className="stats-grid">
						{[
							{ label: "订阅源", value: stats?.feeds },
							{ label: "已保存文章", value: stats?.articles },
							{ label: "收藏文章", value: stats?.starred },
							{ label: "正文数据", value: sizeLabel(stats?.bytes ?? 0) },
						].map((item) => (
							<LayerCard key={item.label}>
								<span>{item.label}</span>
								<strong>{item.value ?? "—"}</strong>
							</LayerCard>
						))}
					</div>
					<form
						className="form-stack cleanup-form"
						onSubmit={async (event) => {
							event.preventDefault();
							const data = new FormData(event.currentTarget);
							const days = Number(data.get("days"));
							if (
								await confirm({
									title: "清理已读文章？",
									description: `删除 ${days} 天前的已读文章，保留收藏和稍后阅读。此操作不可撤销。`,
									confirmLabel: "清理文章",
									cancelLabel: "取消",
									variant: "destructive",
								})
							)
								await save("/cleanup", "POST", { days, onlyRead: true }, () =>
									onNotice("文章清理完成"),
								);
						}}
					>
						<h3>整理旧文章</h3>
						<p className="field-hint">清理较早的已读内容，收藏和稍后阅读会保留。</p>
						<label className="field-label">
							保留最近
							<select name="days" className="select-control" defaultValue="30">
								<option value="7">7 天</option>
								<option value="30">30 天</option>
								<option value="90">90 天</option>
								<option value="365">一年</option>
							</select>
						</label>
						<div className="form-actions">
							<Button type="submit" variant="outline" disabled={pending}>
								<Trash2 size={14} />
								清理已读文章
							</Button>
						</div>
					</form>
				</div>
			</TabsContent>
		</Tabs>
	);
}

function Logs({ logs, feeds, onClear }: { logs: FetchLog[]; feeds: Feed[]; onClear: () => void }) {
	const [feedId, setFeedId] = useState("");
	const [level, setLevel] = useState("");
	const filtered = logs.filter(
		(log) => (!feedId || log.feed_id === feedId) && (!level || log.level === level),
	);
	return (
		<div className="form-stack">
			<div className="log-filters">
				<select
					className="select-control"
					aria-label="按订阅源筛选日志"
					value={feedId}
					onChange={(event) => setFeedId(event.target.value)}
				>
					<option value="">全部订阅源</option>
					{feeds.map((feed) => (
						<option value={feed.id} key={feed.id}>
							{feed.title}
						</option>
					))}
				</select>
				<select
					className="select-control"
					aria-label="按状态筛选日志"
					value={level}
					onChange={(event) => setLevel(event.target.value)}
				>
					<option value="">全部状态</option>
					<option value="success">成功</option>
					<option value="error">错误</option>
					<option value="info">信息</option>
				</select>
				<Button variant="ghost" size="sm" onClick={onClear}>
					清空日志
				</Button>
			</div>
			<div className="terminal-window">
				<div className="terminal-bar">
					<Terminal size={14} />
					<span>geekhub / feed activity</span>
					<span className="status-led" />
				</div>
				<div className="terminal-lines" role="log" aria-label="订阅抓取日志">
					{!filtered.length && <p className="muted">$ 没有匹配的日志_</p>}
					{filtered.map((log) => (
						<div className={`log-line ${log.level}`} key={log.id}>
							<time>{new Date(log.created_at).toLocaleTimeString("zh-CN")}</time>
							<span>{log.level === "success" ? "✓" : log.level === "error" ? "!" : "›"}</span>
							<p>
								<strong>{log.feed_title}</strong> {log.message}
								<small>{log.duration_ms !== null ? ` · ${log.duration_ms}ms` : ""}</small>
							</p>
						</div>
					))}
				</div>
			</div>
		</div>
	);
}
