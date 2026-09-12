import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import type { DirectoryFeed, FeedDiagnostic } from "../../shared/contracts";
import { api } from "./api";
import { assessDiagnostic } from "./diagnostic-score";
import type { SavedChange } from "./reader-view-model";

export type Panel = "add" | "discover" | "settings" | "logs" | "diagnose" | null;
export type Save = (
	path: string,
	method: string,
	body?: unknown,
	done?: () => void,
) => Promise<boolean>;

export function usePanelViewModel(
	changed: (change: SavedChange) => Promise<void>,
	notify: (message: string) => void,
) {
	const mutation = useMutation({
		mutationFn: async ({
			path,
			method,
			body,
		}: {
			path: string;
			method: string;
			body?: unknown;
		}) => {
			const result = await api(path, { method, body });
			await changed({ path, method, result });
		},
	});
	const save: Save = async (path, method, body, done) => {
		try {
			await mutation.mutateAsync({ path, method, body });
			done?.();
			return true;
		} catch (error) {
			notify(error instanceof Error ? error.message : "操作失败，请重试");
			return false;
		}
	};
	return { pending: mutation.isPending, save };
}

export function useDiagnosticViewModel(feedId: string) {
	const client = useQueryClient();
	const started = useRef<string | null>(null);
	const queryKey = ["diagnostics", feedId];
	const path = `/feeds/${feedId}/diagnostics`;
	const query = useQuery({
		queryKey,
		queryFn: ({ signal }) => api<FeedDiagnostic | null>(path, { signal }),
		staleTime: 0,
		refetchOnWindowFocus: false,
		refetchInterval: (query) =>
			query.state.data?.status === "queued" || query.state.data?.status === "running"
				? 1000
				: false,
	});
	const start = useMutation({
		mutationFn: async (siteUrl?: string) => {
			await client.cancelQueries({ queryKey });
			return api<FeedDiagnostic>(path, { method: "POST", body: siteUrl ? { siteUrl } : {} });
		},
		onSuccess: (data) => client.setQueryData(queryKey, data),
	});
	useEffect(() => {
		if (started.current !== feedId && query.isSuccess && query.data === null) {
			started.current = feedId;
			start.mutate(undefined);
		}
	}, [feedId, query.isSuccess, query.data, start]);
	return {
		query,
		start,
		assessment: query.data?.report ? assessDiagnostic(query.data.report) : null,
		busy:
			query.isPending ||
			start.isPending ||
			query.data?.status === "queued" ||
			query.data?.status === "running",
		error: start.error?.message || query.error?.message || query.data?.error,
	};
}

export function moveBefore(ids: string[], id: string, before: string | null): string[] {
	if (id === before || !ids.includes(id) || (before !== null && !ids.includes(before))) return ids;
	const result = ids.filter((item) => item !== id);
	result.splice(before === null ? result.length : result.indexOf(before), 0, id);
	return result;
}

export function useDirectoryViewModel(search: string) {
	const directory = useQuery({
		queryKey: ["directory"],
		queryFn: ({ signal }) => api<DirectoryFeed[]>("/directory", { signal }),
	});
	const matches =
		directory.data?.filter((item) =>
			`${item.title} ${item.category} ${item.description} ${item.site_url}`
				.toLowerCase()
				.includes(search.toLowerCase()),
		) ?? [];
	return { directory, matches };
}
