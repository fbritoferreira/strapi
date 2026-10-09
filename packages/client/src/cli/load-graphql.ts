import type { IntrospectionSchema } from "./graphql";

/** Where to introspect, and how. */
export interface GraphqlSource {
	/** Absolute URL of the GraphQL endpoint, e.g. `http://localhost:1337/graphql`. */
	url: string;
	/** API token or JWT sent as a bearer token. */
	token?: string;
	fetch?: typeof fetch;
}

/**
 * Introspection query: every named type with its fields, input fields, enum
 * values and possible types. Type references nest through `NON_NULL` and
 * `LIST`, so `ofType` is unrolled deep enough for the wrappers Strapi emits.
 */
const INTROSPECTION_QUERY = `query StrapiClientIntrospection {
  __schema {
    queryType { name }
    mutationType { name }
    types {
      kind
      name
      fields(includeDeprecated: true) {
        name
        type { ...TypeRef }
        args { name type { ...TypeRef } }
      }
      inputFields { name type { ...TypeRef } }
      enumValues(includeDeprecated: true) { name }
      possibleTypes { ...TypeRef }
    }
  }
}
fragment TypeRef on __Type {
  kind
  name
  ofType { kind name ofType { kind name ofType { kind name ofType { kind name ofType { kind name ofType { kind name } } } } } }
}`;

interface IntrospectionBody {
	data?: { __schema?: IntrospectionSchema } | null;
	errors?: { message: string }[];
}

/**
 * Introspects a Strapi GraphQL endpoint.
 *
 * @throws {Error} when the endpoint is missing (the plugin is not installed),
 * the request fails, introspection is disabled, or the body carries no schema.
 */
export async function loadGraphqlSchema(options: GraphqlSource): Promise<IntrospectionSchema> {
	const fetchImpl = options.fetch ?? fetch;
	const response = await fetchImpl(options.url, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			...(options.token === undefined ? {} : { Authorization: `Bearer ${options.token}` }),
		},
		body: JSON.stringify({ query: INTROSPECTION_QUERY }),
	});

	if (response.status === 404) {
		throw new Error(`No GraphQL endpoint at ${options.url}; install @strapi/plugin-graphql or pass the configured endpoint`);
	}
	const text = await response.text();
	if (!response.ok) {
		const reason = graphqlMessages(text) || response.statusText || "unknown error";
		throw new Error(`POST ${options.url} failed (${response.status}): ${reason}`);
	}

	let body: IntrospectionBody;
	try {
		// Typed boundary: the endpoint's JSON, narrowed by the checks below.
		body = JSON.parse(text) as IntrospectionBody;
	} catch (error) {
		throw new Error(`${options.url} did not answer JSON: ${(error as Error).message}`, { cause: error });
	}

	if (body.errors !== undefined && body.errors.length > 0) {
		throw new Error(`${options.url} rejected the introspection query: ${body.errors.map((e) => e.message).join("; ")}`);
	}
	const schema = body.data?.__schema;
	if (schema === undefined) {
		throw new Error(`${options.url} answered without a __schema`);
	}
	return schema;
}

/** The messages of a GraphQL `errors` body, e.g. a 400 for a query that does not validate. */
function graphqlMessages(text: string): string | undefined {
	try {
		// Typed boundary: an error body of unknown shape, narrowed below.
		const errors = (JSON.parse(text) as IntrospectionBody).errors;
		return Array.isArray(errors) ? errors.map((e) => e.message).join("; ") : undefined;
	} catch {
		return undefined;
	}
}
