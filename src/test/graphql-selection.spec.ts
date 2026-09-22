import { describe, expectTypeOf, it } from "vitest";

import type { SelectedResult, SelectionFor } from "../types";

interface Author {
	name: string;
	email: string | null;
}

interface Article {
	documentId: string;
	title: string;
	views: number | null;
	author: Author | null;
	tags: { label: string }[];
}

describe("SelectionFor", () => {
	it("takes true for a scalar and a nested map for an object", () => {
		const selection: SelectionFor<Article> = { documentId: true, author: { name: true }, tags: { label: true } };
		expectTypeOf(selection).toEqualTypeOf<SelectionFor<Article>>();
	});

	it("refuses a field the type does not have", () => {
		// @ts-expect-error nope is not on Article
		const selection: SelectionFor<Article> = { nope: true };
		expectTypeOf(selection).toEqualTypeOf<SelectionFor<Article>>();
	});

	it("refuses a nested map on a scalar", () => {
		// @ts-expect-error title is a string; there is nothing to descend into
		const selection: SelectionFor<Article> = { title: { length: true } };
		expectTypeOf(selection).toEqualTypeOf<SelectionFor<Article>>();
	});
});

describe("SelectedResult", () => {
	it("keeps only the selected fields of a list result", () => {
		expectTypeOf<SelectedResult<Article[], { documentId: true; title: true }>>().toEqualTypeOf<
			{ documentId: string; title: string }[]
		>();
	});

	it("keeps the nullability of a single result", () => {
		expectTypeOf<SelectedResult<Article | null, { title: true }>>().toEqualTypeOf<{ title: string } | null>();
	});

	it("descends into a nested selection, keeping the relation's own nullability", () => {
		expectTypeOf<SelectedResult<Article[], { author: { name: true } }>>().toEqualTypeOf<
			{ author: { name: string } | null }[]
		>();
	});

	it("maps a list relation element-wise", () => {
		expectTypeOf<SelectedResult<Article[], { tags: { label: true } }>>().toEqualTypeOf<{ tags: { label: string }[] }[]>();
	});

	it("keeps a scalar's own nullability", () => {
		expectTypeOf<SelectedResult<Article[], { views: true }>>().toEqualTypeOf<{ views: number | null }[]>();
	});
});
