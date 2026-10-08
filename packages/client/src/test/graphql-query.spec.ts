import { describe, expect, it } from "vitest";

import { buildOperation, renderSelection } from "../graphql-query";

describe("renderSelection", () => {
	it("lists the fields asked for", () => {
		expect(renderSelection({ documentId: true, title: true })).toBe("documentId title");
	});

	it("skips what was turned off", () => {
		expect(renderSelection({ documentId: true, title: false })).toBe("documentId");
	});

	it("nests an object selection", () => {
		expect(renderSelection({ title: true, author: { name: true } })).toBe("title author { name }");
	});

	it("nests as deep as it is given", () => {
		expect(renderSelection({ a: { b: { c: true } } })).toBe("a { b { c } }");
	});

	it("refuses an empty selection, which GraphQL cannot express", () => {
		expect(() => renderSelection({})).toThrow(/at least one field/);
		expect(() => renderSelection({ author: {} })).toThrow(/at least one field/);
	});
});

describe("buildOperation", () => {
	const argTypes = { filters: "ArticleFiltersInput", locale: "I18NLocaleCode", documentId: "ID!" };

	it("builds a query with no arguments", () => {
		expect(buildOperation("query", "articles", {}, { documentId: true }, argTypes)).toEqual({
			query: "query Articles { articles { documentId } }",
			variables: {},
		});
	});

	it("declares each argument as a variable of its schema type", () => {
		const built = buildOperation(
			"query",
			"articles",
			{ locale: "fr", filters: { title: { eq: "Hi" } } },
			{ documentId: true, title: true },
			argTypes
		);
		expect(built.query).toBe(
			"query Articles($locale: I18NLocaleCode, $filters: ArticleFiltersInput) " +
				"{ articles(locale: $locale, filters: $filters) { documentId title } }"
		);
		expect(built.variables).toEqual({ locale: "fr", filters: { title: { eq: "Hi" } } });
	});

	it("names a mutation as one", () => {
		const built = buildOperation("mutation", "createArticle", { data: { title: "A" } }, { documentId: true }, { data: "ArticleInput!" });
		expect(built.query).toBe("mutation CreateArticle($data: ArticleInput!) { createArticle(data: $data) { documentId } }");
	});

	it("leaves out an argument that was not passed", () => {
		const built = buildOperation("query", "articles", { locale: undefined }, { documentId: true }, argTypes);
		expect(built.query).toBe("query Articles { articles { documentId } }");
		expect(built.variables).toEqual({});
	});

	it("refuses an argument the schema does not declare", () => {
		expect(() => buildOperation("query", "articles", { nope: 1 }, { documentId: true }, argTypes)).toThrow(/nope/);
	});
});
