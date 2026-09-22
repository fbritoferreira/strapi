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

/**
 * Reads an OpenAPI document from a file or URL. Strapi writes one with
 * `strapi openapi generate`, and the documentation plugin serves one at
 * `/documentation/v1.0.0/full_documentation.json`.
 */
export async function loadOpenapi(options: OpenapiSource): Promise<OpenApiDocument> {
	const text = await readSource(options);
	let parsed: unknown;
	try {
		// Typed boundary: parsed JSON of unknown shape, narrowed by assertDocument.
		parsed = JSON.parse(text) as unknown;
	} catch (error) {
		throw new Error(`${options.source} is not valid JSON: ${(error as Error).message}`, { cause: error });
	}
	assertDocument(parsed, options.source);
	return parsed;
}
