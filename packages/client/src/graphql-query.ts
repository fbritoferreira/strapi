/** Builds a GraphQL document from a root field, its arguments and a selection. */

/** A field selection: `true` to take a field, a nested map to descend into one. */
export interface Selection {
	[field: string]: boolean | Selection;
}

/** The document and variables to POST. */
export interface BuiltOperation {
	query: string;
	variables: Record<string, unknown>;
}

/** Renders `{ a: true, b: { c: true } }` as `a b { c }`. */
export function renderSelection(selection: Selection): string {
	const parts: string[] = [];
	for (const [field, value] of Object.entries(selection)) {
		if (value === false) continue;
		parts.push(value === true ? field : `${field} { ${renderSelection(value)} }`);
	}
	if (parts.length === 0) {
		throw new TypeError("Strapi: a GraphQL selection needs at least one field");
	}
	return parts.join(" ");
}

function operationName(field: string): string {
	return field.charAt(0).toUpperCase() + field.slice(1);
}

/**
 * Builds one operation.
 *
 * Arguments travel as variables rather than inline literals: the server then
 * parses them as JSON, so a string that looks like an enum stays a string and
 * nothing has to be escaped by hand.
 *
 * @param argTypes the GraphQL type of each argument the field declares, from
 * the generated schema.
 * @throws {TypeError} when an argument is not one the field declares.
 */
export function buildOperation(
	operation: "query" | "mutation",
	field: string,
	args: Record<string, unknown>,
	selection: Selection,
	argTypes: Record<string, string>
): BuiltOperation {
	const passed = Object.entries(args).filter(([, value]) => value !== undefined);

	for (const [name] of passed) {
		if (argTypes[name] === undefined) {
			throw new TypeError(`Strapi: "${field}" takes no argument named "${name}"`);
		}
	}

	const declarations = passed.map(([name]) => `$${name}: ${argTypes[name]}`).join(", ");
	const callArgs = passed.map(([name]) => `${name}: $${name}`).join(", ");
	const header = declarations === "" ? "" : `(${declarations})`;
	const call = callArgs === "" ? "" : `(${callArgs})`;

	return {
		query: `${operation} ${operationName(field)}${header} { ${field}${call} { ${renderSelection(selection)} } }`,
		variables: Object.fromEntries(passed),
	};
}
