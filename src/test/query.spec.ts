import qs from "qs";
import { describe, expect, it } from "vitest";

import { buildQuery } from "../query";

describe("buildQuery", () => {
	const defaults = { defaultLocale: "en" };

	it("returns empty string for no params", () => {
		expect(buildQuery(undefined, defaults)).toBe("");
		expect(buildQuery({}, defaults)).toBe("");
	});

	it("serializes with qs indices format", () => {
		const params = { populate: ["author", "tags"], pagination: { page: 2, pageSize: 10 } };
		expect(buildQuery(params, defaults)).toBe(
			`?${qs.stringify(params, { arrayFormat: "indices", encode: true })}`
		);
	});

	it("adds locale when it differs from defaultLocale", () => {
		expect(buildQuery({}, { defaultLocale: "en", locale: "fr" })).toBe("?locale=fr");
	});

	it("drops locale equal to defaultLocale, including from params", () => {
		expect(buildQuery({ locale: "de" }, { defaultLocale: "de" })).toBe("");
		expect(buildQuery({}, { defaultLocale: "de", locale: "de" })).toBe("");
	});

	it("locale option wins over params.locale", () => {
		expect(buildQuery({ locale: "fr" }, { defaultLocale: "en", locale: "pt" })).toBe("?locale=pt");
	});

	it("keeps params.locale when no option given", () => {
		expect(buildQuery({ locale: "fr" }, defaults)).toBe("?locale=fr");
	});

	it("serializes status and publicationFilter", () => {
		expect(buildQuery({ status: "draft", publicationFilter: "modified" }, defaults)).toBe(
			"?status=draft&publicationFilter=modified"
		);
	});
});
