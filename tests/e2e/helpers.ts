/**
 * E2E Helpers — Shared utilities for API E2E tests.
 */

import { BASE_URL } from "./setup";

/** Standard headers for JSON API requests */
const JSON_HEADERS = {
  "Content-Type": "application/json",
} as const;

/**
 * Typed fetch wrapper against the E2E dev server.
 * Prepends BASE_URL and sets JSON content-type when body is provided.
 */
export async function api(
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const url = `${BASE_URL}${path}`;
  const headers: Record<string, string> = {
    ...(options.body ? JSON_HEADERS : {}),
    ...((options.headers as Record<string, string>) ?? {}),
  };
  return fetch(url, { ...options, headers });
}

/** Shorthand for GET requests */
export function apiGet(path: string): Promise<Response> {
  return api(path, { method: "GET" });
}

/** Shorthand for POST requests with JSON body */
export function apiPost(
  path: string,
  body: unknown,
): Promise<Response> {
  return api(path, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/** Shorthand for PUT requests with JSON body */
export function apiPut(
  path: string,
  body: unknown,
): Promise<Response> {
  return api(path, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

/** Shorthand for DELETE requests */
export function apiDelete(path: string): Promise<Response> {
  return api(path, { method: "DELETE" });
}

/** Parse SSE events from a ReadableStream with timeout */
export async function readSSEEvents(
  path: string,
  maxEvents: number,
  timeoutMs = 5000,
): Promise<string[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await api(path, { signal: controller.signal });
    if (!response.body) throw new Error("No response body for SSE");

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    const events: string[] = [];

    while (events.length < maxEvents) {
      const { value, done } = await reader.read();
      if (done) break;
      const text = decoder.decode(value, { stream: true });
      // Parse SSE event names: lines starting with "event:"
      for (const line of text.split("\n")) {
        const match = line.match(/^event:\s*(.+)/);
        if (match) {
          events.push(match[1].trim());
        }
      }
    }

    reader.cancel();
    return events;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Assert response is JSON and return parsed body.
 * Throws with status + text if response is not ok.
 */
export async function expectJson<T = unknown>(
  response: Response,
  expectedStatus = 200,
): Promise<T> {
  if (response.status !== expectedStatus) {
    const text = await response.text();
    throw new Error(
      `Expected status ${expectedStatus} but got ${response.status}: ${text}`,
    );
  }
  return response.json() as Promise<T>;
}
