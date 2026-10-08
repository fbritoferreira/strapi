import { describe, expect, it, vi } from "vitest";

import { backoffFor, resolveRetry, retryAfterMs, shouldRetry } from "../retry";

describe("resolveRetry", () => {
	it("is off unless asked for", () => {
		expect(resolveRetry(undefined)).toBeNull();
		expect(resolveRetry(0)).toBeNull();
	});

	it("reads a plain attempt count", () => {
		expect(resolveRetry(3)).toMatchObject({ attempts: 3, methods: ["GET", "HEAD", "OPTIONS"], network: true });
	});

	it("keeps only idempotent methods by default", () => {
		expect(resolveRetry({ attempts: 1 })?.methods).toEqual(["GET", "HEAD", "OPTIONS"]);
		expect(resolveRetry({ attempts: 1, methods: ["get", "post"] })?.methods).toEqual(["GET", "POST"]);
	});

	it("defaults the statuses to the ones worth repeating", () => {
		expect(resolveRetry(1)?.statuses).toEqual([408, 429, 500, 502, 503, 504]);
	});
});

describe("shouldRetry", () => {
	const retry = resolveRetry(2)!;

	it("repeats a 503 on a GET", () => {
		expect(shouldRetry(retry, "GET", 503, 0)).toBe(true);
	});

	it("leaves a 404 alone", () => {
		expect(shouldRetry(retry, "GET", 404, 0)).toBe(false);
	});

	it("leaves a POST alone, since repeating it could create twice", () => {
		expect(shouldRetry(retry, "POST", 503, 0)).toBe(false);
	});

	it("repeats a POST when the caller asked for it", () => {
		expect(shouldRetry(resolveRetry({ attempts: 2, methods: ["POST"] })!, "POST", 503, 0)).toBe(true);
	});

	it("stops once the attempts are used up", () => {
		expect(shouldRetry(retry, "GET", 503, 2)).toBe(false);
	});

	it("repeats a network failure, where there is no status", () => {
		expect(shouldRetry(retry, "GET", null, 0)).toBe(true);
		expect(shouldRetry(resolveRetry({ attempts: 2, network: false })!, "GET", null, 0)).toBe(false);
	});
});

describe("retryAfterMs", () => {
	it("reads seconds", () => {
		expect(retryAfterMs(new Headers({ "retry-after": "2" }), Date.now())).toBe(2000);
	});

	it("reads an HTTP date", () => {
		const now = Date.parse("2026-09-23T10:00:00.000Z");
		expect(retryAfterMs(new Headers({ "retry-after": "Wed, 23 Sep 2026 10:00:03 GMT" }), now)).toBe(3000);
	});

	it("treats a past date as no wait", () => {
		const now = Date.parse("2026-09-23T10:00:00.000Z");
		expect(retryAfterMs(new Headers({ "retry-after": "Wed, 23 Sep 2026 09:59:00 GMT" }), now)).toBe(0);
	});

	it("ignores a header that is neither", () => {
		expect(retryAfterMs(new Headers({ "retry-after": "soon" }), Date.now())).toBeNull();
		expect(retryAfterMs(new Headers(), Date.now())).toBeNull();
	});
});

describe("backoffFor", () => {
	const retry = resolveRetry({ attempts: 4, delay: 100, maxDelay: 1000 })!;

	it("doubles each attempt", () => {
		expect(backoffFor(retry, 0, null)).toBe(100);
		expect(backoffFor(retry, 1, null)).toBe(200);
		expect(backoffFor(retry, 2, null)).toBe(400);
	});

	it("never waits longer than maxDelay", () => {
		expect(backoffFor(retry, 9, null)).toBe(1000);
	});

	it("prefers Retry-After when the server sent one", () => {
		expect(backoffFor(retry, 0, 750)).toBe(750);
	});

	it("spreads the wait when jitter is on", () => {
		const jittered = resolveRetry({ attempts: 2, delay: 100, jitter: true })!;
		const random = vi.spyOn(Math, "random");

		random.mockReturnValue(0);
		expect(backoffFor(jittered, 0, null)).toBe(50);
		random.mockReturnValue(0.999);
		expect(backoffFor(jittered, 0, null)).toBe(100);
		random.mockRestore();
	});

	it("caps Retry-After too", () => {
		expect(backoffFor(retry, 0, 60_000)).toBe(1000);
	});
});
