import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";

import { Strapi } from "../index";
import { isValidationDetails, validationIssues, type StrapiValidationIssue } from "../errors";
import { installFetchMock, type FetchMock } from "./helpers";

const body = (details: unknown) =>
	new Response(JSON.stringify({ data: null, error: { status: 400, name: "ValidationError", message: "2 errors occurred", details } }), {
		status: 400,
		headers: { "content-type": "application/json" },
	});

const issues = [
	{ path: ["title"], message: "title must be defined", name: "ValidationError" },
	{ path: ["seo", "metaTitle"], message: "metaTitle is required", name: "ValidationError", value: null },
];

describe("isValidationDetails", () => {
	it("recognises what Strapi puts in a validation error", () => {
		expect(isValidationDetails({ errors: issues })).toBe(true);
		expect(isValidationDetails({ errors: [] })).toBe(true);
	});

	it.each([
		["null", null],
		["undefined", undefined],
		["a string", "nope"],
		["an array", [issues]],
		["an object with no errors", { source: "query", param: "publicationFilter" }],
		["errors that are not a list", { errors: "title is required" }],
		["an entry with no message", { errors: [{ path: ["title"], name: "ValidationError" }] }],
		["an entry whose path is not a list", { errors: [{ path: "title", message: "m", name: "n" }] }],
		["an entry that is not an object", { errors: ["title is required"] }],
		["an entry that is null", { errors: [null] }],
	])("rejects %s", (_label, value) => {
		expect(isValidationDetails(value)).toBe(false);
	});
});

describe("validationIssues", () => {
	it("pulls the field errors out of an error", () => {
		const found = validationIssues({ name: "ValidationError", message: "2 errors occurred", details: { errors: issues } });
		expect(found).toHaveLength(2);
		expect(found[0]?.path).toEqual(["title"]);
		expectTypeOf(found).toEqualTypeOf<StrapiValidationIssue[]>();
	});

	it("is empty for anything else", () => {
		expect(validationIssues(null)).toEqual([]);
		expect(validationIssues(undefined)).toEqual([]);
		expect(validationIssues({ name: "ForbiddenError", message: "Forbidden" })).toEqual([]);
		expect(validationIssues({ name: "ValidationError", message: "x", details: { source: "query" } })).toEqual([]);
	});
});

describe("a failed write", () => {
	let fetchMock: FetchMock;

	beforeEach(() => {
		fetchMock = installFetchMock();
	});
	afterEach(() => vi.restoreAllMocks());

	it("carries the field errors through to the caller", async () => {
		fetchMock.mockResolvedValueOnce(body({ errors: issues }));
		const strapi = new Strapi({ baseURL: "http://h", defaultLocale: "en" });
		const [err] = await strapi.collection<{ title: string }>("articles").create({ payload: { data: {} } });

		expect(err?.name).toBe("ValidationError");
		expect(validationIssues(err).map((issue) => issue.path.join("."))).toEqual(["title", "seo.metaTitle"]);
	});

	it("leaves details Strapi shaped differently alone", async () => {
		fetchMock.mockResolvedValueOnce(body({ source: "query", param: "publicationFilter" }));
		const strapi = new Strapi({ baseURL: "http://h", defaultLocale: "en" });
		const [err] = await strapi.collection("articles").findMany();

		expect(validationIssues(err)).toEqual([]);
		expect(err?.details).toEqual({ source: "query", param: "publicationFilter" });
	});
});
