import { vi } from "vitest";

import type { StrapiErrorBody } from "../types";

export function jsonResponse(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "content-type": "application/json" },
	});
}

export function emptyResponse(status = 204): Response {
	return new Response(null, { status });
}

export function errorResponse(status: number, name: string, message: string, details: unknown = {}): Response {
	const body: StrapiErrorBody = { data: null, error: { status, name, message, details } };
	return jsonResponse(body, status);
}

export function textResponse(text: string, status = 500): Response {
	return new Response(text, { status, headers: { "content-type": "text/plain" } });
}

export type FetchMock = ReturnType<typeof vi.fn<typeof fetch>>;

export function installFetchMock(): FetchMock {
	const mock = vi.fn<typeof fetch>();
	vi.stubGlobal("fetch", mock);
	return mock;
}

/** URL and init of the most recent fetch call. */
export function lastCall(mock: FetchMock): { url: string; init: RequestInit } {
	const call = mock.mock.calls.at(-1);
	if (!call) throw new Error("fetch was not called");
	const [input, init] = call;
	return { url: String(input), init: init ?? {} };
}

/** Header value from a RequestInit regardless of headers representation. */
export function headerOf(init: RequestInit, name: string): string | null {
	return new Headers(init.headers).get(name);
}
