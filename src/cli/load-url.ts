import type { ComponentEntry, ContentTypeEntry, RawAttribute, RawComponentSchema, RawContentTypeSchema, SchemaSet } from "./schema";

export interface UrlSource {
	baseURL: string;
	email: string;
	password: string;
	fetch?: typeof fetch;
}

const PERMISSION = "plugin::content-type-builder.read";

interface BuilderContentTypeSchema {
	displayName: string;
	singularName: string;
	pluralName: string;
	description?: string;
	kind: "collectionType" | "singleType";
	collectionName?: string;
	options?: Record<string, unknown>;
	pluginOptions?: RawContentTypeSchema["pluginOptions"];
	attributes?: Record<string, RawAttribute>;
}

interface BuilderContentType {
	uid: string;
	// plugin?: string — present on plugin-owned content types (e.g. "users-permissions"), unused here.
	apiID: string;
	schema: BuilderContentTypeSchema;
}

interface BuilderComponentSchema {
	displayName: string;
	description?: string;
	icon?: string;
	collectionName?: string;
	options?: Record<string, unknown>;
	attributes?: Record<string, RawAttribute>;
}

interface BuilderComponent {
	uid: string;
	category: string;
	apiId: string;
	schema: BuilderComponentSchema;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

function normalizeBase(baseURL: string): string {
	return baseURL.trim().replace(/\/+$/, "").replace(/\/api$/, "");
}

async function readBody(response: Response): Promise<unknown> {
	const text = await response.text();
	if (text === "") return null;
	try {
		// Typed boundary: parsed JSON of unknown shape, narrowed by callers below.
		return JSON.parse(text) as unknown;
	} catch {
		return text;
	}
}

function errorMessage(body: unknown, response: Response): string {
	if (isPlainObject(body) && isPlainObject(body["error"]) && typeof body["error"]["message"] === "string") {
		return body["error"]["message"];
	}
	return response.statusText || "unknown error";
}

async function getJson(fetchImpl: typeof fetch, url: string, token: string): Promise<unknown> {
	const response = await fetchImpl(url, { method: "GET", headers: { Authorization: `Bearer ${token}` } });
	const body = await readBody(response);
	if (response.status === 401 || response.status === 403) {
		throw new Error(`GET ${url} returned ${response.status}; the admin user needs the permission ${PERMISSION}`);
	}
	if (!response.ok) {
		throw new Error(`GET ${url} failed (${response.status}): ${errorMessage(body, response)}`);
	}
	return body;
}

function dataArray(body: unknown, url: string): unknown[] {
	if (isPlainObject(body) && Array.isArray(body["data"])) {
		return body["data"];
	}
	throw new Error(`Unexpected response from ${url}: expected { data: [...] }`);
}

function describeUid(item: unknown): string {
	return isPlainObject(item) && typeof item["uid"] === "string" && item["uid"] !== "" ? item["uid"] : "<item without a uid>";
}

function validateContentType(raw: unknown, ctUrl: string): BuilderContentType {
	const label = describeUid(raw);
	if (!isPlainObject(raw) || typeof raw["uid"] !== "string" || raw["uid"] === "") {
		throw new Error(`Unexpected content type in ${ctUrl}: ${label} has no uid`);
	}
	if (!isPlainObject(raw["schema"])) {
		throw new Error(`Unexpected content type in ${ctUrl}: ${label} has no schema object`);
	}
	const schema = raw["schema"];
	const kind = schema["kind"];
	if (kind !== "collectionType" && kind !== "singleType") {
		throw new Error(`Unexpected content type in ${ctUrl}: ${label} has kind "${String(kind)}"`);
	}
	if (typeof schema["singularName"] !== "string") {
		throw new Error(`Unexpected content type in ${ctUrl}: ${label} has no singularName`);
	}
	if (typeof schema["pluralName"] !== "string") {
		throw new Error(`Unexpected content type in ${ctUrl}: ${label} has no pluralName`);
	}
	if (typeof schema["displayName"] !== "string") {
		throw new Error(`Unexpected content type in ${ctUrl}: ${label} has no displayName`);
	}
	// Typed boundary: uid, schema, schema.kind, schema.singularName, schema.pluralName and schema.displayName were validated above.
	return raw as unknown as BuilderContentType;
}

function validateComponent(raw: unknown, compUrl: string): BuilderComponent {
	const label = describeUid(raw);
	if (!isPlainObject(raw) || typeof raw["uid"] !== "string" || raw["uid"] === "") {
		throw new Error(`Unexpected component in ${compUrl}: ${label} has no uid`);
	}
	if (typeof raw["category"] !== "string") {
		throw new Error(`Unexpected component in ${compUrl}: ${label} has no category`);
	}
	if (!isPlainObject(raw["schema"])) {
		throw new Error(`Unexpected component in ${compUrl}: ${label} has no schema object`);
	}
	if (typeof raw["schema"]["displayName"] !== "string") {
		throw new Error(`Unexpected component in ${compUrl}: ${label} has no displayName`);
	}
	// Typed boundary: uid, category, schema and schema.displayName were validated above.
	return raw as unknown as BuilderComponent;
}

export async function loadFromUrl(source: UrlSource): Promise<SchemaSet> {
	const fetchImpl = source.fetch ?? ((input: RequestInfo | URL, init?: RequestInit) => globalThis.fetch(input, init));
	const base = normalizeBase(source.baseURL);

	const loginUrl = `${base}/admin/login`;
	const loginResponse = await fetchImpl(loginUrl, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ email: source.email, password: source.password }),
	});
	const loginBody = await readBody(loginResponse);
	if (!loginResponse.ok) {
		throw new Error(`Admin login failed (${loginResponse.status}): ${errorMessage(loginBody, loginResponse)}`);
	}
	const token = isPlainObject(loginBody) && isPlainObject(loginBody["data"]) ? loginBody["data"]["token"] : undefined;
	if (typeof token !== "string" || token === "") {
		throw new Error(`Admin login succeeded but the response has no data.token (${loginUrl})`);
	}

	const ctUrl = `${base}/content-type-builder/content-types`;
	const compUrl = `${base}/content-type-builder/components`;
	const [ctBody, compBody] = await Promise.all([getJson(fetchImpl, ctUrl, token), getJson(fetchImpl, compUrl, token)]);

	const contentTypes = new Map<string, ContentTypeEntry>();
	for (const raw of dataArray(ctBody, ctUrl)) {
		const item = validateContentType(raw, ctUrl);
		const { displayName, singularName, pluralName, description, kind, collectionName, options, pluginOptions, attributes } = item.schema;
		const schema: RawContentTypeSchema = {
			kind,
			...(collectionName !== undefined && { collectionName }),
			...(options !== undefined && { options }),
			...(pluginOptions !== undefined && { pluginOptions }),
			attributes: attributes ?? {},
			info: { singularName, pluralName, displayName, ...(description !== undefined && { description }) },
		};
		contentTypes.set(item.uid, { uid: item.uid, schema });
	}

	const components = new Map<string, ComponentEntry>();
	for (const raw of dataArray(compBody, compUrl)) {
		const item = validateComponent(raw, compUrl);
		const { displayName, description, icon, collectionName, options, attributes } = item.schema;
		const schema: RawComponentSchema = {
			...(collectionName !== undefined && { collectionName }),
			...(options !== undefined && { options }),
			attributes: attributes ?? {},
			info: { displayName, ...(icon !== undefined && { icon }), ...(description !== undefined && { description }) },
		};
		components.set(item.uid, { uid: item.uid, category: item.category, schema });
	}

	return { contentTypes, components };
}
