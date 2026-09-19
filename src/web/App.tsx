import {
	Avatar,
	AvatarFallback,
	AvatarImage,
	Badge,
	Button,
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
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
	SidebarHeader,
	SidebarIconItem,
	SidebarItem,
	SidebarNav,
	SidebarPartition,
	SidebarProvider,
	SidebarSearch,
	SidebarUser,
	Tooltip,
	TooltipContent,
	TooltipTrigger,
	toast,
} from "@nocoo/basalt";
import { AppHeader } from "@nocoo/basalt/components/app-header";
import { AppMain, AppShell, AppSkipLink } from "@nocoo/basalt/components/app-shell";
import {
	ContextMenu,
	ContextMenuItem,
	ContextMenuPanel,
	ContextMenuTrigger,
} from "@nocoo/basalt/components/context-menu";
import { useTheme } from "@nocoo/basalt/providers/theme";
import { useQuery } from "@tanstack/react-query";
import {
	Activity,
	ArrowDown,
	ArrowUpRight,
	Bookmark,
	BookOpen,
	Bug,
	CheckCheck,
	ChevronRight,
	CircleAlert,
	Clock3,
	Compass,
	Inbox,
	Info,
	LoaderCircle,
	LogOut,
	Menu,
	Pencil,
	Plus,
	RefreshCw,
	Rss,
	Search,
	Settings,
	Sparkles,
	Star,
	Trash2,
	X,
} from "lucide-react";
import {
	useCallback,
	useEffect,
	useEffectEvent,
	useLayoutEffect,
	useRef,
	useState,
	useSyncExternalStore,
} from "react";
import type { Category, Feed, ReaderFilter, Session } from "../shared/contracts";
import { APP_VERSION } from "../shared/version";
import { HeaderTooltip, HexlyLink } from "./header-links";
import { ApiError, api } from "./lib/api";
import type { Panel } from "./lib/panels-view-model";
import {
	dateLabel,
	emptyReaderState,
	readerShortcut,
	runningActivities,
	titleOf,
} from "./lib/reader";
import { useReadingPosition } from "./lib/reader-position";
import { useReaderViewModel } from "./lib/reader-view-model";
import { Panels } from "./Panels";
import { Reader } from "./Reader";
import { ThemeToggle } from "./theme-toggle";

const mobileQuery = "(max-width: 900px)";
const subscribeMobile = (callback: () => void) => {
	const media = window.matchMedia(mobileQuery);
	media.addEventListener("change", callback);
	return () => media.removeEventListener("change", callback);
};
const isMobile = () => window.matchMedia(mobileQuery).matches;

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
					<a href={location.pathname + location.search}>
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
	const mobile = useSyncExternalStore(subscribeMobile, isMobile);
	const [collapsed, setCollapsed] = useState(isMobile);
	const [search, setSearch] = useState("");
	const [searchOpen, setSearchOpen] = useState(false);
	const [panel, setPanel] = useState<Panel>(null);
	const [settingsTab, setSettingsTab] = useState("feeds");
	const [selectedFeedId, setSelectedFeedId] = useState<string | null>(null);
	const setNotice = useCallback((message: string) => {
		toast(message, { duration: 5000, icon: <Info size={18} aria-hidden="true" /> });
	}, []);
	const vm = useReaderViewModel(setNotice);
	const {
		feeds,
		categories,
		stats,
		preferences: pref,
		logs,
		pages,
		detail,
		articles,
		filter,
		visit,
		selected,
		translation,
		setTranslation,
		currentFeed,
		heading,
		busy,
		open,
		back,
		articleWrite,
		action,
	} = vm;
	const { setTheme } = useTheme();
	const running = runningActivities(logs.data ?? [], logs.dataUpdatedAt);
	const activityBusy = busy || running.length > 0;
	const latestActivity = running[0] ?? logs.data?.[0];
	const activityMessage = latestActivity
		? `${latestActivity.feed_title} · ${latestActivity.message}`
		: "等待第一次同步";
	const scopeFeeds = feeds.data?.filter(
		(feed) =>
			(!filter.feedId || feed.id === filter.feedId) &&
			(!filter.categoryId || feed.category_id === filter.categoryId),
	);
	const empty = emptyReaderState(filter, scopeFeeds ?? []);
	const total = scopeFeeds?.reduce((sum, feed) => sum + feed.total_count, 0);
	const unread = scopeFeeds?.reduce((sum, feed) => sum + feed.unread_count, 0);
	const readPercent = total ? Math.round(((total - (unread ?? 0)) / total) * 100) : 0;
	const syncing =
		scopeFeeds?.filter((feed) => feed.status === "queued" || feed.status === "fetching").length ??
		0;
	const failed = scopeFeeds?.filter((feed) => feed.status === "error").length ?? 0;
	const lastFetched = scopeFeeds
		?.flatMap((feed) => (feed.last_fetched_at ? [feed.last_fetched_at] : []))
		.sort()
		.at(-1);
	const syncLabel = syncing
		? currentFeed
			? "正在同步"
			: `${syncing} 个源同步中`
		: failed
			? currentFeed
				? "同步失败"
				: `${failed} 个源异常`
			: lastFetched
				? `${dateLabel(lastFetched)}同步`
				: "尚未同步";
	const list = useRef<HTMLDivElement>(null);
	useReadingPosition(
		list,
		`list:${visit}`,
		Boolean(pages.data) && !vm.restoringPages && (!mobile || !selected),
	);
	const anchor = useRef<{ visit: string; positions: { id: string; offset: number }[] } | null>(
		null,
	);
	const keyboardNavigation = useRef(false);
	function choose(next: ReaderFilter) {
		keyboardNavigation.current = false;
		anchor.current = null;
		vm.choose(next);
		setSearch(next.search);
		if (mobile) setCollapsed(true);
	}
	function diagnose(feed: Feed) {
		setSelectedFeedId(feed.id);
		setPanel("diagnose");
	}
	function manageFeed(feed: Feed, action: "edit-feed" | "delete-feed") {
		setSelectedFeedId(feed.id);
		setPanel(action);
	}
	useLayoutEffect(() => {
		const element = list.current;
		if (!element?.clientHeight || vm.restoringPages || (mobile && selected) || !articles.length)
			return;
		const rows = Array.from(element.querySelectorAll<HTMLElement>("[data-article-id]"));
		if (anchor.current?.visit === visit) {
			for (const position of anchor.current.positions) {
				const row = rows.find((row) => row.dataset.articleId === position.id);
				if (!row) continue;
				const shift =
					row.getBoundingClientRect().top - element.getBoundingClientRect().top - position.offset;
				// Writing even the same scrollTop cancels an ongoing native smooth scroll.
				if (Math.abs(shift) > 1) element.scrollTop += shift;
				break;
			}
		}
		const remember = () => {
			if (!element.clientHeight) return;
			const bounds = element.getBoundingClientRect();
			anchor.current = {
				visit,
				positions: rows.flatMap((row) => {
					const rect = row.getBoundingClientRect();
					return rect.bottom > bounds.top && rect.top < bounds.bottom
						? [{ id: row.dataset.articleId ?? "", offset: rect.top - bounds.top }]
						: [];
				}),
			};
		};
		remember();
		element.addEventListener("scroll", remember, { passive: true });
		return () => element.removeEventListener("scroll", remember);
	}, [articles, visit, mobile, selected, vm.restoringPages]);
	useLayoutEffect(() => {
		const element = list.current;
		if (
			selected &&
			element?.clientHeight &&
			(keyboardNavigation.current || document.activeElement?.matches(".article-item"))
		) {
			const row = element.querySelector<HTMLElement>("[aria-current='true']");
			row?.focus({ preventScroll: true });
			if (row && keyboardNavigation.current) {
				const bounds = row.getBoundingClientRect();
				// Keep 61.8% of the list below the selected row's center for reading ahead.
				const top =
					element.scrollTop +
					bounds.top -
					element.getBoundingClientRect().top +
					bounds.height / 2 -
					element.clientHeight * 0.382;
				element.scrollTo({
					top: Math.max(0, Math.min(top, element.scrollHeight - element.clientHeight)),
					behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
						? "instant"
						: "smooth",
				});
			} else row?.scrollIntoView({ block: "nearest" });
		}
		keyboardNavigation.current = false;
	}, [selected]);
	useEffect(() => {
		setCollapsed(mobile);
	}, [mobile]);
	useEffect(() => {
		if (vm.preferencesLoaded) setTheme(pref.theme);
	}, [pref.theme, vm.preferencesLoaded, setTheme]);
	useEffect(() => {
		document.title = `${detail.data ? `${titleOf(detail.data)} · ` : ""}${heading} · GeekHub`;
	}, [detail.data, heading]);
	const onKey = useEffectEvent((event: KeyboardEvent) => {
		const command = readerShortcut(event, Boolean(panel) || searchOpen || (mobile && !collapsed));
		if (!command) return;
		event.preventDefault();
		if (command === "search") {
			setSearch(filter.search);
			setSearchOpen(true);
		} else if (command === "back") back();
		else if (command === "next" || command === "previous") {
			keyboardNavigation.current = true;
			void vm.move(command === "next" ? 1 : -1);
		} else if (command === "refresh") {
			if (!busy && !vm.refresh.isPending) vm.refresh.mutate();
		} else if (detail.data && selected) {
			if (command === "original") window.open(detail.data.url, "_blank", "noopener,noreferrer");
			else if (!vm.statusBusy) {
				const field = { read: "is_read", star: "is_starred", later: "is_later" }[command] as
					| "is_read"
					| "is_starred"
					| "is_later";
				articleWrite.mutate({ id: selected, body: { [field]: !detail.data[field] } });
			}
		}
	});
	useEffect(() => {
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, []);

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
					<SidebarHeader
						className={`reader-sidebar-header ${collapsed ? "justify-center px-0" : ""}`}
					>
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
									{
										view: "all",
										label: "全部文章",
										icon: Inbox,
										tone: "info",
										count: stats.data?.articles,
									},
									{
										view: "unread",
										label: "未读文章",
										icon: BookOpen,
										tone: "reading",
										count: stats.data?.unread,
									},
									{
										view: "starred",
										label: "我的收藏",
										icon: Star,
										tone: "save",
										count: stats.data?.starred,
									},
									{
										view: "later",
										label: "稍后阅读",
										icon: Bookmark,
										tone: "later",
										count: stats.data?.later,
									},
								] as const
							).map((item) => (
								<Tooltip key={item.view}>
									<TooltipTrigger asChild>
										<SidebarViewItem
											className={`sidebar-view-link ${collapsed ? "self-center" : ""}`}
											aria-label={item.label}
											active={filter.view === item.view && !filter.feedId && !filter.categoryId}
											onClick={() => choose({ view: item.view, search: "" })}
										>
											<item.icon size={17} className={`icon-${item.tone}`} aria-hidden="true" />
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
									<CategoryGroup
										key={category.id}
										category={category}
										feeds={feeds.data?.filter((feed) => feed.category_id === category.id) ?? []}
										filter={filter}
										onChoose={choose}
										onManage={manageFeed}
									/>
								))}
								<div className="flex flex-col gap-0.5 px-3">
									{feeds.data
										?.filter((feed) => !feed.category_id)
										.map((feed) => (
											<FeedItem
												key={feed.id}
												feed={feed}
												active={filter.feedId === feed.id}
												onClick={() => choose({ view: "all", feedId: feed.id, search: "" })}
												onManage={manageFeed}
											/>
										))}
								</div>
								{feeds.isError && <p className="inline-error">{feeds.error.message}</p>}
							</>
						)}
						<Tooltip>
							<TooltipTrigger asChild>
								<SidebarViewItem
									className={`sidebar-view-link discover-nav ${collapsed ? "self-center" : "mx-3 w-auto"}`}
									aria-label="发现好内容"
									onClick={() => setPanel("discover")}
								>
									<Compass size={17} className="icon-discover" aria-hidden="true" />
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
					<DialogContent size="base" className="search-dialog grid gap-3">
						<DialogHeader className="gap-1 space-y-0">
							<DialogTitle className="leading-7">搜索文章</DialogTitle>
							<DialogDescription className="leading-5">
								搜索「{heading}」中的文章。
							</DialogDescription>
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
								maxLength={200}
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
							<HeaderTooltip label="切换订阅导航">
								<Button
									variant="ghost"
									size="icon"
									aria-label="切换订阅导航"
									onClick={() => setCollapsed(!collapsed)}
								>
									<Menu size={18} />
								</Button>
							</HeaderTooltip>
						}
						breadcrumbs={mobile ? undefined : [{ label: "阅读" }]}
						title={heading}
						actions={
							<>
								<HeaderTooltip label={`后台活动 · ${activityMessage}`}>
									<Button
										variant="ghost"
										size="sm"
										className="feed-activity"
										aria-label="查看后台活动详情"
										aria-haspopup="dialog"
										aria-expanded={panel === "logs"}
										data-level={activityBusy ? "info" : latestActivity?.level}
										onClick={() => setPanel("logs")}
									>
										<Activity size={14} className="icon-reading" aria-hidden="true" />
										<span className="activity-label">ACTIVITY</span>
										<span className={`status-led ${activityBusy ? "pulsing" : ""}`} />
										<span className="activity-message">
											{activityBusy ? `进行中 · ${activityMessage}` : activityMessage}
										</span>
										<ChevronRight size={12} aria-hidden="true" />
									</Button>
								</HeaderTooltip>
								<HeaderTooltip
									label={vm.refresh.isPending || busy ? "正在同步订阅" : "刷新订阅 (R)"}
								>
									<span className="inline-flex">
										<Button
											variant="ghost"
											size="icon"
											aria-label="刷新订阅"
											disabled={vm.refresh.isPending || busy}
											onClick={() => vm.refresh.mutate()}
											aria-keyshortcuts="r"
										>
											<RefreshCw size={16} className={`icon-reading ${busy ? "spinning" : ""}`} />
										</Button>
									</span>
								</HeaderTooltip>
								<HeaderTooltip label="GitHub 项目">
									<Button variant="ghost" size="icon" asChild>
										<a
											href="https://github.com/nocoo/geekhub"
											target="_blank"
											rel="noopener noreferrer"
											aria-label="GeekHub GitHub 项目"
										>
											<svg
												width="17"
												height="17"
												viewBox="0 0 24 24"
												fill="currentColor"
												aria-hidden="true"
											>
												<path d="M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2.2c-3.3.7-4-1.4-4-1.4-.5-1.4-1.3-1.7-1.3-1.7-1.1-.8.1-.8.1-.8 1.2.1 1.8 1.2 1.8 1.2 1.1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.8-1.6-2.7-.3-5.5-1.3-5.5-6a4.7 4.7 0 0 1 1.2-3.2 4.3 4.3 0 0 1 .1-3.2s1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0c2.3-1.5 3.3-1.2 3.3-1.2a4.3 4.3 0 0 1 .1 3.2 4.7 4.7 0 0 1 1.2 3.2c0 4.7-2.8 5.7-5.5 6 .4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 12 .3Z" />
											</svg>
											<span className="sr-only">GeekHub GitHub 项目</span>
										</a>
									</Button>
								</HeaderTooltip>
								<HexlyLink />
								<ThemeToggle aria-label="切换主题" />
								<HeaderTooltip label="设置">
									<Button
										variant="ghost"
										size="icon"
										aria-label="设置"
										aria-haspopup="dialog"
										onClick={() => setPanel("settings")}
									>
										<Settings size={17} className="icon-info" aria-hidden="true" />
									</Button>
								</HeaderTooltip>
							</>
						}
					/>
					<div className="island-wrap">
						<ContentIsland className={`reading-island ${selected ? "has-selection" : ""}`}>
							<section className="article-list" aria-label="文章列表">
								<div className="list-heading">
									<div className="list-title">
										<h2
											title={
												currentFeed?.description
													? `${heading} · ${currentFeed.description}`
													: heading
											}
										>
											{heading}
										</h2>
										{currentFeed?.site_url && (
											<HeaderTooltip label="打开订阅网站">
												<Button variant="ghost" size="icon" className="list-icon-button" asChild>
													<a
														href={currentFeed.site_url}
														target="_blank"
														rel="noopener noreferrer"
														aria-label="打开订阅网站"
													>
														<ArrowUpRight size={14} className="icon-feed" aria-hidden="true" />
														<span className="sr-only">打开订阅网站</span>
													</a>
												</Button>
											</HeaderTooltip>
										)}
										<HeaderTooltip
											label={
												currentFeed ? "订阅设置 · 名称、分类与翻译" : "阅读器设置 · 订阅、阅读与 AI"
											}
										>
											<Button
												variant="ghost"
												size="icon"
												className="list-icon-button"
												aria-label={currentFeed ? "订阅设置" : "阅读器设置"}
												aria-haspopup="dialog"
												onClick={() =>
													currentFeed ? manageFeed(currentFeed, "edit-feed") : setPanel("settings")
												}
											>
												<Settings size={15} className="icon-info" aria-hidden="true" />
											</Button>
										</HeaderTooltip>
									</div>
									<fieldset
										className="list-stats"
										aria-label="当前订阅范围统计"
										title="统计当前订阅范围的全部文章，不受搜索或阅读状态筛选影响"
									>
										<button
											type="button"
											className="list-stat"
											aria-label="查看范围内全部文章"
											aria-pressed={filter.view === "all"}
											onClick={() => choose({ ...filter, view: "all" })}
										>
											<Inbox size={12} className="icon-info" aria-hidden="true" />
											<span>文章</span>
											<strong>{total?.toLocaleString("zh-CN") ?? "—"}</strong>
										</button>
										<button
											type="button"
											className="list-stat"
											aria-label="只看范围内未读文章"
											aria-pressed={filter.view === "unread"}
											onClick={() => choose({ ...filter, view: "unread" })}
										>
											<BookOpen size={12} className="icon-reading" aria-hidden="true" />
											<span>未读</span>
											<strong>{unread?.toLocaleString("zh-CN") ?? "—"}</strong>
										</button>
										<div
											className="list-stat"
											title={`已读 ${(total ?? 0) - (unread ?? 0)} 篇；列表已载入 ${articles.length} 篇${pages.hasNextPage ? "，可继续加载" : ""}`}
										>
											<CheckCheck size={12} className="icon-save" aria-hidden="true" />
											<span>已读</span>
											<strong>{total === undefined ? "—" : `${readPercent}%`}</strong>
										</div>
									</fieldset>
									{filter.search && (
										<div className="list-meta">
											<span className="list-context">
												<Search size={12} className="icon-info" aria-hidden="true" />
												<span title={`搜索「${filter.search}」`}>搜索「{filter.search}」</span>
											</span>
											<span className="list-count">
												{articles.length} 篇{pages.hasNextPage ? "+" : ""}
											</span>
											<Button
												variant="ghost"
												size="icon"
												className="list-icon-button"
												aria-label="清除搜索"
												title="清除搜索"
												onClick={() => choose({ ...filter, search: "" })}
											>
												<X size={12} aria-hidden="true" />
											</Button>
										</div>
									)}
								</div>
								<div className="list-toolbar">
									<div className="list-update-slot">
										{pages.isError && pages.data ? (
											<Button
												variant="ghost"
												size="sm"
												disabled={pages.isFetching}
												onClick={() => void vm.reloadArticles()}
												title={pages.error.message}
											>
												更新失败，点击重试
											</Button>
										) : (
											<Button
												variant="ghost"
												size="sm"
												className="list-sync"
												data-error={failed > 0 || undefined}
												aria-label="查看当前同步状态"
												title={
													currentFeed?.last_error ||
													`${scopeFeeds?.length ?? 0} 个订阅源 · 最新文章优先${lastFetched ? ` · 最近同步 ${new Date(lastFetched).toLocaleString("zh-CN")}` : ""}`
												}
												onClick={() =>
													currentFeed && failed ? diagnose(currentFeed) : setPanel("logs")
												}
											>
												{failed ? (
													<CircleAlert size={12} aria-hidden="true" />
												) : (
													<Clock3 size={12} aria-hidden="true" />
												)}
												<span>{syncLabel}</span>
											</Button>
										)}
									</div>
									<HeaderTooltip label={currentFeed ? "刷新当前订阅 (R)" : "刷新全部订阅 (R)"}>
										<span className="inline-flex">
											<Button
												variant="ghost"
												size="icon"
												className="list-icon-button"
												aria-label={currentFeed ? "刷新当前订阅" : "刷新全部订阅"}
												disabled={vm.refresh.isPending || busy}
												onClick={() => vm.refresh.mutate()}
											>
												<RefreshCw
													size={13}
													className={`icon-reading ${syncing ? "spinning" : ""}`}
													aria-hidden="true"
												/>
											</Button>
										</span>
									</HeaderTooltip>
									<HeaderTooltip label="搜索当前范围 (/) · J / K 切换文章">
										<Button
											variant="ghost"
											size="icon"
											className="list-icon-button"
											aria-label="在当前范围搜索"
											aria-haspopup="dialog"
											onClick={() => {
												setSearch(filter.search);
												setSearchOpen(true);
											}}
										>
											<Search size={14} className="icon-info" aria-hidden="true" />
										</Button>
									</HeaderTooltip>
									{currentFeed && (
										<HeaderTooltip label="诊断订阅 · 连接、时效与替代 RSS">
											<Button
												variant="ghost"
												size="icon"
												className="feed-debug list-icon-button"
												aria-label={`诊断 ${currentFeed.title}`}
												onClick={() => diagnose(currentFeed)}
											>
												<Bug size={14} className="icon-feed" aria-hidden="true" />
											</Button>
										</HeaderTooltip>
									)}
									<HeaderTooltip label="将当前订阅范围全部标为已读">
										<Button
											variant="ghost"
											size="icon"
											className="list-icon-button"
											aria-label="全部标为已读"
											disabled={!unread || vm.markRead.isPending}
											onClick={() => vm.markRead.mutate(filter)}
										>
											<CheckCheck size={15} className="icon-reading" aria-hidden="true" />
										</Button>
									</HeaderTooltip>
								</div>
								<div className="article-scroll" ref={list} key={visit}>
									{pages.isPending || (!articles.length && feeds.isPending) ? (
										<div className="empty-state" role="status">
											<LoaderCircle className="spinning" size={22} />
											正在读取文章…
										</div>
									) : (pages.isError && !pages.data) || (!articles.length && feeds.isError) ? (
										<div className="empty-state" role="alert">
											<h3>暂时无法读取文章</h3>
											<p>{pages.error?.message || feeds.error?.message}</p>
											<Button
												onClick={() => {
													void pages.refetch();
													void feeds.refetch();
												}}
											>
												重试
											</Button>
										</div>
									) : !articles.length ? (
										<div className="empty-state">
											<BookOpen size={28} />
											<h3>{empty.title}</h3>
											<p>{empty.description}</p>
											<div className="empty-state-actions">
												{empty.action === "add" && (
													<Button size="sm" onClick={() => setPanel("add")}>
														添加订阅
													</Button>
												)}
												{empty.action === "search" && (
													<Button size="sm" onClick={() => choose({ ...filter, search: "" })}>
														重置关键词
													</Button>
												)}
												{empty.action === "all" && (
													<Button size="sm" onClick={() => choose({ ...filter, view: "all" })}>
														查看全部文章
													</Button>
												)}
												{empty.action === "home" && (
													<Button size="sm" onClick={() => choose({ view: "all", search: "" })}>
														返回全部文章
													</Button>
												)}
												{(empty.action === "refresh" || empty.action === "syncing") && (
													<>
														<Button
															size="sm"
															disabled={vm.refresh.isPending || busy || empty.action === "syncing"}
															onClick={() => vm.refresh.mutate()}
														>
															{empty.action === "syncing"
																? "正在同步…"
																: currentFeed
																	? "刷新订阅"
																	: "刷新全部订阅"}
														</Button>
														<Button
															size="sm"
															variant="outline"
															onClick={() =>
																currentFeed ? diagnose(currentFeed) : setPanel("logs")
															}
														>
															{currentFeed ? "诊断订阅源" : "查看抓取日志"}
														</Button>
													</>
												)}
											</div>
										</div>
									) : (
										articles.map((article) => (
											<button
												type="button"
												className={`article-item ${selected === article.id ? "selected" : ""} ${article.is_read ? "is-read" : ""}`}
												key={article.id}
												onClick={() => {
													keyboardNavigation.current = false;
													open(article);
												}}
												aria-current={selected === article.id ? "true" : undefined}
												data-testid="article-item"
												data-article-id={article.id}
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
													<span className="unread-dot" aria-hidden="true" />
													{titleOf(article)}
												</h3>
												<p>{article.translated_description || article.description}</p>
												<div className="article-item-foot">
													<span>
														{article.translated_title ? (
															<>
																<Sparkles size={11} className="icon-ai" aria-hidden="true" /> AI
																译文
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
								key={selected}
								article={detail.data}
								loading={Boolean(selected) && detail.isPending}
								error={detail.error?.message}
								selected={Boolean(selected)}
								navigationKey={vm.navigationKey}
								preferences={pref}
								translation={translation}
								onTranslation={setTranslation}
								onBack={back}
								onDiscover={() => setPanel("discover")}
								onStatus={(body) => {
									if (selected) articleWrite.mutate({ id: selected, body });
								}}
								onAction={(kind, force) => {
									if (selected && !vm.actionBusy) action.mutate({ id: selected, kind, force });
								}}
								onAiSettings={() => {
									setSettingsTab("ai");
									setPanel("settings");
								}}
								ai={vm.ai.data}
								actionError={vm.actionError}
								statusBusy={vm.statusBusy}
								actionBusy={vm.actionBusy}
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
					settingsTab={settingsTab}
					onClose={() => {
						setPanel(null);
						setSettingsTab("feeds");
					}}
					feeds={feeds.data ?? []}
					categories={categories.data ?? []}
					preferences={pref}
					stats={stats.data}
					logs={logs.data ?? []}
					logsUpdatedAt={logs.dataUpdatedAt}
					logsError={logs.error?.message}
					logsLoading={logs.isPending}
					onRetryLogs={() => void logs.refetch()}
					local={session.local}
					onChanged={vm.changed}
					selectedFeed={feeds.data?.find((feed) => feed.id === selectedFeedId)}
					onDiagnose={diagnose}
					onNotice={setNotice}
				/>
			</AppShell>
		</SidebarProvider>
	);
}

function CategoryGroup({
	category,
	feeds,
	filter,
	onChoose,
	onManage,
}: {
	category: Category;
	feeds: Feed[];
	filter: ReaderFilter;
	onChoose: (filter: ReaderFilter) => void;
	onManage: (feed: Feed, action: "edit-feed" | "delete-feed") => void;
}) {
	const unread = feeds.reduce((count, feed) => count + feed.unread_count, 0);
	return (
		<Collapsible defaultOpen className="sidebar-category">
			<div className="sidebar-category-heading">
				<CollapsibleTrigger asChild>
					<Button
						variant="ghost"
						size="icon"
						className="sidebar-category-toggle"
						aria-label={`展开或收起 ${category.name}`}
					>
						<ChevronRight size={14} aria-hidden="true" />
					</Button>
				</CollapsibleTrigger>
				<SidebarItem
					className="sidebar-category-link"
					aria-label={`分类 ${category.name}`}
					title={category.name}
					active={filter.categoryId === category.id}
					onClick={() => onChoose({ view: "all", categoryId: category.id, search: "" })}
				>
					<span className="category-name">
						<span
							className={`category-dot ${category.color}`}
							style={{
								backgroundColor: category.color.startsWith("#") ? category.color : undefined,
							}}
						/>
						{category.icon && <span aria-hidden="true">{category.icon}</span>}
						<span className="truncate">{category.name}</span>
					</span>
					<span className="nav-count">{unread || ""}</span>
				</SidebarItem>
			</div>
			<CollapsibleContent unstyled>
				<div className="sidebar-category-feeds">
					{feeds.map((feed) => (
						<FeedItem
							key={feed.id}
							feed={feed}
							active={filter.feedId === feed.id}
							onClick={() => onChoose({ view: "all", feedId: feed.id, search: "" })}
							onManage={onManage}
						/>
					))}
				</div>
			</CollapsibleContent>
		</Collapsible>
	);
}

function FeedItem({
	feed,
	active,
	onClick,
	onManage,
}: {
	feed: Feed;
	active: boolean;
	onClick: () => void;
	onManage: (feed: Feed, action: "edit-feed" | "delete-feed") => void;
}) {
	const openingDialog = useRef(false);
	return (
		<ContextMenu modal={false}>
			<ContextMenuTrigger asChild>
				<SidebarItem
					data-feed-id={feed.id}
					className="sidebar-feed-link"
					aria-label={feed.title}
					aria-haspopup="menu"
					aria-keyshortcuts="Shift+F10"
					active={active}
					onClick={(event) => {
						// Releasing a long press can emit a click after the menu has opened.
						if (event.currentTarget.dataset.state === "open") {
							event.preventDefault();
							event.stopPropagation();
						} else onClick();
					}}
					onKeyDown={(event) => {
						if (event.key !== "ContextMenu" && !(event.shiftKey && event.key === "F10")) return;
						event.preventDefault();
						const bounds = event.currentTarget.getBoundingClientRect();
						event.currentTarget.dispatchEvent(
							new MouseEvent("contextmenu", {
								bubbles: true,
								clientX: bounds.left + bounds.width / 2,
								clientY: bounds.bottom,
							}),
						);
					}}
					title={feed.last_error ?? feed.title}
				>
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
			</ContextMenuTrigger>
			<ContextMenuPanel
				className="feed-context-menu"
				aria-label={`${feed.title} 的订阅菜单`}
				onFocusOutside={(event) => {
					// Touch release can return focus to the trigger before a menu item is chosen.
					if (event.target instanceof HTMLElement && event.target.dataset.feedId === feed.id)
						event.preventDefault();
				}}
				onCloseAutoFocus={(event) => {
					if (openingDialog.current) {
						event.preventDefault();
						openingDialog.current = false;
					}
				}}
			>
				<ContextMenuItem
					onSelect={() => {
						openingDialog.current = true;
						onManage(feed, "edit-feed");
					}}
				>
					<Pencil size={15} className="icon-info" aria-hidden="true" />
					编辑订阅
				</ContextMenuItem>
				<ContextMenuItem
					onSelect={() => {
						openingDialog.current = true;
						onManage(feed, "delete-feed");
					}}
				>
					<Trash2 size={15} className="error-color" aria-hidden="true" />
					删除订阅
				</ContextMenuItem>
			</ContextMenuPanel>
		</ContextMenu>
	);
}
