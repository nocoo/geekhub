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
	ThemeToggle,
	Tooltip,
	TooltipContent,
	TooltipTrigger,
	toast,
} from "@nocoo/basalt";
import { AppHeader } from "@nocoo/basalt/components/app-header";
import { AppMain, AppShell, AppSkipLink } from "@nocoo/basalt/components/app-shell";
import { useTheme } from "@nocoo/basalt/providers/theme";
import { useQuery } from "@tanstack/react-query";
import {
	ArrowDown,
	Bookmark,
	BookOpen,
	Bug,
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
	Settings,
	Sparkles,
	Star,
	Terminal,
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
import { ApiError, api } from "./lib/api";
import type { Panel } from "./lib/panels-view-model";
import { dateLabel, readerShortcut, titleOf } from "./lib/reader";
import { useReadingPosition } from "./lib/reader-position";
import { useReaderViewModel } from "./lib/reader-view-model";
import { Panels } from "./Panels";
import { Reader } from "./Reader";

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
	const [diagnosticId, setDiagnosticId] = useState<string | null>(null);
	const setNotice = useCallback((message: string) => {
		toast(message, { duration: 8000 });
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
	const latestActivity = logs.data?.[0];
	const activityMessage = latestActivity
		? `${latestActivity.feed_title} · ${latestActivity.message}`
		: "等待第一次同步";
	const list = useRef<HTMLDivElement>(null);
	useReadingPosition(
		list,
		`list:${visit}`,
		Boolean(pages.data) && !vm.restoringPages && (!mobile || !selected),
	);
	const [anchor, setAnchor] = useState<{ id: string; offset: number }[] | null>(null);
	const keyboardNavigation = useRef(false);
	function choose(next: ReaderFilter) {
		keyboardNavigation.current = false;
		setAnchor(null);
		vm.choose(next);
		setSearch(next.search);
		if (mobile) setCollapsed(true);
	}
	function diagnose(feed: Feed) {
		setDiagnosticId(feed.id);
		setPanel("diagnose");
	}
	async function acceptUpdates() {
		const bounds = list.current?.getBoundingClientRect();
		const positions = Array.from(
			list.current?.querySelectorAll<HTMLElement>("[data-article-id]") ?? [],
		).flatMap((row) => {
			const rect = row.getBoundingClientRect();
			return bounds && rect.bottom > bounds.top && rect.top < bounds.bottom
				? [{ id: row.dataset.articleId ?? "", offset: rect.top - bounds.top }]
				: [];
		});
		if (await vm.acceptUpdates()) setAnchor(positions);
	}
	useLayoutEffect(() => {
		if (!anchor || !list.current) return;
		const rows = new Map(
			Array.from(list.current.querySelectorAll<HTMLElement>("[data-article-id]"), (row) => [
				row.dataset.articleId,
				row,
			]),
		);
		for (const position of anchor) {
			const row = rows.get(position.id);
			if (!row) continue;
			list.current.scrollTop +=
				row.getBoundingClientRect().top -
				list.current.getBoundingClientRect().top -
				position.offset;
			break;
		}
		setAnchor(null);
	}, [anchor]);
	useLayoutEffect(() => {
		if (
			selected &&
			(keyboardNavigation.current || document.activeElement?.matches(".article-item"))
		) {
			const row = list.current?.querySelector<HTMLElement>("[aria-current='true']");
			row?.focus({ preventScroll: true });
			row?.scrollIntoView({ block: "nearest" });
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
									<CategoryGroup
										key={category.id}
										category={category}
										feeds={feeds.data?.filter((feed) => feed.category_id === category.id) ?? []}
										filter={filter}
										onChoose={choose}
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
											/>
										))}
								</div>
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
									disabled={vm.refresh.isPending || busy}
									onClick={() => vm.refresh.mutate()}
									title="刷新订阅 (R)"
									aria-keyshortcuts="r"
								>
									<RefreshCw size={16} className={busy ? "spinning" : ""} />
								</Button>
								<Button variant="ghost" size="icon" asChild>
									<a
										href="https://github.com/nocoo/geekhub"
										target="_blank"
										rel="noopener noreferrer"
										aria-label="GeekHub GitHub 项目"
										title="GitHub 项目"
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
								<Button
									variant="ghost"
									size="icon"
									aria-label="设置"
									title="设置"
									aria-haspopup="dialog"
									onClick={() => setPanel("settings")}
								>
									<Settings size={17} />
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
										{currentFeed && (
											<Button
												variant="ghost"
												size="icon"
												className="feed-debug h-8 w-8"
												aria-label={`诊断 ${currentFeed.title}`}
												title="检查连接、内容时效与替代 RSS"
												onClick={() => diagnose(currentFeed)}
											>
												<Bug size={15} />
											</Button>
										)}
										<Tooltip>
											<TooltipTrigger asChild>
												<Button
													variant="ghost"
													size="icon"
													className="h-8 w-8"
													aria-label="全部标为已读"
													disabled={!articles.length || vm.markRead.isPending}
													onClick={() => vm.markRead.mutate(filter)}
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
														choose({ ...filter, search: "" });
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
								<div className="list-update-slot">
									{pages.isError && pages.data ? (
										<Button
											variant="ghost"
											size="sm"
											disabled={pages.isFetching}
											onClick={() => void acceptUpdates()}
											title={pages.error.message}
										>
											更新失败，点击重试
										</Button>
									) : vm.updatesAvailable ? (
										<Button
											variant="ghost"
											size="sm"
											disabled={pages.isFetching}
											onClick={() => void acceptUpdates()}
										>
											<RefreshCw size={12} className={pages.isFetching ? "spinning" : ""} />
											{pages.isFetching ? "载入中…" : "有内容更新，点击载入"}
										</Button>
									) : (
										<span>J / K 切换文章 · / 搜索</span>
									)}
								</div>
								<div className="article-scroll" ref={list} key={visit}>
									{pages.isPending ? (
										<div className="empty-state" role="status">
											<LoaderCircle className="spinning" size={22} />
											正在读取文章…
										</div>
									) : pages.isError && !pages.data ? (
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
								navigationKey={vm.navigationKey}
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
					onClose={() => setPanel(null)}
					feeds={feeds.data ?? []}
					categories={categories.data ?? []}
					preferences={pref}
					stats={stats.data}
					logs={logs.data ?? []}
					local={session.local}
					onChanged={vm.changed}
					diagnosticFeed={feeds.data?.find((feed) => feed.id === diagnosticId)}
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
}: {
	category: Category;
	feeds: Feed[];
	filter: ReaderFilter;
	onChoose: (filter: ReaderFilter) => void;
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
						/>
					))}
				</div>
			</CollapsibleContent>
		</Collapsible>
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
