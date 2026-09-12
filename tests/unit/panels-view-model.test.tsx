// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import type { FeedDiagnostic } from "../../src/shared/contracts";
import {
	moveBefore,
	useDiagnosticViewModel,
	useDirectoryViewModel,
	usePanelViewModel,
} from "../../src/web/lib/panels-view-model";
import { deferred, queryHarness, transport } from "./view-model-support";

afterEach(cleanup);

test("reordering preserves the complete set and handles moves to the end and invalid drags", () => {
	const ids = ["a", "b", "c"];
	expect(moveBefore(ids, "c", "a")).toEqual(["c", "a", "b"]);
	expect(moveBefore(ids, "a", null)).toEqual(["b", "c", "a"]);
	for (const [id, before] of [
		["a", "a"],
		["missing", "b"],
		["a", "missing"],
	])
		expect(moveBefore(ids, id ?? "", before ?? null)).toBe(ids);
	expect(ids).toEqual(["a", "b", "c"]);
});

test("panel save awaits persistence and metadata refresh before closing its editor", async () => {
	const server = transport();
	const saved = { title: "Updated" };
	const response = deferred<Response>();
	server.routes.set("PATCH /api/feeds/f1", () => response.promise);
	const changed = vi.fn(async () => {});
	const notify = vi.fn();
	const done = vi.fn();
	const { wrapper } = queryHarness();
	const { result } = renderHook(() => usePanelViewModel(changed, notify), { wrapper });
	let writing!: Promise<boolean>;
	act(() => {
		writing = result.current.save("/feeds/f1", "PATCH", saved, done);
	});
	await waitFor(() => expect(result.current.pending).toBe(true));
	expect(done).not.toHaveBeenCalled();
	await act(async () => {
		response.resolve(Response.json(saved));
		expect(await writing).toBe(true);
	});
	expect(changed).toHaveBeenCalledWith({ path: "/feeds/f1", method: "PATCH", result: saved });
	expect(done).toHaveBeenCalledOnce();
	expect(notify).not.toHaveBeenCalled();
	server.routes.set("DELETE /api/feeds/f1", { ok: true });
	await act(async () => {
		expect(await result.current.save("/feeds/f1", "DELETE")).toBe(true);
	});
});

test("panel failures keep editors open and report transport and non-Error failures", async () => {
	const server = transport();
	server.routes.set("PATCH /api/feeds/f1", async () =>
		Response.json({ error: "invalid address" }, { status: 400 }),
	);
	const notify = vi.fn();
	const done = vi.fn();
	const changed = vi.fn(async () => {});
	const { wrapper } = queryHarness();
	const { result } = renderHook(() => usePanelViewModel(changed, notify), { wrapper });
	await act(async () => {
		expect(await result.current.save("/feeds/f1", "PATCH", {}, done)).toBe(false);
	});
	expect(notify).toHaveBeenCalledWith("invalid address");
	expect(done).not.toHaveBeenCalled();
	expect(changed).not.toHaveBeenCalled();
	server.routes.set("PATCH /api/feeds/f1", { ok: true });
	changed.mockRejectedValueOnce("unexpected");
	await act(async () => {
		expect(await result.current.save("/feeds/f1", "PATCH", {})).toBe(false);
	});
	expect(notify).toHaveBeenCalledWith("操作失败，请重试");
});

const diagnostic = (status: FeedDiagnostic["status"]): FeedDiagnostic => ({
	feed_id: "f1",
	run_id: "run",
	feed_url: "https://example.com/rss",
	status,
	requested_at: "2026-09-12T00:00:00.000Z",
	finished_at: null,
	error: null,
	report: null,
});

test("a new diagnostic waits for its saved report then starts and polls work until complete", async () => {
	const server = transport();
	const path = "/api/feeds/f1/diagnostics";
	const previous = deferred<Response>();
	server.routes.set(`GET ${path}`, () => previous.promise);
	server.routes.set(`POST ${path}`, diagnostic("queued"));
	const { wrapper, client } = queryHarness();
	const { result } = renderHook(() => useDiagnosticViewModel("f1"), { wrapper });
	expect(result.current.busy).toBe(true);
	expect(result.current.start.isIdle).toBe(true);
	await act(async () => {
		previous.resolve(Response.json(null));
	});
	await waitFor(() => expect(result.current.start.isSuccess).toBe(true));
	await waitFor(() => expect(result.current.busy).toBe(true));
	expect(server.fetch).toHaveBeenCalledWith(
		path,
		expect.objectContaining({ method: "POST", body: "{}" }),
	);
	server.routes.set(`GET ${path}`, diagnostic("running"));
	await act(async () => {
		await client.invalidateQueries({ queryKey: ["diagnostics", "f1"] });
	});
	await waitFor(() => expect(result.current.query.data?.status).toBe("running"));
	server.routes.set(`GET ${path}`, diagnostic("success"));
	await waitFor(() => expect(result.current.busy).toBe(false), { timeout: 2000 });
	expect(result.current.query.data?.status).toBe("success");
	server.routes.set(`POST ${path}`, diagnostic("queued"));
	await act(async () => {
		await result.current.start.mutateAsync("https://new.example.com");
	});
	expect(server.fetch).toHaveBeenCalledWith(
		path,
		expect.objectContaining({ method: "POST", body: '{"siteUrl":"https://new.example.com"}' }),
	);
});

test("reopening completed diagnostics reuses the saved run until explicitly checked again", async () => {
	const server = transport();
	const path = "/api/feeds/f1/diagnostics";
	server.routes.set(`GET ${path}`, diagnostic("success"));
	server.routes.set(`POST ${path}`, { ...diagnostic("queued"), run_id: "next-run" });
	const { wrapper } = queryHarness();
	const first = renderHook(() => useDiagnosticViewModel("f1"), { wrapper });
	await waitFor(() => expect(first.result.current.query.isSuccess).toBe(true));
	expect(first.result.current.query.data?.run_id).toBe("run");
	expect(first.result.current.start.isIdle).toBe(true);
	first.unmount();
	const { result } = renderHook(() => useDiagnosticViewModel("f1"), { wrapper });
	await waitFor(() => expect(result.current.query.isSuccess).toBe(true));
	expect(result.current.query.data?.run_id).toBe("run");
	expect(result.current.busy).toBe(false);
	expect(server.fetch.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(0);
	await act(async () => {
		await result.current.start.mutateAsync(undefined);
	});
	await waitFor(() => expect(result.current.query.data?.run_id).toBe("next-run"));
	expect(server.fetch.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(1);
});

test("diagnostic query, queue and persisted report errors stay visible and retryable", async () => {
	const server = transport();
	const path = "/api/feeds/f1/diagnostics";
	server.routes.set(`GET ${path}`, async () =>
		Response.json({ error: "offline" }, { status: 503 }),
	);
	const { wrapper, client } = queryHarness();
	const { result } = renderHook(() => useDiagnosticViewModel("f1"), { wrapper });
	await waitFor(() => expect(result.current.error).toBe("offline"));
	server.routes.set(`GET ${path}`, { ...diagnostic("error"), error: "diagnostic timed out" });
	await act(async () => {
		await client.invalidateQueries({ queryKey: ["diagnostics", "f1"] });
	});
	await waitFor(() => expect(result.current.error).toBe("diagnostic timed out"));
	server.routes.set(`POST ${path}`, async () =>
		Response.json({ error: "queue unavailable" }, { status: 502 }),
	);
	await act(async () => {
		await expect(result.current.start.mutateAsync(undefined)).rejects.toThrow("queue unavailable");
	});
	await waitFor(() => expect(result.current.error).toBe("queue unavailable"));
	expect(result.current.busy).toBe(false);
});

test("directory loading and filtering stay in its view model", async () => {
	const server = transport();
	const gate = deferred<Response>();
	server.routes.set("GET /api/directory", () => gate.promise);
	const { wrapper } = queryHarness();
	const { result, rerender } = renderHook(({ search }) => useDirectoryViewModel(search), {
		wrapper,
		initialProps: { search: "engineering" },
	});
	expect(result.current.matches).toEqual([]);
	await act(async () =>
		gate.resolve(
			Response.json([
				{
					id: "a",
					title: "A",
					category: "Engineering",
					description: "Independent ideas",
					site_url: "https://example.com",
				},
				{
					id: "b",
					title: "B",
					category: "Other",
					description: "Writing",
					site_url: "https://else.example.com",
				},
			]),
		),
	);
	await waitFor(() => expect(result.current.matches.map((item) => item.id)).toEqual(["a"]));
	rerender({ search: "ELSE.EXAMPLE.COM" });
	expect(result.current.matches.map((item) => item.id)).toEqual(["b"]);
	rerender({ search: "missing" });
	expect(result.current.matches).toEqual([]);
});
