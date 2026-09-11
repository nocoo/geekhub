import { HTTPException } from "hono/http-exception";

export function fail(
	status: 400 | 401 | 403 | 404 | 409 | 413 | 422 | 429 | 502 | 503,
	message: string,
): never {
	throw new HTTPException(status, { message });
}

export function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : "未知错误";
}
