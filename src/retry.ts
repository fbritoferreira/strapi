/** Retry policy for {@link HttpClient}. A plain number is shorthand for `{ attempts }`. */
export interface RetryOptions {
	/** Extra attempts after the first. `0` turns retrying off. */
	attempts: number;
	/** First backoff in ms; each attempt doubles it. Default 300. */
	delay?: number;
	/** Longest any single wait may be, `Retry-After` included. Default 10000. */
	maxDelay?: number;
	/** Statuses worth repeating. Default `[408, 429, 500, 502, 503, 504]`. */
	statuses?: number[];
	/**
	 * Methods worth repeating. Default the idempotent ones — repeating a POST
	 * can create a second document, since the first may have been applied
	 * before the response was lost.
	 */
	methods?: string[];
	/** Repeat a request that never reached the server. Default `true`. */
	network?: boolean;
	/**
	 * Randomise each wait between half and all of it, to keep many clients from
	 * retrying in step. Off by default, so backoff is predictable.
	 */
	jitter?: boolean;
	/** Called before each wait. */
	onRetry?: (info: { attempt: number; delay: number; status: number | null }) => void;
}

/** A {@link RetryOptions} with every default filled in. */
export interface ResolvedRetry extends Required<Omit<RetryOptions, "onRetry">> {
	onRetry: ((info: { attempt: number; delay: number; status: number | null }) => void) | undefined;
}

const DEFAULT_STATUSES = [408, 429, 500, 502, 503, 504];
const DEFAULT_METHODS = ["GET", "HEAD", "OPTIONS"];
const DEFAULT_DELAY = 300;
const DEFAULT_MAX_DELAY = 10_000;

/** Fills in the defaults, or returns `null` when retrying is off. */
export function resolveRetry(retry: number | RetryOptions | undefined): ResolvedRetry | null {
	if (retry === undefined) return null;
	const options: RetryOptions = typeof retry === "number" ? { attempts: retry } : retry;
	if (options.attempts <= 0) return null;
	return {
		attempts: options.attempts,
		delay: options.delay ?? DEFAULT_DELAY,
		maxDelay: options.maxDelay ?? DEFAULT_MAX_DELAY,
		statuses: options.statuses ?? DEFAULT_STATUSES,
		methods: (options.methods ?? DEFAULT_METHODS).map((method) => method.toUpperCase()),
		network: options.network ?? true,
		jitter: options.jitter ?? false,
		onRetry: options.onRetry,
	};
}

/**
 * Whether to make another attempt.
 *
 * @param status the response status, or `null` when the request never got one.
 * @param made how many retries have already happened.
 */
export function shouldRetry(retry: ResolvedRetry, method: string, status: number | null, made: number): boolean {
	if (made >= retry.attempts) return false;
	if (!retry.methods.includes(method.toUpperCase())) return false;
	if (status === null) return retry.network;
	return retry.statuses.includes(status);
}

/**
 * The wait a `Retry-After` header asks for, in ms.
 *
 * @returns the delay, or `null` when the header is missing or unreadable. A
 * date already in the past means no wait at all, not a negative one.
 */
export function retryAfterMs(headers: Headers, now: number): number | null {
	const header = headers.get("retry-after");
	if (header === null) return null;
	const seconds = Number(header);
	if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
	const date = Date.parse(header);
	if (Number.isNaN(date)) return null;
	return Math.max(0, date - now);
}

/** How long to wait before the next attempt: what the server asked for, else exponential backoff. */
export function backoffFor(retry: ResolvedRetry, made: number, retryAfter: number | null): number {
	if (retryAfter !== null) return Math.min(retryAfter, retry.maxDelay);
	const exponential = Math.min(retry.delay * 2 ** made, retry.maxDelay);
	return retry.jitter ? Math.round(exponential / 2 + Math.random() * (exponential / 2)) : exponential;
}
