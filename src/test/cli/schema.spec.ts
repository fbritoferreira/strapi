import { describe, expect, it } from "vitest";

import { isApiUid, isLocalized, isPlainObject, MEDIA_UID, USER_UID } from "../../cli/schema";

describe("schema helpers", () => {
	it("recognizes api uids", () => {
		expect(isApiUid("api::article.article")).toBe(true);
		expect(isApiUid(MEDIA_UID)).toBe(false);
		expect(isApiUid(USER_UID)).toBe(false);
	});

	it("reads i18n localized flag", () => {
		const base = { kind: "collectionType" as const, info: { singularName: "a", pluralName: "as", displayName: "A" }, attributes: {} };
		expect(isLocalized(base)).toBe(false);
		expect(isLocalized({ ...base, pluginOptions: { i18n: { localized: true } } })).toBe(true);
		expect(isLocalized({ ...base, pluginOptions: { i18n: { localized: false } } })).toBe(false);
	});

	it("recognizes plain objects", () => {
		expect(isPlainObject({})).toBe(true);
		expect(isPlainObject(null)).toBe(false);
		expect(isPlainObject([])).toBe(false);
		expect(isPlainObject("x")).toBe(false);
		expect(isPlainObject(1)).toBe(false);
	});
});
