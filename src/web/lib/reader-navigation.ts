import type { ReaderFilter } from "../../shared/contracts";

export interface ReaderRoute {
	filter: ReaderFilter;
	selected: string | null;
}

export interface ReaderNavigation extends ReaderRoute {
	visit: string;
	key: string;
}

export function readerPath({ filter, selected }: ReaderRoute): string {
	let path = filter.feedId
		? `/feeds/${encodeURIComponent(filter.feedId)}`
		: filter.categoryId
			? `/categories/${encodeURIComponent(filter.categoryId)}`
			: "";
	if (selected) path += `/articles/${encodeURIComponent(selected)}`;
	const query = new URLSearchParams();
	if (filter.view !== "all") query.set("view", filter.view);
	if (filter.search) query.set("q", filter.search);
	return `${path || "/"}${query.size ? `?${query}` : ""}`;
}

export function readReaderRoute(url: URL): ReaderRoute {
	const filter: ReaderFilter = { view: "all", search: "" };
	const match = url.pathname.match(
		/^\/(?:(feeds|categories)\/([^/]+)(?:\/articles\/([^/]+))?|articles\/([^/]+))?\/?$/,
	);
	if (!match) return { filter, selected: null };
	try {
		if (match[1] && match[2])
			filter[match[1] === "feeds" ? "feedId" : "categoryId"] = decodeURIComponent(match[2]);
		const view = url.searchParams.get("view");
		if (view === "unread" || view === "starred" || view === "later") filter.view = view;
		filter.search = (url.searchParams.get("q") ?? "").slice(0, 200);
		const article = match[3] ?? match[4];
		return {
			filter,
			selected: article ? decodeURIComponent(article) : url.searchParams.get("article") || null,
		};
	} catch {
		return { filter: { view: "all", search: "" }, selected: null };
	}
}

export function readReaderNavigation(): ReaderNavigation {
	const route = readReaderRoute(new URL(location.href));
	const saved = history.state?.geekhub;
	const matches = saved?.path === readerPath(route);
	return {
		...route,
		visit: matches && typeof saved.visit === "string" ? saved.visit : crypto.randomUUID(),
		key: matches && typeof saved.key === "string" ? saved.key : crypto.randomUUID(),
	};
}

export function writeReaderNavigation(navigation: ReaderNavigation, replace = false): void {
	const path = readerPath(navigation);
	const state = {
		...history.state,
		geekhub: { path, visit: navigation.visit, key: navigation.key },
	};
	if (replace) history.replaceState(state, "", path);
	else history.pushState(state, "", path);
}

interface ReadingPosition {
	top: number;
	pages: number;
}

export function readReadingPosition(key: string): ReadingPosition {
	try {
		const value = JSON.parse(sessionStorage.getItem(`geekhub:position:${key}`) ?? "null");
		return {
			top: Number.isFinite(value?.top) && value.top >= 0 ? value.top : 0,
			pages: Number.isSafeInteger(value?.pages) && value.pages > 0 ? value.pages : 1,
		};
	} catch {
		return { top: 0, pages: 1 };
	}
}

export function saveReadingPosition(key: string, position: Partial<ReadingPosition>): void {
	try {
		sessionStorage.setItem(
			`geekhub:position:${key}`,
			JSON.stringify({ ...readReadingPosition(key), ...position }),
		);
	} catch {
		// A browser with storage disabled still supports URL navigation and reading.
	}
}
