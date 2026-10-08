import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HttpClient } from "../http";
import type { RetryOptions } from "../retry";
import { installFetchMock, jsonResponse, type FetchMock } from "./helpers";

/** Resolves `work` while letting every backoff timer fire at once. */
async function withTimers<T>(work: Promise<T>): Promise<T> {
	await vi.advanceTimersByTimeAsync(120_000);
	return work;
}

describe("HttpClient with retry", () => {
	let fetchMock: FetchMock;

	beforeEach(() => {
		fetchMock = installFetchMock();
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	const client = (retry?: number | RetryOptions) =>
		new HttpClient({ baseURL: "http://h", ...(retry !== undefined && { retry }) });

	it("does not retry unless asked to", async () => {
		fetchMock.mockResolvedValue(new Response("nope", { status: 503 }));
		const [err] = await withTimers(client().request("articles"));
		expect(err?.status).toBe(503);
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it("returns the attempt that worked", async () => {
		fetchMock
			.mockResolvedValueOnce(new Response("nope", { status: 503 }))
			.mockResolvedValueOnce(jsonResponse({ data: [{ id: 1 }] }));
		const [err, body] = await withTimers(client({ attempts: 2, delay: 10 }).request<{ data: unknown[] }>("articles"));
		expect(err).toBeNull();
		expect(body?.data).toHaveLength(1);
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it("gives up after the configured attempts and reports the last failure", async () => {
		fetchMock.mockResolvedValue(new Response("nope", { status: 500 }));
		const [err] = await withTimers(client({ attempts: 2, delay: 10 }).request("articles"));
		expect(err?.status).toBe(500);
		expect(fetchMock).toHaveBeenCalledTimes(3);
	});

	it("waits what Retry-After asks for, and says so", async () => {
		const waits: { attempt: number; delay: number; status: number | null }[] = [];
		fetchMock
			.mockResolvedValueOnce(new Response("slow down", { status: 429, headers: { "retry-after": "2" } }))
			.mockResolvedValueOnce(jsonResponse({ data: [] }));
		const [err] = await withTimers(
			client({ attempts: 2, delay: 10, onRetry: (info) => waits.push(info) }).request("articles")
		);
		expect(err).toBeNull();
		expect(waits).toEqual([{ attempt: 1, delay: 2000, status: 429 }]);
	});

	it("retries a request that never reached the server", async () => {
		fetchMock.mockRejectedValueOnce(new TypeError("fetch failed")).mockResolvedValueOnce(jsonResponse({ data: [] }));
		const [err] = await withTimers(client({ attempts: 1, delay: 10 }).request("articles"));
		expect(err).toBeNull();
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it("leaves a POST alone by default, and repeats one when asked", async () => {
		fetchMock.mockResolvedValue(new Response("nope", { status: 503 }));
		await withTimers(client({ attempts: 3, delay: 10 }).request("articles", { method: "POST" }));
		expect(fetchMock).toHaveBeenCalledTimes(1);

		fetchMock.mockClear();
		fetchMock
			.mockResolvedValueOnce(new Response("nope", { status: 429 }))
			.mockResolvedValueOnce(jsonResponse({ data: {} }));
		const [err] = await withTimers(
			client({ attempts: 2, delay: 10, methods: ["POST"] }).request("articles", { method: "POST" })
		);
		expect(err).toBeNull();
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it("takes a plain number as the attempt count", async () => {
		fetchMock.mockResolvedValueOnce(new Response("nope", { status: 503 })).mockResolvedValueOnce(jsonResponse({ data: [] }));
		const [err] = await withTimers(client(1).request("articles"));
		expect(err).toBeNull();
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it("stops when the caller aborts while it is waiting", async () => {
		const controller = new AbortController();
		fetchMock.mockImplementation(() => {
			controller.abort();
			return Promise.resolve(new Response("nope", { status: 503 }));
		});
		const [err] = await withTimers(client({ attempts: 5, delay: 1000 }).request("articles", { signal: controller.signal }));
		expect(err?.status).toBe(503);
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it("gives the timeout to each attempt, not to all of them together", async () => {
		fetchMock
			.mockResolvedValueOnce(new Response("nope", { status: 503 }))
			.mockResolvedValueOnce(jsonResponse({ data: [] }));
		const [err] = await withTimers(
			new HttpClient({ baseURL: "http://h", timeout: 50, retry: { attempts: 1, delay: 100 } }).request("articles")
		);
		expect(err).toBeNull();
	});
});
