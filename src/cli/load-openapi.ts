import { readFile } from "node:fs/promises";

import type { OpenApiDocument } from "./openapi";

/** Where to read the document from, and how. */
export interface OpenapiSource {
	/** A file path, or an `http(s)` URL. */
	source: string;
	/** Bearer token sent when `source` is a URL. */
	token?: string;
	fetch?: typeof fetch;
}

function isHttp(source: string): boolean {
	return /^https?:\/\//i.test(source);
}

async function readSource(options: OpenapiSource): Promise<string> {
	if (!isHttp(options.source)) return readFile(options.source, "utf8");
	const fetchImpl = options.fetch ?? fetch;
	const response = await fetchImpl(options.source, {
		method: "GET",
		headers: options.token === undefined ? {} : { Authorization: `Bearer ${options.token}` },
	});
	if (!response.ok) {
		throw new Error(`GET ${options.source} failed (${response.status}): ${response.statusText || "unknown error"}`);
	}
	return response.text();
}

function assertDocument(value: unknown, source: string): asserts value is OpenApiDocument {
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		throw new Error(`${source} is not an OpenAPI 3 document (expected a JSON object)`);
	}
	const document = value as Record<string, unknown>;
	if (typeof document["openapi"] !== "string" || !document["openapi"].startsWith("3.")) {
		throw new Error(`${source} is not an OpenAPI 3 document (no "openapi": "3.x" field)`);
	}
	if (typeof document["paths"] !== "object" || document["paths"] === null) {
		throw new Error(`${source} has no paths object`);
	}
}

/** Where the documentation plugin's Swagger UI page inlines its document. */
const INLINE_SPEC = "spec:";

/**
 * Pulls the document out of a Swagger UI page.
 *
 * The documentation plugin renders `SwaggerUIBundle({ spec: { … } })` rather
 * than serving the JSON, so the object is matched by counting braces, skipping
 * any that sit inside a string.
 *
 * @returns the JSON text of the document, or `null` when the page has none.
 */
function inlineSpec(text: string): string | null {
	const marker = text.indexOf(INLINE_SPEC);
	if (marker === -1) return null;
	const start = text.indexOf("{", marker);
	if (start === -1) return null;

	let depth = 0;
	let inString = false;
	let escaped = false;
	for (let index = start; index < text.length; index += 1) {
		const character = text[index];
		if (inString) {
			if (escaped) escaped = false;
			else if (character === "\\") escaped = true;
			else if (character === '"') inString = false;
			continue;
		}
		if (character === '"') inString = true;
		else if (character === "{") depth += 1;
		else if (character === "}") {
			depth -= 1;
			if (depth === 0) return text.slice(start, index + 1);
		}
	}
	return null;
}

/**
 * Reads an OpenAPI document from a file or URL.
 *
 * Accepts the JSON `strapi openapi generate` writes, the JSON the documentation
 * plugin serves at `/documentation/v1.0.0/full_documentation.json`, and that
 * plugin's Swagger UI page itself (`/documentation/v1.0.0`), which inlines the
 * document instead of serving it.
 */
export async function loadOpenapi(options: OpenapiSource): Promise<OpenApiDocument> {
	const text = await readSource(options);
	let parsed: unknown;
	try {
		// Typed boundary: parsed JSON of unknown shape, narrowed by assertDocument.
		parsed = JSON.parse(text) as unknown;
	} catch (error) {
		const inlined = inlineSpec(text);
		if (inlined === null) {
			throw new Error(`${options.source} is not valid JSON: ${(error as Error).message}`, { cause: error });
		}
		try {
			parsed = JSON.parse(inlined) as unknown;
		} catch (inlineError) {
			throw new Error(`${options.source} has a spec that is not valid JSON: ${(inlineError as Error).message}`, { cause: inlineError });
		}
	}
	assertDocument(parsed, options.source);
	return parsed;
}
