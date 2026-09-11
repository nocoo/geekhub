import type { AiStorageAdapter } from "@nocoo/next-ai";

export class ApiError extends Error {
	constructor(
		message: string,
		public status: number,
	) {
		super(message);
		this.name = "ApiError";
	}
}

export async function api<T>(
	path: string,
	options?: { method?: string; body?: unknown; signal?: AbortSignal },
): Promise<T> {
	const response = await fetch(`/api${path}`, {
		credentials: "same-origin",
		signal: options?.signal,
		method: options?.method ?? "GET",
		...(options?.body === undefined
			? {}
			: { headers: { "Content-Type": "application/json" }, body: JSON.stringify(options.body) }),
	});
	if (response.redirected || !response.headers.get("content-type")?.includes("application/json"))
		throw new ApiError("请重新通过 Cloudflare Access 登录", 401);
	const value = await response.json();
	if (!response.ok)
		throw new ApiError(
			typeof value === "object" &&
				value !== null &&
				"error" in value &&
				typeof value.error === "string"
				? value.error
				: "请求失败，请重试",
			response.status,
		);
	return value as T;
}

export const aiAdapter: AiStorageAdapter = {
	getSettings: () => api("/ai/settings"),
	saveSettings: (body) => api("/ai/settings", { method: "PATCH", body }),
	testConnection: (body) => api("/ai/test", { method: "POST", body }),
};
