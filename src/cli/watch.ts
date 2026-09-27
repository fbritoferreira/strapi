import { watch as fsWatch } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, relative, sep } from "node:path";

/** One generated file, ready to write. */
export interface Generated {
	target: string;
	output: string;
	/** What the file holds, e.g. `12 types`. */
	summary: string;
}

/** A section's inputs on disk: a directory or a file's directory, filtered by the name that changed. */
export interface FileSource {
	kind: "files";
	path: string;
	recursive: boolean;
	/** How the watched path appears in messages. */
	label: string;
	/** Whether a change to `filename` (relative to `path`, `null` when the platform does not say) can affect the output. */
	accept: (filename: string | null) => boolean;
}

/** A section read over HTTP, so there is nothing to watch and it is polled instead. */
export interface PollSource {
	kind: "poll";
	url: string;
}

export interface WatchedSection {
	name: string;
	produce: () => Promise<Generated>;
	source: FileSource | PollSource;
}

/** What to watch. `configFile` is watched too, and a change to it re-plans everything. */
export interface WatchPlan {
	sections: WatchedSection[];
	/** Polling interval in milliseconds. */
	interval: number;
	configFile?: string;
}

export interface Closable {
	close: () => void;
}

/** Watches `path`, calling `onChange` with the name that changed. Injected so tests need no real file events. */
export type WatchFn = (
	path: string,
	options: { recursive: boolean },
	onChange: (filename: string | null) => void,
	onError: (error: Error) => void
) => Closable;

/**
 * `fs.watch`. Recursive watching is native on macOS and Windows, and on Linux
 * Node (19.1 and newer) walks the tree with inotify, which covers every Node
 * this package supports.
 */
export const nodeWatch: WatchFn = (path, options, onChange, onError) => {
	const watcher = fsWatch(path, { recursive: options.recursive }, (_event, filename) => onChange(filename));
	watcher.on("error", onError);
	return watcher;
};

/**
 * Writes `output` to `target` unless the file already holds exactly that, so an
 * unchanged schema never touches the file and editors or bundlers watching it
 * see nothing.
 *
 * @returns whether the file was written.
 */
export async function writeIfChanged(target: string, output: string): Promise<boolean> {
	const existing = await readFile(target, "utf8").catch(() => null);
	if (existing === output) return false;
	await mkdir(dirname(target), { recursive: true });
	await writeFile(target, output, "utf8");
	return true;
}

export interface WatchIo {
	stdout: (line: string) => void;
	stderr: (line: string) => void;
	cwd: string;
	/** Stops watching when aborted. */
	signal: AbortSignal;
	watch?: WatchFn;
}

export interface WatchOptions {
	/** Loads the config and turns it into sections; called again whenever the config file changes. */
	plan: () => Promise<WatchPlan>;
	io: WatchIo;
	/** Quiet period after a file event before regenerating, in milliseconds. */
	debounce?: number;
	write?: (target: string, output: string) => Promise<boolean>;
}

/** How long file events settle before a regeneration; Strapi writes several files per schema save. */
const DEBOUNCE_MS = 200;

const CONNECTION_REASONS: Record<string, string> = {
	ECONNREFUSED: "connection refused",
	ECONNRESET: "connection reset",
	UND_ERR_SOCKET: "connection closed",
	ENOTFOUND: "host not found",
};

/** Why a request never got an answer, or `null` when it did and failed some other way. */
function connectionReason(error: Error): string | null {
	if (error.name === "TimeoutError") return "timed out";
	if (!(error instanceof TypeError) || error.message !== "fetch failed") return null;
	const code = (error.cause as { code?: unknown } | undefined)?.code;
	if (typeof code !== "string") return "unreachable";
	return CONNECTION_REASONS[code] ?? code;
}

function every(interval: number): string {
	return interval < 1000 ? `${interval}ms` : `${interval / 1000}s`;
}

/** A path as messages show it: relative to the working directory, with forward slashes. */
export function displayPath(cwd: string, path: string): string {
	return relative(cwd, path).split(sep).join("/") || ".";
}

type Reason = "initial" | "change" | "poll";

interface Context {
	io: WatchIo;
	watch: WatchFn;
	debounce: number;
	interval: number;
	write: (target: string, output: string) => Promise<boolean>;
	display: (path: string) => string;
}

/**
 * Keeps one section's file up to date. Runs never overlap: a trigger during a
 * run queues exactly one more, and a failure is reported once until its
 * message changes, so a stopped instance costs one line rather than one per poll.
 */
class SectionWatcher {
	private running = false;
	private queued: Reason | null = null;
	private failure: string | null = null;
	private polling = false;
	private closed = false;
	private timer: ReturnType<typeof setTimeout> | undefined;
	private watcher: Closable | undefined;

	constructor(
		private readonly section: WatchedSection,
		private readonly context: Context
	) {}

	listen(): void {
		const { source, name } = this.section;
		const { io, interval } = this.context;
		if (source.kind === "poll") {
			this.polling = true;
			io.stdout(`${name}: polling ${source.url} every ${every(interval)}`);
			return;
		}
		try {
			this.watcher = this.context.watch(
				source.path,
				{ recursive: source.recursive },
				(filename) => {
					if (source.accept(filename)) this.settle();
				},
				(error) => this.fallBack(source, error)
			);
			io.stdout(`${name}: watching ${source.label}`);
		} catch (error) {
			this.fallBack(source, error as Error);
		}
	}

	close(): void {
		this.closed = true;
		clearTimeout(this.timer);
		this.watcher?.close();
	}

	async run(reason: Reason): Promise<void> {
		if (this.running) {
			this.queued = this.queued === "change" ? "change" : reason;
			return;
		}
		this.running = true;
		let next: Reason | null = reason;
		while (next !== null && !this.closed) {
			this.queued = null;
			await this.once(next);
			next = this.queued;
		}
		this.running = false;
		this.schedule();
	}

	private settle(): void {
		clearTimeout(this.timer);
		this.timer = setTimeout(() => void this.run("change"), this.context.debounce);
	}

	private schedule(): void {
		if (!this.polling || this.closed) return;
		clearTimeout(this.timer);
		this.timer = setTimeout(() => void this.run("poll"), this.context.interval);
	}

	private fallBack(source: FileSource, error: Error): void {
		this.watcher?.close();
		this.watcher = undefined;
		this.polling = true;
		this.context.io.stderr(
			`${this.section.name}: cannot watch ${source.label} (${error.message}); polling every ${every(this.context.interval)}`
		);
		if (!this.running) this.schedule();
	}

	private describe(error: Error): string {
		const { source } = this.section;
		const why = source.kind === "poll" ? connectionReason(error) : null;
		return source.kind === "poll" && why !== null ? `waiting for ${source.url} (${why})` : error.message;
	}

	private async once(reason: Reason): Promise<void> {
		const { name } = this.section;
		const { io } = this.context;
		let generated: Generated;
		let changed: boolean;
		try {
			generated = await this.section.produce();
			if (this.closed) return;
			changed = await this.context.write(generated.target, generated.output);
		} catch (error) {
			if (this.closed) return;
			const message = this.describe(error as Error);
			if (message !== this.failure) io.stderr(`${name}: ${message}`);
			this.failure = message;
			return;
		}
		const recovered = this.failure !== null;
		this.failure = null;
		const target = this.context.display(generated.target);
		if (reason === "initial") {
			io.stdout(changed ? `${name}: wrote ${target} (${generated.summary})` : `${name}: up to date ${target}`);
		} else if (changed) {
			io.stdout(`${name}: regenerated ${target} (${generated.summary})`);
		} else if (reason === "change" || recovered) {
			io.stdout(`${name}: unchanged`);
		}
	}
}

/** A started plan: closable at once, even while its first pass is still running. */
interface Started extends Closable {
	ready: Promise<void>;
}

/** Starts every section of a plan: watchers first, so nothing saved during the first pass is missed. */
function start(plan: WatchPlan, base: Omit<Context, "interval">): Started {
	const context: Context = { ...base, interval: plan.interval };
	const watchers = plan.sections.map((section) => new SectionWatcher(section, context));
	for (const watcher of watchers) watcher.listen();
	const ready = (async () => {
		for (const watcher of watchers) await watcher.run("initial");
	})();
	return { ready, close: () => watchers.forEach((watcher) => watcher.close()) };
}

/** Runs `task` with no overlap; calls during a run coalesce into one more run after it. */
function serial(task: () => Promise<void>): () => void {
	let running = false;
	let again = false;
	const loop = async (): Promise<void> => {
		running = true;
		do {
			again = false;
			await task();
		} while (again);
		running = false;
	};
	return () => {
		if (running) again = true;
		else void loop();
	};
}

/**
 * Generates every section once, then regenerates each one when its source
 * changes, until `io.signal` aborts.
 *
 * @returns 1 when the first plan cannot be made, otherwise 0 once stopped.
 */
export async function watch(options: WatchOptions): Promise<number> {
	const { io } = options;
	let plan: WatchPlan;
	try {
		plan = await options.plan();
	} catch (error) {
		io.stderr(`Error: ${(error as Error).message}`);
		return 1;
	}

	const base: Omit<Context, "interval"> = {
		io,
		watch: io.watch ?? nodeWatch,
		debounce: options.debounce ?? DEBOUNCE_MS,
		write: options.write ?? writeIfChanged,
		display: (path) => displayPath(io.cwd, path),
	};
	const stopped = new Promise<void>((resolve) => {
		if (io.signal.aborted) resolve();
		else io.signal.addEventListener("abort", () => resolve(), { once: true });
	});

	let active = start(plan, base);
	await active.ready;
	let configWatcher: Closable | undefined;
	if (plan.configFile !== undefined) {
		configWatcher = watchConfig(plan.configFile, options, base, async (next) => {
			active.close();
			active = start(next, base);
			await active.ready;
		});
	}

	await stopped;
	configWatcher?.close();
	active.close();
	io.stdout("Stopped watching");
	return 0;
}

/** Watches the config file's directory for the file itself, which survives editors that save by renaming. */
function watchConfig(
	file: string,
	options: WatchOptions,
	base: Omit<Context, "interval">,
	replace: (plan: WatchPlan) => Promise<void>
): Closable | undefined {
	const { io } = options;
	const label = base.display(file);
	const name = basename(file);
	let timer: ReturnType<typeof setTimeout> | undefined;
	let watcher: Closable | undefined;

	const reload = serial(async () => {
		let next: WatchPlan;
		try {
			next = await options.plan();
		} catch (error) {
			io.stderr(`config: ${(error as Error).message}; keeping the previous config`);
			return;
		}
		if (io.signal.aborted) return;
		io.stdout(`config: reloaded ${label}`);
		await replace(next);
	});
	const fail = (error: Error): void => {
		watcher?.close();
		io.stderr(`config: cannot watch ${label} (${error.message}); restart to pick up changes`);
	};

	try {
		watcher = base.watch(
			dirname(file),
			{ recursive: false },
			(filename) => {
				if (filename !== null && filename !== name) return;
				clearTimeout(timer);
				timer = setTimeout(reload, base.debounce);
			},
			fail
		);
	} catch (error) {
		fail(error as Error);
		return undefined;
	}
	io.stdout(`config: watching ${label}`);
	return {
		close: () => {
			clearTimeout(timer);
			watcher?.close();
		},
	};
}
