import { describe, expect, it } from "vitest";

import { mapWithConcurrency } from "../pool";

describe("mapWithConcurrency", () => {
	it("returns results in input order", async () => {
		const out = await mapWithConcurrency([30, 10, 20], 3, async (ms) => {
			await new Promise((r) => setTimeout(r, ms));
			return ms;
		});
		expect(out).toEqual([30, 10, 20]);
	});

	it("never runs more than limit at once", async () => {
		let running = 0;
		let peak = 0;
		await mapWithConcurrency(Array.from({ length: 10 }, (_, i) => i), 3, async () => {
			running += 1;
			peak = Math.max(peak, running);
			await new Promise((r) => setTimeout(r, 5));
			running -= 1;
		});
		expect(peak).toBe(3);
	});

	it("handles empty input", async () => {
		expect(await mapWithConcurrency([], 4, async (x: number) => x)).toEqual([]);
	});

	it("rejects when a task rejects", async () => {
		await expect(
			mapWithConcurrency([1, 2], 2, async (n) => {
				if (n === 2) throw new Error("bad");
				return n;
			})
		).rejects.toThrow("bad");
	});

	it("treats limit below 1 as 1", async () => {
		let peak = 0;
		let running = 0;
		await mapWithConcurrency([1, 2, 3], 0, async () => {
			running += 1;
			peak = Math.max(peak, running);
			await Promise.resolve();
			running -= 1;
		});
		expect(peak).toBe(1);
	});
});
