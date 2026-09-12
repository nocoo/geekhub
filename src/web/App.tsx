import {
	Avatar,
	AvatarFallback,
	AvatarImage,
	Badge,
	Button,
	ContentIsland,
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	Input,
	Sidebar,
	SidebarFooter,
	SidebarGroup,
	SidebarHeader,
	SidebarIconItem,
	SidebarItem,
	SidebarNav,
	SidebarPartition,
	SidebarProvider,
	SidebarSearch,
	SidebarUser,
	ThemeToggle,
	Tooltip,
	TooltipContent,
	TooltipTrigger,
	toast,
} from "@nocoo/basalt";
import { AppHeader } from "@nocoo/basalt/components/app-header";
import { AppMain, AppShell, AppSkipLink } from "@nocoo/basalt/components/app-shell";
import { useTheme } from "@nocoo/basalt/providers/theme";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	ArrowDown,
	Bookmark,
	BookOpen,
	CheckCheck,
	ChevronRight,
	Clock3,
	Compass,
	Inbox,
	LoaderCircle,
	LogOut,
	Menu,
	Plus,
	RefreshCw,
	Rss,
	Search,
	Settings2,
	SlidersHorizontal,
	Sparkles,
	Star,
	Terminal,
	X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type {
	AiAction,
	AiSettings,
	Article,
	ArticleDetail,
	ArticlePage,
	Category,
	Feed,
	FetchLog,
	Preferences,
	ReaderFilter,
	Session,
	Stats,
} from "../shared/contracts";
import { defaultPreferences } from "../shared/contracts";
import { APP_VERSION } from "../shared/version";
import { ApiError, api } from "./lib/api";
import { articleQuery, dateLabel, titleOf, translateTitles, viewLabels } from "./lib/reader";
import { Panels } from "./Panels";
import { Reader } from "./Reader";

const mobileQuery = "(max-width: 900px)";
const subscribeMobile = (callback: () => void) => {
	const media = window.matchMedia(mobileQuery);
	media.addEventListener("change", callback);
	return () => media.removeEventListener("change", callback);
};
const isMobile = () => window.matchMedia(mobileQuery).matches;
export type Panel = "add" | "manage" | "discover" | "settings" | "logs" | null;

export function App() {
	const session = useQuery({
		queryKey: ["session"],
		queryFn: ({ signal }) => api<Session>("/session", { signal }),
		retry: false,
	});
	if (session.isPending)
		return (
			<div className="welcome">
				<img src="/logo-128.png" alt="" width="64" height="64" />
				<h1>GeekHub</h1>
				<p role="status">正在打开你的阅读空间…</p>
			</div>
		);
	if (session.isError)
		return (
			<div className="welcome">
				<img src="/logo-128.png" alt="" width="72" height="72" />
				<Badge>YOUR PERSONAL READING SPACE</Badge>
				<h1>好内容，值得慢慢读。</h1>
				<p>{session.error.message}</p>
				<Button asChild>
					<a href="/">
						{session.error instanceof ApiError && session.error.status === 401
							? "通过 Cloudflare Access 登录"
							: "重新连接"}
						<ChevronRight size={16} />
					</a>
				</Button>
				<span className="muted text-xs">GeekHub · 保持好奇，持续阅读</span>
			</div>
		);
	return <ReaderApp session={session.data} />;
}

function ReaderApp({ session }: { session: Session }) {
	const client = useQueryClient();
	const mobile = useSyncExternalStore(subscribeMobile, isMobile);
	const [collapsed, setCollapsed] = useState(isMobile);
	const [filter, setFilter] = useState<ReaderFilter>({ view: "all", search: "" });
	const [search, setSearch] = useState("");
	const [searchOpen, setSearchOpen] = useState(false);
	const [selected, setSelected] = useState<string | null>(() =>
		new URLSearchParams(location.search).get("article"),
	);
	const [panel, setPanel] = useState<Panel>(null);
	const setNotice = useCallback((message: string) => {
		toast(message, { duration: 8000 });
	}, []);
	const [translation, setTranslation] = useState(false);
	const attempted = useRef(new Set<string>());
	const { setTheme } = useTheme();
	const feeds = useQuery({
		queryKey: ["feeds"],
		queryFn: ({ signal }) => api<Feed[]>("/feeds", { signal }),
		refetchInterval: (query) =>
			query.state.data?.some((f) => f.status === "queued" || f.status === "fetching")
				? 1500
				: 60_000,
	});
	const categories = useQuery({
		queryKey: ["categories"],
		queryFn: () => api<Category[]>("/categories"),
	});
	const stats = useQuery({ queryKey: ["stats"], queryFn: () => api<Stats>("/stats") });
	const preferences = useQuery({
		queryKey: ["preferences"],
		queryFn: () => api<Preferences>("/settings"),
	});
	const ai = useQuery({ queryKey: ["ai"], queryFn: () => api<AiSettings>("/ai/settings") });
	const logs = useQuery({
		queryKey: ["logs"],
		queryFn: () => api<FetchLog[]>("/logs"),
		refetchInterval: feeds.data?.some((f) => f.status === "queued" || f.status === "fetching")
			? 1500
			: false,
	});
	const pages = useInfiniteQuery({
		queryKey: ["articles", filter],
		queryFn: ({ pageParam, signal }) =>
			api<ArticlePage>(articleQuery(filter, pageParam), { signal }),
		initialPageParam: undefined as string | undefined,
		getNextPageParam: (last) => last.nextCursor ?? undefined,
	});
	const detail = useQuery({
		queryKey: ["article", selected],
		queryFn: ({ signal }) => api<ArticleDetail>(`/articles/${selected}`, { signal }),
		enabled: Boolean(selected),
	});
	const articles = pages.data?.pages.flatMap((page) => page.articles) ?? [];
	const pref = preferences.data ?? defaultPreferences;
	const currentFeed = feeds.data?.find((feed) => feed.id === filter.feedId);
	const currentCategory = categories.data?.find((category) => category.id === filter.categoryId);
	const heading = currentFeed?.title ?? currentCategory?.name ?? viewLabels[filter.view];
	const busy = feeds.data?.some((f) => f.status === "queued" || f.status === "fetching") ?? false;
	const latestActivity = logs.data?.[0];
	const activityMessage = latestActivity
		? `${latestActivity.feed_title} · ${latestActivity.message}`
		: "等待第一次同步";

	const refresh = async () => {
		await Promise.all(
			["feeds", "categories", "articles", "stats", "logs", "preferences", "ai"].map((key) =>
				client.invalidateQueries({ queryKey: [key] }),
			),
		);
	};
	const write = useMutation({
		mutationFn: ({ path, method, body }: { path: string; method: string; body?: unknown }) =>
			api(path, { method, body }),
		onSuccess: refresh,
		onError: (error) => setNotice(error.message),
	});
	const articleWrite = useMutation({
		mutationFn: ({ id, body }: { id: string; body: Record<string, boolean> }) =>
			api<ArticleDetail>(`/articles/${id}`, { method: "PATCH", body }),
		onSuccess: async (article) => {
			client.setQueryData(["article", article.id], article);
			await refresh();
		},
		onError: (error) => setNotice(error.message),
	});
	const action = useMutation({
		mutationFn: ({ id, kind }: { id: string; kind: AiAction | "full" }) =>
			api<ArticleDetail>(`/articles/${id}/${kind === "full" ? "full" : "ai"}`, {
				method: "POST",
				...(kind === "full" ? {} : { body: { action: kind } }),
			}),
		onSuccess: async (article, variables) => {
			client.setQueryData(["article", article.id], article);
			if (variables.kind === "translate") setTranslation(true);
			await client.invalidateQueries({ queryKey: ["articles"] });
		},
		onError: (error) => setNotice(error.message),
	});

	function choose(next: ReaderFilter) {
		setFilter(next);
		setSearch(next.search);
		setSelected(null);
		history.replaceState(null, "", "/");
		if (mobile) setCollapsed(true);
	}
	function open(article: Article) {
		setSelected(article.id);
		setTranslation(false);
		history.replaceState(null, "", `/?article=${encodeURIComponent(article.id)}`);
		if (!article.is_read) articleWrite.mutate({ id: article.id, body: { is_read: true } });
	}
	const back = useCallback(() => {
		setSelected(null);
		history.replaceState(null, "", "/");
	}, []);

	useEffect(() => {
		setCollapsed(mobile);
	}, [mobile]);
	useEffect(() => {
		if (preferences.data) setTheme(preferences.data.theme);
	}, [preferences.data, setTheme]);
	const fetchedStamp = feeds.data?.map((feed) => feed.last_fetched_at).join(",");
	useEffect(() => {
		if (!fetchedStamp) return;
		void Promise.all(
			["articles", "stats", "logs"].map((key) => client.invalidateQueries({ queryKey: [key] })),
		);
	}, [fetchedStamp, client]);
	useEffect(() => {
		const listener = (event: KeyboardEvent) => {
			if (
				event.target instanceof HTMLElement &&
				(event.target.matches("input,textarea,select") || event.target.isContentEditable)
			)
				return;
			if (event.key === "/" && !panel && !searchOpen) {
				event.preventDefault();
				setSearchOpen(true);
			}
			if (event.key === "Escape" && !panel && !searchOpen) back();
		};
		window.addEventListener("keydown", listener);
		return () => window.removeEventListener("keydown", listener);
	}, [panel, searchOpen, back]);
	useEffect(() => {
		if (!pages.data || !ai.data || (!ai.data.hasApiKey && !ai.data.mock)) return;
		let active = true;
		void translateTitles(
			pages.data.pages.flatMap((page) => page.articles),
			attempted.current,
			() => active,
			async (article) => {
				client.setQueryData(["article", article.id], article);
				await client.invalidateQueries({ queryKey: ["articles"] });
			},
		);
		return () => {
			active = false;
		};
	}, [pages.data, ai.data, client]);

	const SidebarViewItem = collapsed ? SidebarIconItem : SidebarItem;
	const avatar = (
		<Avatar>
			<AvatarImage
				src={
					session.user.avatarUrl
						? `/api/images?${new URLSearchParams({ url: session.user.avatarUrl })}`
						: undefined
				}
				alt={`${session.user.name} 的头像`}
			/>
			<AvatarFallback>{session.user.name.slice(0, 1).toUpperCase()}</AvatarFallback>
		</Avatar>
	);

	return (
		<SidebarProvider
			collapsed={collapsed}
			onCollapsedChange={setCollapsed}
			overlay={mobile}
			defaultWidth={224}
		>
			<AppShell className="geekhub-shell">
				<AppSkipLink>跳到阅读内容</AppSkipLink>
				<Sidebar aria-label="订阅导航" className="reader-sidebar">
					<SidebarHeader className={collapsed ? "justify-center px-0" : undefined}>
						<div className="brand">
							<img src="/logo-64.png" width="36" height="36" alt="" />
							{!collapsed && (
								<>
									<span>GeekHub</span>
									<Badge className="version">v{APP_VERSION}</Badge>
								</>
							)}
						</div>
					</SidebarHeader>
					<div className="px-3 pb-1">
						{collapsed ? (
							<Tooltip>
								<TooltipTrigger asChild>
									<SidebarIconItem
										className="mx-auto"
										aria-label="搜索文章"
										aria-keyshortcuts="/"
										aria-haspopup="dialog"
										onClick={() => setSearchOpen(true)}
									>
										<Search size={16} aria-hidden="true" />
									</SidebarIconItem>
								</TooltipTrigger>
								<TooltipContent side="right">搜索文章 /</TooltipContent>
							</Tooltip>
						) : (
							<SidebarSearch
								shortcut="/"
								aria-label="搜索文章"
								aria-keyshortcuts="/"
								aria-haspopup="dialog"
								onClick={() => setSearchOpen(true)}
							>
								搜索文章
							</SidebarSearch>
						)}
					</div>
					<SidebarNav className="pt-1">
						{!collapsed && <SidebarPartition>你的阅读空间</SidebarPartition>}
						<div className="flex flex-col gap-0.5 px-3">
							{(
								[
									{ view: "all", label: "全部文章", icon: Inbox, count: stats.data?.articles },
									{ view: "unread", label: "未读文章", icon: BookOpen, count: stats.data?.unread },
									{ view: "starred", label: "我的收藏", icon: Star, count: stats.data?.starred },
									{ view: "later", label: "稍后阅读", icon: Bookmark, count: stats.data?.later },
								] as const
							).map((item) => (
								<Tooltip key={item.view}>
									<TooltipTrigger asChild>
										<SidebarViewItem
											className={collapsed ? "self-center" : undefined}
											aria-label={item.label}
											active={filter.view === item.view && !filter.feedId && !filter.categoryId}
											onClick={() => choose({ view: item.view, search: "" })}
										>
											<item.icon size={17} aria-hidden="true" />
											{!collapsed && (
												<>
													<span>{item.label}</span>
													<span className="nav-count">{item.count ?? "—"}</span>
												</>
											)}
										</SidebarViewItem>
									</TooltipTrigger>
									{collapsed && <TooltipContent side="right">{item.label}</TooltipContent>}
								</Tooltip>
							))}
						</div>
						{!collapsed && (
							<>
								<div className="rail-section">
									<span>订阅源</span>
									<Button
										variant="ghost"
										size="icon"
										aria-label="添加订阅"
										onClick={() => setPanel("add")}
									>
										<Plus size={15} />
									</Button>
								</div>
								{categories.data?.map((category) => (
									<SidebarGroup
										key={category.id}
										label={
											<span className="category-name">
												<span
													className={`category-dot ${category.color}`}
													style={{
														backgroundColor: category.color.startsWith("#")
															? category.color
															: undefined,
													}}
												/>
												{category.icon && <span aria-hidden="true">{category.icon}</span>}
												{category.name}
											</span>
										}
									>
										<SidebarItem
											className="category-filter"
											active={filter.categoryId === category.id}
											onClick={() => choose({ view: "all", categoryId: category.id, search: "" })}
										>
											查看分类全部
										</SidebarItem>
										{feeds.data
											?.filter((f) => f.category_id === category.id)
											.map((feed) => (
												<FeedItem
													key={feed.id}
													feed={feed}
													active={filter.feedId === feed.id}
													onClick={() => choose({ view: "all", feedId: feed.id, search: "" })}
												/>
											))}
									</SidebarGroup>
								))}
								{feeds.data
									?.filter((feed) => !feed.category_id)
									.map((feed) => (
										<FeedItem
											key={feed.id}
											feed={feed}
											active={filter.feedId === feed.id}
											onClick={() => choose({ view: "all", feedId: feed.id, search: "" })}
										/>
									))}
								{feeds.isError && <p className="inline-error">{feeds.error.message}</p>}
							</>
						)}
						<Tooltip>
							<TooltipTrigger asChild>
								<SidebarViewItem
									className={`discover-nav ${collapsed ? "self-center" : "mx-3 w-auto"}`}
									aria-label="发现好内容"
									onClick={() => setPanel("discover")}
								>
									<Compass size={17} aria-hidden="true" />
									{!collapsed && (
										<>
											<span>发现好内容</span>
											<ChevronRight size={14} className="ml-auto" />
										</>
									)}
								</SidebarViewItem>
							</TooltipTrigger>
							{collapsed && <TooltipContent side="right">发现好内容</TooltipContent>}
						</Tooltip>
					</SidebarNav>
					<SidebarFooter className={collapsed ? "flex flex-col items-center px-0" : undefined}>
						<div className={collapsed ? "flex flex-col items-center gap-1 pb-2" : "rail-tools"}>
							<Button
								variant="ghost"
								size={collapsed ? "icon" : "sm"}
								aria-label="管理订阅"
								title="管理订阅"
								onClick={() => setPanel("manage")}
							>
								<SlidersHorizontal size={15} />
								{!collapsed && "管理订阅"}
							</Button>
							<Button
								variant="ghost"
								size="icon"
								aria-label="设置"
								title="设置"
								onClick={() => setPanel("settings")}
							>
								<Settings2 size={17} />
							</Button>
						</div>
						{collapsed ? (
							<Tooltip>
								<TooltipTrigger asChild>
									<span>{avatar}</span>
								</TooltipTrigger>
								<TooltipContent side="right">{session.user.name}</TooltipContent>
							</Tooltip>
						) : (
							<SidebarUser
								name={session.user.name}
								email={session.local ? "本地阅读空间" : session.user.email}
								avatar={avatar}
								action={
									!session.local ? (
										<a href="/cdn-cgi/access/logout" aria-label="退出登录">
											<LogOut size={15} />
										</a>
									) : undefined
								}
							/>
						)}
					</SidebarFooter>
				</Sidebar>
				<Dialog open={searchOpen} onOpenChange={setSearchOpen}>
					<DialogContent size="base" className="search-dialog grid gap-4">
						<DialogHeader>
							<DialogTitle>搜索文章</DialogTitle>
							<DialogDescription>搜索「{heading}」中的文章。</DialogDescription>
						</DialogHeader>
						<form
							className="flex items-center gap-2"
							onSubmit={(event) => {
								event.preventDefault();
								setSearchOpen(false);
								choose({ ...filter, search: search.trim() });
							}}
						>
							<Input
								aria-label="搜索文章"
								placeholder="输入关键词，按回车搜索"
								value={search}
								onChange={(event) => setSearch(event.target.value)}
							/>
							<Button type="submit" size="icon" aria-label="执行搜索" title="搜索">
								<Search size={16} aria-hidden="true" />
							</Button>
						</form>
						<DialogClose asChild>
							<Button
								variant="ghost"
								size="icon"
								className="absolute right-2 top-2 h-8 w-8"
								aria-label="关闭搜索"
							>
								<X size={14} aria-hidden="true" />
							</Button>
						</DialogClose>
					</DialogContent>
				</Dialog>
				<AppMain>
					<AppHeader
						className="reader-header"
						leading={
							<Button
								variant="ghost"
								size="icon"
								aria-label="切换订阅导航"
								onClick={() => setCollapsed(!collapsed)}
							>
								<Menu size={18} />
							</Button>
						}
						breadcrumbs={mobile ? undefined : [{ label: "阅读" }]}
						title={heading}
						actions={
							<>
								<Button
									variant="ghost"
									size="sm"
									className="feed-activity"
									aria-label="查看订阅加载详情"
									aria-haspopup="dialog"
									aria-expanded={panel === "logs"}
									title={activityMessage}
									data-level={busy ? "info" : latestActivity?.level}
									onClick={() => setPanel("logs")}
								>
									<Terminal size={13} aria-hidden="true" />
									<span className="activity-label">ACTIVITY</span>
									<span className={`status-led ${busy ? "pulsing" : ""}`} />
									<span className="activity-message">
										{busy ? `同步中 · ${activityMessage}` : activityMessage}
									</span>
									<ChevronRight size={12} aria-hidden="true" />
								</Button>
								<ThemeToggle aria-label="切换主题" />
								<Button
									variant="ghost"
									size="icon"
									aria-label="刷新订阅"
									disabled={write.isPending || busy}
									onClick={() =>
										write.mutate({
											path: currentFeed ? `/feeds/${currentFeed.id}/refresh` : "/refresh",
											method: "POST",
										})
									}
								>
									<RefreshCw size={16} className={busy ? "spinning" : ""} />
								</Button>
							</>
						}
					/>
					<div className="island-wrap">
						<ContentIsland className={`reading-island ${selected ? "has-selection" : ""}`}>
							<section className="article-list" aria-label="文章列表">
								<div className="list-heading">
									<div className="list-title">
										<h2 title={currentFeed?.description || heading}>{heading}</h2>
										<Tooltip>
											<TooltipTrigger asChild>
												<Button
													variant="ghost"
													size="icon"
													className="h-8 w-8"
													aria-label="全部标为已读"
													disabled={!articles.length || write.isPending}
													onClick={() =>
														write.mutate({
															path: "/read-all",
															method: "POST",
															body: { feedId: filter.feedId, categoryId: filter.categoryId },
														})
													}
												>
													<CheckCheck size={16} aria-hidden="true" />
												</Button>
											</TooltipTrigger>
											<TooltipContent>全部标为已读</TooltipContent>
										</Tooltip>
									</div>
									<div className="list-meta">
										<span className="list-context">
											{filter.search ? (
												<Search size={12} aria-hidden="true" />
											) : (
												<Clock3 size={12} aria-hidden="true" />
											)}
											<span title={filter.search ? `搜索「${filter.search}」` : undefined}>
												{filter.search ? `搜索「${filter.search}」` : "最近更新"}
											</span>
											{filter.search && (
												<Button
													variant="ghost"
													size="icon"
													className="h-6 w-6"
													aria-label="清除搜索"
													title="清除搜索"
													onClick={() => {
														setSearch("");
														setFilter({ ...filter, search: "" });
													}}
												>
													<X size={12} aria-hidden="true" />
												</Button>
											)}
										</span>
										<span className="list-count">
											{articles.length} 篇{pages.hasNextPage ? "+" : ""}
										</span>
									</div>
								</div>
								<div className="article-scroll">
									{pages.isPending ? (
										<div className="empty-state" role="status">
											<LoaderCircle className="spinning" size={22} />
											正在读取文章…
										</div>
									) : pages.isError ? (
										<div className="empty-state" role="alert">
											<p>{pages.error.message}</p>
											<Button onClick={() => void pages.refetch()}>重试</Button>
										</div>
									) : !articles.length ? (
										<div className="empty-state">
											<BookOpen size={28} />
											<h3>{filter.search ? "还没有找到这篇文章" : "给好内容留一个位置"}</h3>
											<p>
												{filter.search
													? "试试其他关键词。"
													: filter.view === "all"
														? "添加一个订阅源，开始今天的阅读。"
														: "这里暂时没有文章，去其他分类看看。"}
											</p>
											{filter.view === "all" && !filter.search && (
												<Button size="sm" onClick={() => setPanel("add")}>
													<Plus size={15} />
													添加订阅
												</Button>
											)}
										</div>
									) : (
										articles.map((article) => (
											<button
												type="button"
												className={`article-item ${selected === article.id ? "selected" : ""} ${article.is_read ? "is-read" : ""}`}
												key={article.id}
												onClick={() => open(article)}
												aria-current={selected === article.id ? "true" : undefined}
												data-testid="article-item"
											>
												<div className="article-item-meta">
													<span>
														<span className="feed-letter">{article.feed_title.slice(0, 1)}</span>
														{article.feed_title}
													</span>
													<time dateTime={article.published_at}>
														{dateLabel(article.published_at)}
													</time>
												</div>
												<h3>
													{!article.is_read && <span className="unread-dot" />}
													{titleOf(article)}
												</h3>
												<p>{article.translated_description || article.description}</p>
												<div className="article-item-foot">
													<span>
														{article.translated_title ? (
															<>
																<Sparkles size={11} /> AI 译文
															</>
														) : (
															"阅读全文"
														)}
													</span>
													<span>
														{Boolean(article.is_starred) && <Star size={12} className="starred" />}
														{Boolean(article.is_later) && <Bookmark size={12} />}
														<ChevronRight size={12} />
													</span>
												</div>
											</button>
										))
									)}
									{pages.hasNextPage && (
										<Button
											className="load-more"
											variant="ghost"
											onClick={() => void pages.fetchNextPage()}
											disabled={pages.isFetchingNextPage}
										>
											<ArrowDown size={14} />
											{pages.isFetchingNextPage ? "正在读取…" : "加载更多文章"}
										</Button>
									)}
								</div>
							</section>
							<Reader
								article={detail.data}
								loading={Boolean(selected) && detail.isPending}
								error={detail.error?.message}
								selected={Boolean(selected)}
								preferences={pref}
								translation={translation}
								onTranslation={setTranslation}
								onBack={back}
								onDiscover={() => setPanel("discover")}
								onStatus={(body) => {
									if (selected) articleWrite.mutate({ id: selected, body });
								}}
								onAction={(kind) => {
									if (selected) action.mutate({ id: selected, kind });
								}}
								statusBusy={articleWrite.isPending}
								actionBusy={action.isPending ? action.variables.kind : null}
							/>
						</ContentIsland>
					</div>
					<footer className="app-footer">
						<span>GOOD WORDS. FRESH IDEAS.</span>
						<span>
							保持好奇，持续阅读 <span className="footer-spark">✳</span>
						</span>
					</footer>
				</AppMain>
				<Panels
					panel={panel}
					onClose={() => setPanel(null)}
					feeds={feeds.data ?? []}
					categories={categories.data ?? []}
					preferences={pref}
					stats={stats.data}
					logs={logs.data ?? []}
					local={session.local}
					onRefresh={refresh}
					onNotice={setNotice}
				/>
			</AppShell>
		</SidebarProvider>
	);
}

function FeedItem({ feed, active, onClick }: { feed: Feed; active: boolean; onClick: () => void }) {
	return (
		<SidebarItem active={active} onClick={onClick} title={feed.last_error ?? feed.title}>
			<Rss size={14} className={feed.status === "error" ? "error-color" : "muted"} />
			<span className="truncate">{feed.title}</span>
			<span className="nav-count">
				{feed.status === "fetching" || feed.status === "queued" ? (
					<LoaderCircle size={12} className="spinning" />
				) : (
					feed.unread_count || ""
				)}
			</span>
		</SidebarItem>
	);
}
