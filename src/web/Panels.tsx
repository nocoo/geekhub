import {
	Badge,
	Button,
	ConfirmDialog,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	Input,
	LayerCard,
	useConfirm,
} from "@nocoo/basalt";
import { AiConfigProvider, AiSettingsPanel } from "@nocoo/next-ai/react";
import { useQuery } from "@tanstack/react-query";
import {
	ArrowUpRight,
	Check,
	Compass,
	FolderPlus,
	Plus,
	RefreshCw,
	Rss,
	Settings2,
	Sparkles,
	Terminal,
	Trash2,
} from "lucide-react";
import { useState } from "react";
import type {
	Category,
	DirectoryFeed,
	Feed,
	FetchLog,
	Preferences,
	Stats,
} from "../shared/contracts";
import type { Panel } from "./App";
import { aiAdapter, api } from "./lib/api";
import { dateLabel, sizeLabel } from "./lib/reader";

interface Props {
	panel: Panel;
	onClose: () => void;
	feeds: Feed[];
	categories: Category[];
	preferences: Preferences;
	stats?: Stats;
	logs: FetchLog[];
	local: boolean;
	onRefresh: () => Promise<void>;
	onNotice: (message: string) => void;
}
type Save = (path: string, method: string, body?: unknown, done?: () => void) => Promise<void>;

const titles = {
	add: ["添加订阅", "让值得关注的声音，出现在你的阅读空间。"],
	manage: ["管理订阅", "整理订阅源和分类，找到自己的阅读节奏。"],
	discover: ["发现好内容", "独立的声音、深入的思考，以及下一次灵感。"],
	settings: ["阅读偏好", "让阅读器，适合你。"],
	logs: ["抓取日志", "订阅源的最近活动。"],
};

export function Panels(props: Props) {
	const [pending, setPending] = useState(false);
	const { confirm, dialogProps } = useConfirm();
	const save: Save = async (path, method, body, done) => {
		setPending(true);
		try {
			await api(path, { method, body });
			await props.onRefresh();
			done?.();
		} catch (error) {
			props.onNotice(error instanceof Error ? error.message : "操作失败，请重试");
		} finally {
			setPending(false);
		}
	};
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
			await save(path, "DELETE");
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
				<DialogContent size={props.panel === "add" ? "lg" : "xl"} className="app-dialog">
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
					{props.panel === "manage" && (
						<Manage
							feeds={props.feeds}
							categories={props.categories}
							pending={pending}
							save={save}
							remove={remove}
						/>
					)}
					{props.panel === "discover" && (
						<Discover feeds={props.feeds} pending={pending} save={save} />
					)}
					{props.panel === "settings" && (
						<Settings
							preferences={props.preferences}
							stats={props.stats}
							local={props.local}
							pending={pending}
							save={save}
							onRefresh={props.onRefresh}
							onNotice={props.onNotice}
							confirm={confirm}
						/>
					)}
					{props.panel === "logs" && (
						<Logs
							logs={props.logs}
							feeds={props.feeds}
							onClear={() =>
								void remove("/logs", "抓取日志", "仅清除当前账户的日志，订阅源和文章不受影响。")
							}
						/>
					)}
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

function Manage({
	feeds,
	categories,
	pending,
	save,
	remove,
}: {
	feeds: Feed[];
	categories: Category[];
	pending: boolean;
	save: Save;
	remove: (path: string, name: string, description: string) => Promise<void>;
}) {
	const [tab, setTab] = useState("feeds");
	const [editing, setEditing] = useState<string | null>(null);
	return (
		<>
			<div className="panel-tabs" role="tablist" aria-label="管理范围">
				<button
					type="button"
					role="tab"
					aria-selected={tab === "feeds"}
					onClick={() => setTab("feeds")}
				>
					订阅源 <Badge>{feeds.length}</Badge>
				</button>
				<button
					type="button"
					role="tab"
					aria-selected={tab === "categories"}
					onClick={() => setTab("categories")}
				>
					分类 <Badge>{categories.length}</Badge>
				</button>
			</div>
			{tab === "feeds" ? (
				<div className="manage-list">
					{!feeds.length && (
						<div className="empty-state">
							<Rss size={24} />
							<p>还没有订阅源，先添加一个喜欢的网站。</p>
						</div>
					)}
					{feeds.map((feed) => (
						<LayerCard key={feed.id} className="manage-feed">
							<div className="manage-feed-heading">
								<span className="source-icon">
									<Rss size={18} />
								</span>
								<div>
									<strong>{feed.title}</strong>
									<small>{feed.url}</small>
								</div>
								<Button
									variant="ghost"
									size="icon"
									aria-label={`刷新 ${feed.title}`}
									disabled={pending}
									onClick={() => void save(`/feeds/${feed.id}/refresh`, "POST")}
								>
									<RefreshCw size={15} />
								</Button>
								<Button
									variant="ghost"
									size="icon"
									aria-label={`编辑 ${feed.title}`}
									onClick={() => setEditing(editing === feed.id ? null : feed.id)}
								>
									<Settings2 size={16} />
								</Button>
								<Button
									variant="ghost"
									size="icon"
									aria-label={`删除 ${feed.title}`}
									disabled={pending}
									onClick={() =>
										void remove(
											`/feeds/${feed.id}`,
											`「${feed.title}」`,
											"该订阅及其中的文章、收藏和稍后阅读记录将一并删除。此操作不可撤销。",
										)
									}
								>
									<Trash2 size={15} />
								</Button>
							</div>
							<div className="manage-feed-meta">
								<span>
									{feed.total_count} 篇文章 · {feed.unread_count} 篇未读
								</span>
								<span>
									{feed.last_fetched_at ? `${dateLabel(feed.last_fetched_at)}更新` : "等待首次抓取"}
								</span>
								{Boolean(feed.auto_translate) && (
									<Badge>
										<Sparkles size={11} />
										自动翻译
									</Badge>
								)}
							</div>
							{feed.last_error && <p className="inline-error">{feed.last_error}</p>}
							{editing === feed.id && (
								<form
									className="form-stack feed-edit"
									onSubmit={(event) => {
										event.preventDefault();
										const data = new FormData(event.currentTarget);
										void save(
											`/feeds/${feed.id}`,
											"PATCH",
											{
												title: data.get("title"),
												category_id: data.get("category") || null,
												refresh_minutes: Number(data.get("refresh")),
												auto_translate: data.get("translate") === "on",
												is_active: data.get("active") === "on",
											},
											() => setEditing(null),
										);
									}}
								>
									<label className="field-label" htmlFor={`feed-title-${feed.id}`}>
										订阅名称
										<Input
											id={`feed-title-${feed.id}`}
											name="title"
											defaultValue={feed.title}
											required
											maxLength={200}
										/>
									</label>
									<div className="form-grid">
										<label className="field-label">
											分类
											<select
												aria-label="分类"
												name="category"
												className="select-control"
												defaultValue={feed.category_id ?? ""}
											>
												<option value="">未分类</option>
												{categories.map((category) => (
													<option key={category.id} value={category.id}>
														{category.name}
													</option>
												))}
											</select>
										</label>
										<label className="field-label">
											刷新间隔
											<select
												name="refresh"
												className="select-control"
												defaultValue={feed.refresh_minutes}
											>
												{[15, 30, 60, 180, 360, 720, 1440].map((minutes) => (
													<option key={minutes} value={minutes}>
														{minutes < 60 ? `${minutes} 分钟` : `${minutes / 60} 小时`}
													</option>
												))}
											</select>
										</label>
									</div>
									<label className="checkbox-label">
										<input
											type="checkbox"
											name="translate"
											defaultChecked={Boolean(feed.auto_translate)}
										/>
										自动翻译列表中的标题和简介
									</label>
									<label className="checkbox-label">
										<input type="checkbox" name="active" defaultChecked={Boolean(feed.is_active)} />
										定时更新订阅
									</label>
									<div className="form-actions">
										<Button type="submit" size="sm" disabled={pending}>
											保存订阅
										</Button>
									</div>
								</form>
							)}
						</LayerCard>
					))}
				</div>
			) : (
				<div className="form-stack">
					<form
						className="category-create"
						onSubmit={(event) => {
							event.preventDefault();
							const form = event.currentTarget;
							const data = new FormData(form);
							void save(
								"/categories",
								"POST",
								{ name: data.get("name"), color: data.get("color") },
								() => form.reset(),
							);
						}}
					>
						<Input
							name="name"
							aria-label="新分类名称"
							placeholder="新分类名称"
							required
							maxLength={60}
						/>
						<select name="color" className="select-control" aria-label="分类颜色">
							{["green", "blue", "amber", "violet", "rose"].map((color) => (
								<option key={color} value={color}>
									{
										{ green: "绿色", blue: "蓝色", amber: "琥珀", violet: "紫色", rose: "玫红" }[
											color
										]
									}
								</option>
							))}
						</select>
						<Button type="submit" disabled={pending}>
							<FolderPlus size={15} />
							添加分类
						</Button>
					</form>
					{categories.map((category) => (
						<form
							key={category.id}
							className="category-row"
							onSubmit={(event) => {
								event.preventDefault();
								const data = new FormData(event.currentTarget);
								void save(`/categories/${category.id}`, "PATCH", {
									name: data.get("name"),
									color: category.color,
								});
							}}
						>
							<span
								className={`category-dot ${category.color}`}
								style={{
									backgroundColor: category.color.startsWith("#") ? category.color : undefined,
								}}
							/>
							<Input
								name="name"
								aria-label={`分类 ${category.name}`}
								defaultValue={category.name}
								required
								maxLength={60}
							/>
							<Button type="submit" variant="ghost" size="sm" disabled={pending}>
								保存
							</Button>
							<Button
								type="button"
								variant="ghost"
								size="icon"
								aria-label={`删除分类 ${category.name}`}
								disabled={pending}
								onClick={() =>
									void remove(
										`/categories/${category.id}`,
										`分类「${category.name}」`,
										"其中的订阅源会保留并移至未分类。",
									)
								}
							>
								<Trash2 size={15} />
							</Button>
						</form>
					))}
				</div>
			)}
		</>
	);
}

function Discover({ feeds, pending, save }: { feeds: Feed[]; pending: boolean; save: Save }) {
	const directory = useQuery({
		queryKey: ["directory"],
		queryFn: () => api<DirectoryFeed[]>("/directory"),
	});
	const [search, setSearch] = useState("");
	const [visible, setVisible] = useState(36);
	const matches =
		directory.data?.filter((item) =>
			`${item.title} ${item.category} ${item.description} ${item.site_url}`
				.toLowerCase()
				.includes(search.toLowerCase()),
		) ?? [];
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
	preferences,
	stats,
	local,
	pending,
	save,
	onRefresh,
	onNotice,
	confirm,
}: {
	preferences: Preferences;
	stats?: Stats;
	local: boolean;
	pending: boolean;
	save: Save;
	onRefresh: () => Promise<void>;
	onNotice: (message: string) => void;
	confirm: ReturnType<typeof useConfirm>["confirm"];
}) {
	const [tab, setTab] = useState("reading");
	return (
		<>
			<div className="panel-tabs" role="tablist" aria-label="设置范围">
				{[
					{ id: "reading", label: "阅读" },
					{ id: "ai", label: "AI 助手" },
					{ id: "data", label: "数据管理" },
				].map((item) => (
					<button
						key={item.id}
						type="button"
						role="tab"
						aria-selected={tab === item.id}
						onClick={() => setTab(item.id)}
					>
						{item.label}
					</button>
				))}
			</div>
			{tab === "reading" && (
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
			)}
			{tab === "ai" && (
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
			)}
			{tab === "data" && (
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
			)}
		</>
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
