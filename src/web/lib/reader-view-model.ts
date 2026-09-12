import {
	type InfiniteData,
	useInfiniteQuery,
	useIsMutating,
	useMutation,
	useMutationState,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	type AiAction,
	type AiSettings,
	type Article,
	type ArticleDetail,
	type ArticlePage,
	type Category,
	defaultPreferences,
	type Feed,
	type FetchLog,
	type Preferences,
	type ReaderFilter,
	type Stats,
} from "../../shared/contracts";
import { api } from "./api";
import {
	adjacentArticle,
	articleQuery,
	feedRevision,
	patchArticles,
	translateTitles,
	viewLabels,
} from "./reader";
import {
	type ReaderNavigation,
	readerPath,
	readReaderNavigation,
	readReadingPosition,
	saveReadingPosition,
	writeReaderNavigation,
} from "./reader-navigation";

export interface SavedChange {
	path: string;
	method: string;
	result: unknown;
}
type ArticleState = Partial<Record<"is_read" | "is_starred" | "is_later", boolean>>;
const quietQuery = { refetchOnWindowFocus: false, refetchOnReconnect: false };

export function useReaderViewModel(notify: (message: string) => void) {
	const client = useQueryClient();
	const [navigation, setNavigation] = useState(readReaderNavigation);
	const { filter, visit, selected } = navigation;
	const navigationRef = useRef(navigation);
	const acceptedVisits = useRef(new Map<string, string>());
	const [restorePages, setRestorePages] = useState(
		() => readReadingPosition(`list:${visit}`).pages,
	);
	const [translation, setTranslation] = useState(false);
	const [acceptedRevision, setAcceptedRevision] = useState<string | null>(null);
	const [translatedIds, setTranslatedIds] = useState<string[]>([]);
	const selectedRef = useRef(selected);
	selectedRef.current = selected;
	const visitRef = useRef(visit);
	visitRef.current = visit;
	const attempted = useRef(new Set<string>());
	const translating = useRef(Promise.resolve());
	const applyNavigation = useCallback((next: ReaderNavigation) => {
		if (next.visit !== navigationRef.current.visit) {
			setAcceptedRevision(acceptedVisits.current.get(next.visit) ?? null);
			setRestorePages(readReadingPosition(`list:${next.visit}`).pages);
		}
		navigationRef.current = next;
		selectedRef.current = next.selected;
		visitRef.current = next.visit;
		setNavigation(next);
		setTranslation(false);
	}, []);
	useEffect(() => {
		writeReaderNavigation(navigationRef.current, true);
		const restoration = history.scrollRestoration;
		history.scrollRestoration = "manual";
		const pop = () => applyNavigation(readReaderNavigation());
		window.addEventListener("popstate", pop);
		return () => {
			window.removeEventListener("popstate", pop);
			history.scrollRestoration = restoration;
		};
	}, [applyNavigation]);
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
		queryFn: ({ signal }) => api<Category[]>("/categories", { signal }),
	});
	const stats = useQuery({
		queryKey: ["stats"],
		queryFn: ({ signal }) => api<Stats>("/stats", { signal }),
	});
	const preferences = useQuery({
		queryKey: ["preferences"],
		queryFn: ({ signal }) => api<Preferences>("/settings", { signal }),
	});
	const ai = useQuery({
		queryKey: ["ai"],
		queryFn: ({ signal }) => api<AiSettings>("/ai/settings", { signal }),
	});
	const busy = feeds.data?.some((f) => f.status === "queued" || f.status === "fetching") ?? false;
	const logs = useQuery({
		queryKey: ["logs"],
		queryFn: ({ signal }) => api<FetchLog[]>("/logs", { signal }),
		refetchInterval: busy ? 1500 : false,
	});
	// A reading visit is a stable snapshot. Only navigation or accepting updates reloads its rows.
	const pages = useInfiniteQuery({
		queryKey: ["articles", filter, visit],
		queryFn: ({ pageParam, signal }) =>
			api<ArticlePage>(articleQuery(filter, pageParam), { signal }),
		initialPageParam: undefined as string | undefined,
		getNextPageParam: (last) => last.nextCursor ?? undefined,
		staleTime: Infinity,
		...quietQuery,
	});
	const detail = useQuery({
		queryKey: ["article", selected],
		queryFn: ({ signal }) =>
			api<ArticleDetail>(`/articles/${encodeURIComponent(selected ?? "")}`, { signal }),
		enabled: Boolean(selected),
		staleTime: 0,
		...quietQuery,
	});
	const articles = useMemo(
		() => pages.data?.pages.flatMap((page) => page.articles) ?? [],
		[pages.data],
	);
	const revision = feeds.data ? feedRevision(feeds.data, filter) : null;
	useEffect(() => {
		if (pages.data && acceptedRevision === null && revision !== null) setAcceptedRevision(revision);
	}, [pages.data, acceptedRevision, revision]);
	useEffect(() => {
		if (acceptedRevision !== null) acceptedVisits.current.set(visit, acceptedRevision);
	}, [visit, acceptedRevision]);
	const restoringPages = Boolean(
		pages.data && pages.data.pages.length < restorePages && pages.hasNextPage && !pages.isError,
	);
	useEffect(() => {
		if (restoringPages && !pages.isFetching) void pages.fetchNextPage();
	}, [restoringPages, pages.isFetching, pages.fetchNextPage]);
	useEffect(() => {
		if (pages.data && !restoringPages)
			saveReadingPosition(`list:${visit}`, { pages: pages.data.pages.length });
	}, [pages.data, restoringPages, visit]);
	const activityStamp = feeds.data
		?.map((feed) => `${feed.id}:${feed.last_fetched_at}:${feed.last_error}`)
		.join("|");
	useEffect(() => {
		if (activityStamp)
			void Promise.all(
				["stats", "logs"].map((key) => client.invalidateQueries({ queryKey: [key] })),
			);
	}, [activityStamp, client]);

	const invalidate = useCallback(
		async (...keys: string[]) => {
			await Promise.all(keys.map((key) => client.invalidateQueries({ queryKey: [key] })));
		},
		[client],
	);
	const patch = useCallback(
		(id: string, values: Partial<ArticleDetail>, fallback?: ArticleDetail) => {
			client.setQueriesData<InfiniteData<ArticlePage>>({ queryKey: ["articles"] }, (data) =>
				patchArticles(data, (article) => article.id === id, values),
			);
			client.setQueryData<ArticleDetail>(["article", id], (current) =>
				current ? { ...current, ...values } : fallback,
			);
		},
		[client],
	);
	const articleWrite = useMutation({
		mutationKey: ["article-write"],
		scope: { id: "reading-state" },
		mutationFn: ({ id, body }: { id: string; body: ArticleState }) =>
			api<ArticleDetail>(`/articles/${id}`, { method: "PATCH", body }),
		onSuccess: async (article, { id, body }) => {
			await client.cancelQueries({ queryKey: ["article", id] });
			patch(
				id,
				Object.fromEntries(
					Object.keys(body).map((key) => [key, article[key as keyof ArticleState]]),
				),
				article,
			);
			await invalidate("feeds", "stats");
		},
		onError: (error) => notify(error.message),
	});
	const action = useMutation({
		mutationKey: ["article-action"],
		mutationFn: ({ id, kind }: { id: string; kind: AiAction | "full" }) =>
			api<ArticleDetail>(`/articles/${id}/${kind === "full" ? "full" : "ai"}`, {
				method: "POST",
				...(kind === "full" ? {} : { body: { action: kind } }),
			}),
		onSuccess: (article, { id, kind }) => {
			const values =
				kind === "translate-title"
					? {
							translated_title: article.translated_title,
							translated_description: article.translated_description,
						}
					: kind === "summary"
						? { summary: article.summary }
						: kind === "translate"
							? { translated_content: article.translated_content }
							: {
									content: article.content,
									full_content_fetched: article.full_content_fetched,
									summary: article.summary,
									translated_content: article.translated_content,
								};
			patch(id, { ...values, ai_model: article.ai_model }, article);
			if (kind === "translate" && selectedRef.current === id) setTranslation(true);
		},
		onError: (error) => notify(error.message),
	});
	const refresh = useMutation({
		mutationFn: () =>
			api(filter.feedId ? `/feeds/${filter.feedId}/refresh` : "/refresh", { method: "POST" }),
		onSuccess: () => invalidate("feeds", "logs"),
		onError: (error) => notify(error.message),
	});
	const markRead = useMutation({
		scope: { id: "reading-state" },
		mutationFn: (scope: ReaderFilter) =>
			api("/read-all", {
				method: "POST",
				body: { feedId: scope.feedId, categoryId: scope.categoryId },
			}),
		onSuccess: async (_, scope) => {
			const ids = new Set(
				(feeds.data ?? [])
					.filter(
						(feed) =>
							(!scope.feedId || scope.feedId === feed.id) &&
							(!scope.categoryId || scope.categoryId === feed.category_id),
					)
					.map((feed) => feed.id),
			);
			const inScope = (article: Article) =>
				(!scope.feedId || article.feed_id === scope.feedId) &&
				(!scope.categoryId || ids.has(article.feed_id));
			client.setQueriesData<InfiniteData<ArticlePage>>({ queryKey: ["articles"] }, (data) =>
				patchArticles(data, inScope, { is_read: 1 }),
			);
			client.setQueriesData<ArticleDetail>({ queryKey: ["article"] }, (article) =>
				article && inScope(article) ? { ...article, is_read: 1 } : article,
			);
			await invalidate("feeds", "stats");
		},
		onError: (error) => notify(error.message),
	});
	const statusBusy =
		useIsMutating({
			mutationKey: ["article-write"],
			predicate: (mutation) => (mutation.state.variables as { id: string }).id === selected,
		}) > 0 || markRead.isPending;
	const pendingActions = useMutationState({
		filters: { mutationKey: ["article-action"], status: "pending" },
		select: (mutation) => mutation.state.variables as { id: string; kind: AiAction | "full" },
	});
	const actionBusy = pendingActions.find((pending) => pending.id === selected)?.kind ?? null;

	function navigate(nextFilter: ReaderFilter, nextSelected: string | null, replace = false) {
		const current = navigationRef.current;
		const next = { filter: nextFilter, selected: nextSelected };
		if (readerPath(next) === readerPath(current)) return;
		const sameScope =
			readerPath({ ...current, selected: null }) === readerPath({ ...next, selected: null });
		const destination = {
			...next,
			visit: sameScope ? current.visit : crypto.randomUUID(),
			key: crypto.randomUUID(),
		};
		writeReaderNavigation(destination, replace);
		applyNavigation(destination);
	}
	function choose(next: ReaderFilter) {
		navigate(next, null);
	}
	function open(article: Article) {
		if (article.id === selectedRef.current) return;
		navigate(navigationRef.current.filter, article.id);
		if (!article.is_read) articleWrite.mutate({ id: article.id, body: { is_read: true } });
	}
	const back = () => {
		navigate(navigationRef.current.filter, null);
	};
	const move = async (direction: 1 | -1) => {
		const navigationAtStart = navigationRef.current;
		const article = adjacentArticle(articles, selectedRef.current, direction);
		if (article) open(article);
		else if (direction === 1 && pages.hasNextPage && !pages.isFetchingNextPage) {
			const result = await pages.fetchNextPage();
			if (result.isError) {
				notify(result.error.message);
				return;
			}
			const next = result.data?.pages.flatMap((page) => page.articles)[articles.length];
			if (next && navigationRef.current === navigationAtStart) open(next);
		}
	};
	const acceptUpdates = async () => {
		const acceptedTranslations = new Set(translatedIds);
		const result = await pages.refetch();
		if (result.isError) {
			notify(result.error.message);
			return false;
		}
		if (visitRef.current !== visit) return false;
		setAcceptedRevision(revision);
		setTranslatedIds((ids) => ids.filter((id) => !acceptedTranslations.has(id)));
		return true;
	};
	const changed = async ({ path, method, result }: SavedChange) => {
		if (path === "/settings") {
			client.setQueryData(["preferences"], result);
			return;
		}
		if (path.startsWith("/ai")) {
			await invalidate("ai");
			return;
		}
		if (path === "/logs") {
			await invalidate("logs");
			return;
		}
		if (method === "DELETE" && path.startsWith("/feeds/")) {
			const id = path.slice("/feeds/".length);
			if (filter.feedId === id) navigate({ view: "all", search: "" }, null, true);
			else if (detail.data?.feed_id === id) navigate(filter, null, true);
			client.setQueriesData<InfiniteData<ArticlePage>>(
				{ queryKey: ["articles"] },
				(data) =>
					data && {
						...data,
						pages: data.pages.map((page) => ({
							...page,
							articles: page.articles.filter((article) => article.feed_id !== id),
						})),
					},
			);
		} else if (method === "DELETE" && path === `/categories/${filter.categoryId}`)
			navigate({ view: "all", search: "" }, null, true);
		await invalidate("feeds", "categories", "stats", "logs");
	};

	const translationKey = articles
		.filter((article) => article.auto_translate && !article.translated_title)
		.map((article) => article.id)
		.join("|");
	const canTranslate = Boolean(ai.data?.hasApiKey || ai.data?.mock);
	useEffect(() => {
		if (!canTranslate || !translationKey) return;
		let active = true;
		const ids = new Set(translationKey.split("|"));
		const candidates = client
			.getQueriesData<InfiniteData<ArticlePage>>({ queryKey: ["articles"] })
			.flatMap(
				([, data]) =>
					data?.pages.flatMap((page) => page.articles.filter((article) => ids.has(article.id))) ??
					[],
			);
		translating.current = translating.current.then(() =>
			translateTitles(
				candidates,
				attempted.current,
				() => active,
				async (article) => {
					// Background translations become visible when the reader accepts the next snapshot.
					setTranslatedIds((previous) =>
						previous.includes(article.id) ? previous : [...previous, article.id],
					);
				},
			),
		);
		return () => {
			active = false;
		};
	}, [translationKey, canTranslate, client]);
	const currentFeed = feeds.data?.find((feed) => feed.id === filter.feedId);
	const heading =
		currentFeed?.title ??
		categories.data?.find((category) => category.id === filter.categoryId)?.name ??
		viewLabels[filter.view];
	return {
		feeds,
		categories,
		stats,
		preferences: preferences.data ?? defaultPreferences,
		preferencesLoaded: preferences.isSuccess,
		logs,
		pages,
		detail,
		articles,
		filter,
		visit,
		navigationKey: navigation.key,
		restoringPages,
		selected,
		translation,
		setTranslation,
		currentFeed,
		heading,
		busy,
		choose,
		open,
		back,
		move,
		action,
		articleWrite,
		refresh,
		markRead,
		acceptUpdates,
		changed,
		statusBusy,
		actionBusy,
		updatesAvailable:
			(acceptedRevision !== null && revision !== null && acceptedRevision !== revision) ||
			translatedIds.some((id) => articles.some((article) => article.id === id)),
	};
}
