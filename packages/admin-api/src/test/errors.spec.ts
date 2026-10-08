import { describe, expect, it } from "vitest";

import { fail, ok } from "../errors";

describe("ok", () => {
	it("returns [null, data, meta]", () => {
		expect(ok([1, 2], { pagination: { page: 1, pageSize: 25, pageCount: 1, total: 2 } })).toEqual([
			null,
			[1, 2],
			{ pagination: { page: 1, pageSize: 25, pageCount: 1, total: 2 } },
		]);
	});

	it("defaults meta to null", () => {
		expect(ok("x")).toEqual([null, "x", null]);
	});
});

describe("fail", () => {
	it("returns [error, null, null]", () => {
		const error = { message: "boom", status: 500 };
		expect(fail(error)).toEqual([error, null, null]);
	});
});
