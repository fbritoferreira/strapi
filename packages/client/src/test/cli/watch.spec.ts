import { mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { displayPath, nodeWatch, watch, writeIfChanged, type Generated, type WatchFn, type WatchPlan, type WatchedSection } from "../../cli/watch";

const CWD = "/work";

interface FakeWatch {
	path: string;
	recursive: boolean;
	change: (filename: string | null) => void;
	fail: (error: Error) => void;
	closed: boolean;
}

function harness() {
	const out: string[] = [];
	const err: string[] = [];
	const files = new Map<string, string>();
	const watches: FakeWatch[] = [];
	const controller = new AbortController();
	const watchFn: WatchFn = (path, options, onChange, onError) => {
		const entry: FakeWatch = { path, recursive: options.recursive, change: onChange, fail: onError, closed: false };
		watches.push(entry);
		return {
			close: () => {
				entry.closed = true;
			},
		};
	};
	const write = vi.fn(async (target: string, output: string) => {
		if (files.get(target) === output) return false;
		files.set(target, output);
		return true;
	});
	return {
		out,
		err,
		files,
		watches,
		controller,
		write,
		io: { stdout: (line: string) => out.push(line), stderr: (line: string) => err.push(line), cwd: CWD, signal: controller.signal, watch: watchFn },
		open: (path: string) => watches.filter((w) => w.path === path && !w.closed),
	};
}

function producer(outputs: (string | Error)[], target = "/work/src/types.ts"): ReturnType<typeof vi.fn<() => Promise<Generated>>> {
	let call = 0;
	return vi.fn(async () => {
		const next = outputs[Math.min(call, outputs.length - 1)];
		call += 1;
		if (next instanceof Error) throw next;
		return { target, output: String(next), summary: "2 types" };
	});
}

function fileSection(produce: WatchedSection["produce"], accept: (filename: string | null) => boolean = () => true): WatchedSection {
	return { name: "types", produce, source: { kind: "files", path: "/cms/src", recursive: true, label: "../cms/src", accept } };
}

function pollSection(produce: WatchedSection["produce"], url = "http://localhost:1337/graphql"): WatchedSection {
	return { name: "graphql", produce, source: { kind: "poll", url } };
}

function refused(): Error {
	return new TypeError("fetch failed", { cause: Object.assign(new Error("connect ECONNREFUSED 127.0.0.1:1337"), { code: "ECONNREFUSED" }) });
}

async function started(h: ReturnType<typeof harness>, plan: WatchPlan | (() => Promise<WatchPlan>), debounce = 100) {
	const promise = watch({ plan: typeof plan === "function" ? plan : async () => plan, io: h.io, debounce, write: h.write });
	await vi.advanceTimersByTimeAsync(0);
	return { done: promise };
}

describe("watch", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});
	afterEach(() => {
		vi.useRealTimers();
	});

	it("generates once, reports what it watches, and stops on abort", async () => {
		const h = harness();
		const { done } = await started(h, { sections: [fileSection(producer(["a"]))], interval: 2000 });
		expect(h.out).toEqual(["types: watching ../cms/src", "types: wrote src/types.ts (2 types)"]);
		expect(h.open("/cms/src")[0]?.recursive).toBe(true);

		h.controller.abort();
		expect(await done).toBe(0);
		expect(h.watches.every((w) => w.closed)).toBe(true);
		expect(h.out.at(-1)).toBe("Stopped watching");
	});

	it("says a file is up to date on the first pass when nothing changed", async () => {
		const h = harness();
		h.files.set("/work/src/types.ts", "a");
		const { done } = await started(h, { sections: [fileSection(producer(["a"]))], interval: 2000 });
		expect(h.out).toContain("types: up to date src/types.ts");
		h.controller.abort();
		await done;
	});

	it("returns at once when the signal is already aborted", async () => {
		const h = harness();
		h.controller.abort();
		expect(await (await started(h, { sections: [fileSection(producer(["a"]))], interval: 2000 })).done).toBe(0);
	});

	it("exits 1 when the first plan cannot be made", async () => {
		const h = harness();
		const { done } = await started(h, async () => {
			throw new Error("No config file found");
		});
		expect(await done).toBe(1);
		expect(h.err).toEqual(["Error: No config file found"]);
	});

	it("debounces a burst of file events into one regeneration", async () => {
		const h = harness();
		const produce = producer(["a", "b"]);
		const { done } = await started(h, { sections: [fileSection(produce)], interval: 2000 });
		const [watcher] = h.open("/cms/src");
		watcher?.change("api/article/content-types/article/schema.json");
		await vi.advanceTimersByTimeAsync(50);
		watcher?.change("components/shared/seo.json");
		await vi.advanceTimersByTimeAsync(50);
		watcher?.change(null);
		expect(produce).toHaveBeenCalledTimes(1);
		await vi.advanceTimersByTimeAsync(100);
		expect(produce).toHaveBeenCalledTimes(2);
		expect(h.out.at(-1)).toBe("types: regenerated src/types.ts (2 types)");
		expect(h.files.get("/work/src/types.ts")).toBe("b");
		h.controller.abort();
		await done;
	});

	it("says unchanged when a file event produces the same output, without writing", async () => {
		const h = harness();
		const { done } = await started(h, { sections: [fileSection(producer(["a"]))], interval: 2000 });
		h.open("/cms/src")[0]?.change("api/article/content-types/article/schema.json");
		await vi.advanceTimersByTimeAsync(100);
		expect(h.out.at(-1)).toBe("types: unchanged");
		expect(h.write).toHaveBeenCalledTimes(2);
		expect(h.files.get("/work/src/types.ts")).toBe("a");
		h.controller.abort();
		await done;
	});

	it("ignores events the section does not accept", async () => {
		const h = harness();
		const produce = producer(["a"]);
		const { done } = await started(h, { sections: [fileSection(produce, (f) => f === "wanted.json")], interval: 2000 });
		h.open("/cms/src")[0]?.change("api/article/controllers/article.ts");
		await vi.advanceTimersByTimeAsync(500);
		expect(produce).toHaveBeenCalledTimes(1);
		h.controller.abort();
		await done;
	});

	it("runs once more after an event that lands mid-run, not once per event", async () => {
		const h = harness();
		let release: () => void = () => undefined;
		let call = 0;
		const produce = vi.fn(async (): Promise<Generated> => {
			call += 1;
			if (call === 2) await new Promise<void>((resolve) => (release = resolve));
			return { target: "/work/src/types.ts", output: `v${call}`, summary: "2 types" };
		});
		const { done } = await started(h, { sections: [fileSection(produce)], interval: 2000 });
		const [watcher] = h.open("/cms/src");
		watcher?.change(null);
		await vi.advanceTimersByTimeAsync(100);
		expect(produce).toHaveBeenCalledTimes(2);
		watcher?.change(null);
		await vi.advanceTimersByTimeAsync(100);
		watcher?.change(null);
		await vi.advanceTimersByTimeAsync(100);
		expect(produce).toHaveBeenCalledTimes(2);
		release();
		await vi.advanceTimersByTimeAsync(0);
		expect(produce).toHaveBeenCalledTimes(3);
		expect(h.files.get("/work/src/types.ts")).toBe("v3");
		h.controller.abort();
		await done;
	});

	it("polls a URL source, quietly while nothing changes", async () => {
		const h = harness();
		const produce = producer(["a", "a", "a", "b"], "/work/src/graphql.ts");
		const { done } = await started(h, { sections: [pollSection(produce)], interval: 2000 });
		expect(h.out).toEqual(["graphql: polling http://localhost:1337/graphql every 2s", "graphql: wrote src/graphql.ts (2 types)"]);
		await vi.advanceTimersByTimeAsync(4000);
		expect(produce).toHaveBeenCalledTimes(3);
		expect(h.out).toHaveLength(2);
		await vi.advanceTimersByTimeAsync(2000);
		expect(h.out.at(-1)).toBe("graphql: regenerated src/graphql.ts (2 types)");
		h.controller.abort();
		await done;
	});

	it("formats a sub-second interval in milliseconds", async () => {
		const h = harness();
		const { done } = await started(h, { sections: [pollSection(producer(["a"]))], interval: 500 });
		expect(h.out[0]).toBe("graphql: polling http://localhost:1337/graphql every 500ms");
		h.controller.abort();
		await done;
	});

	it("waits for an instance that is down with one line, then carries on", async () => {
		const h = harness();
		const produce = producer([refused(), refused(), refused(), "a"], "/work/src/graphql.ts");
		const { done } = await started(h, { sections: [pollSection(produce)], interval: 1000 });
		await vi.advanceTimersByTimeAsync(2000);
		expect(h.err).toEqual(["graphql: waiting for http://localhost:1337/graphql (connection refused)"]);
		await vi.advanceTimersByTimeAsync(1000);
		expect(h.out.at(-1)).toBe("graphql: regenerated src/graphql.ts (2 types)");
		h.controller.abort();
		await done;
	});

	it("says unchanged once when an instance comes back with the same schema", async () => {
		const h = harness();
		const produce = producer(["a", refused(), "a", "a"], "/work/src/graphql.ts");
		const { done } = await started(h, { sections: [pollSection(produce)], interval: 1000 });
		await vi.advanceTimersByTimeAsync(3000);
		expect(h.out.slice(2)).toEqual(["graphql: unchanged"]);
		h.controller.abort();
		await done;
	});

	it("names each kind of connection failure", async () => {
		const failures = [
			new TypeError("fetch failed", { cause: Object.assign(new AggregateError([]), { code: "ECONNREFUSED" }) }),
			new TypeError("fetch failed", { cause: Object.assign(new Error("reset"), { code: "ECONNRESET" }) }),
			new TypeError("fetch failed", { cause: Object.assign(new Error("other side closed"), { code: "UND_ERR_SOCKET" }) }),
			new TypeError("fetch failed", { cause: Object.assign(new Error("dns"), { code: "ENOTFOUND" }) }),
			new TypeError("fetch failed", { cause: Object.assign(new Error("odd"), { code: "EHOSTUNREACH" }) }),
			new TypeError("fetch failed", { cause: new Error("no code") }),
			new TypeError("fetch failed"),
			new DOMException("The operation was aborted due to timeout", "TimeoutError"),
			new TypeError("something else"),
			new Error("POST http://localhost:1337/graphql failed (502): Bad Gateway"),
		];
		const h = harness();
		const { done } = await started(h, { sections: [pollSection(producer(failures))], interval: 1000 });
		await vi.advanceTimersByTimeAsync(failures.length * 1000);
		expect(h.err.map((line) => line.replace("graphql: ", ""))).toEqual([
			"waiting for http://localhost:1337/graphql (connection refused)",
			"waiting for http://localhost:1337/graphql (connection reset)",
			"waiting for http://localhost:1337/graphql (connection closed)",
			"waiting for http://localhost:1337/graphql (host not found)",
			"waiting for http://localhost:1337/graphql (EHOSTUNREACH)",
			"waiting for http://localhost:1337/graphql (unreachable)",
			"waiting for http://localhost:1337/graphql (timed out)",
			"something else",
			"POST http://localhost:1337/graphql failed (502): Bad Gateway",
		]);
		h.controller.abort();
		await done;
	});

	it("reports a failing file section once until its message changes", async () => {
		const h = harness();
		const produce = producer([new Error("Invalid JSON in schema.json"), new Error("Invalid JSON in schema.json"), new Error("Schema x has no info"), "a"]);
		const { done } = await started(h, { sections: [fileSection(produce)], interval: 2000 });
		const [watcher] = h.open("/cms/src");
		for (let index = 0; index < 3; index += 1) {
			watcher?.change(null);
			await vi.advanceTimersByTimeAsync(100);
		}
		expect(h.err).toEqual(["types: Invalid JSON in schema.json", "types: Schema x has no info"]);
		expect(h.out.at(-1)).toBe("types: wrote src/types.ts (2 types)".replace("wrote", "regenerated"));
		h.controller.abort();
		await done;
	});

	it("reports a failed write like any other failure", async () => {
		const h = harness();
		h.write.mockRejectedValueOnce(new Error("EACCES: permission denied"));
		const { done } = await started(h, { sections: [fileSection(producer(["a"]))], interval: 2000 });
		expect(h.err).toEqual(["types: EACCES: permission denied"]);
		h.controller.abort();
		await done;
	});

	it("falls back to polling when a directory cannot be watched", async () => {
		const h = harness();
		h.io.watch = () => {
			throw new Error("ENOENT: no such file or directory");
		};
		const produce = producer(["a", "a", "b"]);
		const { done } = await started(h, { sections: [fileSection(produce)], interval: 1000 });
		expect(h.err).toEqual(["types: cannot watch ../cms/src (ENOENT: no such file or directory); polling every 1s"]);
		await vi.advanceTimersByTimeAsync(2000);
		expect(produce).toHaveBeenCalledTimes(3);
		expect(h.out.at(-1)).toBe("types: regenerated src/types.ts (2 types)");
		h.controller.abort();
		await done;
	});

	it("falls back to polling when a watcher errors later", async () => {
		const h = harness();
		const produce = producer(["a", "b"]);
		const { done } = await started(h, { sections: [fileSection(produce)], interval: 1000 });
		const [watcher] = h.open("/cms/src");
		watcher?.fail(new Error("EMFILE: too many open files"));
		expect(watcher?.closed).toBe(true);
		expect(h.err).toEqual(["types: cannot watch ../cms/src (EMFILE: too many open files); polling every 1s"]);
		await vi.advanceTimersByTimeAsync(1000);
		expect(produce).toHaveBeenCalledTimes(2);
		h.controller.abort();
		await done;
	});

	it("does not start polling twice when a watcher errors mid-run", async () => {
		const h = harness();
		let release: () => void = () => undefined;
		let call = 0;
		const produce = vi.fn(async (): Promise<Generated> => {
			call += 1;
			if (call === 2) await new Promise<void>((resolve) => (release = resolve));
			return { target: "/work/src/types.ts", output: "a", summary: "2 types" };
		});
		const { done } = await started(h, { sections: [fileSection(produce)], interval: 1000 });
		const [watcher] = h.open("/cms/src");
		watcher?.change(null);
		await vi.advanceTimersByTimeAsync(100);
		watcher?.fail(new Error("EMFILE"));
		release();
		await vi.advanceTimersByTimeAsync(1000);
		expect(produce).toHaveBeenCalledTimes(3);
		h.controller.abort();
		await done;
	});

	it("reloads the config when it changes, and re-plans what it watches", async () => {
		const h = harness();
		const first = producer(["a"]);
		const second = producer(["b"], "/work/src/graphql.ts");
		const plans: WatchPlan[] = [
			{ sections: [fileSection(first)], interval: 2000, configFile: "/work/strapi-codegen.config.json" },
			{ sections: [pollSection(second)], interval: 2000, configFile: "/work/strapi-codegen.config.json" },
		];
		let loaded = 0;
		const { done } = await started(h, async () => plans[Math.min(loaded++, 1)] as WatchPlan);
		expect(h.out).toContain("config: watching strapi-codegen.config.json");
		const [configWatcher] = h.open("/work");
		expect(configWatcher?.recursive).toBe(false);

		configWatcher?.change("src/types.ts");
		await vi.advanceTimersByTimeAsync(500);
		expect(loaded).toBe(1);

		configWatcher?.change("strapi-codegen.config.json");
		await vi.advanceTimersByTimeAsync(100);
		expect(loaded).toBe(2);
		expect(h.open("/cms/src")).toHaveLength(0);
		expect(h.out.slice(-3)).toEqual([
			"config: reloaded strapi-codegen.config.json",
			"graphql: polling http://localhost:1337/graphql every 2s",
			"graphql: wrote src/graphql.ts (2 types)",
		]);
		h.controller.abort();
		await done;
		expect(h.watches.every((w) => w.closed)).toBe(true);
	});

	it("keeps the previous config when the new one does not load", async () => {
		const h = harness();
		const produce = producer(["a", "b"]);
		let loaded = 0;
		const { done } = await started(h, async () => {
			loaded += 1;
			if (loaded > 1) throw new Error("strapi-codegen.config.json: graphql needs url");
			return { sections: [fileSection(produce)], interval: 2000, configFile: "/work/strapi-codegen.config.json" };
		});
		h.open("/work")[0]?.change("strapi-codegen.config.json");
		await vi.advanceTimersByTimeAsync(100);
		expect(h.err).toEqual(["config: strapi-codegen.config.json: graphql needs url; keeping the previous config"]);
		h.open("/cms/src")[0]?.change(null);
		await vi.advanceTimersByTimeAsync(100);
		expect(h.out.at(-1)).toBe("types: regenerated src/types.ts (2 types)");
		h.controller.abort();
		await done;
	});

	it("drops a result that lands after its plan was replaced", async () => {
		const h = harness();
		let release: () => void = () => undefined;
		let call = 0;
		const slow = vi.fn(async (): Promise<Generated> => {
			call += 1;
			if (call === 2) await new Promise<void>((resolve) => (release = resolve));
			return { target: "/work/src/types.ts", output: `old${call}`, summary: "2 types" };
		});
		let loaded = 0;
		const { done } = await started(h, async () => {
			loaded += 1;
			const produce = loaded === 1 ? slow : producer(["new"]);
			return { sections: [fileSection(produce)], interval: 2000, configFile: "/work/strapi-codegen.config.json" };
		});
		h.open("/cms/src")[0]?.change(null);
		await vi.advanceTimersByTimeAsync(100);
		h.open("/work")[0]?.change("strapi-codegen.config.json");
		await vi.advanceTimersByTimeAsync(100);
		release();
		await vi.advanceTimersByTimeAsync(0);
		expect(h.files.get("/work/src/types.ts")).toBe("new");
		h.controller.abort();
		await done;
	});

	it("drops a failure that lands after the watcher stopped", async () => {
		const h = harness();
		let reject: (error: Error) => void = () => undefined;
		let call = 0;
		const produce = vi.fn(async (): Promise<Generated> => {
			call += 1;
			if (call === 2) await new Promise<void>((_resolve, rejectRun) => (reject = rejectRun));
			return { target: "/work/src/types.ts", output: "a", summary: "2 types" };
		});
		const { done } = await started(h, { sections: [fileSection(produce)], interval: 2000 });
		h.open("/cms/src")[0]?.change(null);
		await vi.advanceTimersByTimeAsync(100);
		h.controller.abort();
		await done;
		reject(new Error("late"));
		await vi.advanceTimersByTimeAsync(0);
		expect(h.err).toEqual([]);
	});

	it("does not re-plan after a stop that lands mid-reload", async () => {
		const h = harness();
		let release: () => void = () => undefined;
		let loaded = 0;
		const { done } = await started(h, async () => {
			loaded += 1;
			if (loaded === 2) await new Promise<void>((resolve) => (release = resolve));
			return { sections: [fileSection(producer(["a"]))], interval: 2000, configFile: "/work/strapi-codegen.config.json" };
		});
		h.open("/work")[0]?.change("strapi-codegen.config.json");
		await vi.advanceTimersByTimeAsync(100);
		h.controller.abort();
		await done;
		release();
		await vi.advanceTimersByTimeAsync(0);
		expect(h.out).not.toContain("config: reloaded strapi-codegen.config.json");
	});

	it("reloads once more when the config changes during a reload", async () => {
		const h = harness();
		let release: () => void = () => undefined;
		let loaded = 0;
		const { done } = await started(h, async () => {
			loaded += 1;
			if (loaded === 2) await new Promise<void>((resolve) => (release = resolve));
			return { sections: [fileSection(producer(["a"]))], interval: 2000, configFile: "/work/strapi-codegen.config.json" };
		});
		const [configWatcher] = h.open("/work");
		configWatcher?.change("strapi-codegen.config.json");
		await vi.advanceTimersByTimeAsync(100);
		configWatcher?.change("strapi-codegen.config.json");
		await vi.advanceTimersByTimeAsync(100);
		release();
		await vi.advanceTimersByTimeAsync(0);
		expect(loaded).toBe(3);
		h.controller.abort();
		await done;
	});

	it("reloads on a config event that names no file", async () => {
		const h = harness();
		let loaded = 0;
		const { done } = await started(h, async () => {
			loaded += 1;
			return { sections: [fileSection(producer(["a"]))], interval: 2000, configFile: "/work/strapi-codegen.config.json" };
		});
		h.open("/work")[0]?.change(null);
		await vi.advanceTimersByTimeAsync(100);
		expect(loaded).toBe(2);
		h.controller.abort();
		await done;
	});

	it("closes a re-planned section that finishes starting after a stop", async () => {
		const h = harness();
		let release: () => void = () => undefined;
		let loaded = 0;
		const { done } = await started(h, async () => {
			loaded += 1;
			const produce =
				loaded === 1
					? producer(["a"])
					: vi.fn(async (): Promise<Generated> => {
							await new Promise<void>((resolve) => (release = resolve));
							return { target: "/work/src/graphql.ts", output: "b", summary: "1 types" };
						});
			return { sections: [loaded === 1 ? fileSection(produce) : pollSection(produce)], interval: 1000, configFile: "/work/strapi-codegen.config.json" };
		});
		h.open("/work")[0]?.change("strapi-codegen.config.json");
		await vi.advanceTimersByTimeAsync(100);
		h.controller.abort();
		await done;
		release();
		await vi.advanceTimersByTimeAsync(5000);
		expect(h.out).not.toContain("graphql: wrote src/graphql.ts (1 types)");
		expect(vi.getTimerCount()).toBe(0);
	});

	it("keeps going without config reloads when the config cannot be watched", async () => {
		const h = harness();
		const inner = h.io.watch;
		h.io.watch = (path, options, onChange, onError) => {
			if (path === "/work") throw new Error("EPERM");
			return inner(path, options, onChange, onError);
		};
		const { done } = await started(h, { sections: [fileSection(producer(["a"]))], interval: 2000, configFile: "/work/strapi-codegen.config.json" });
		expect(h.err).toEqual(["config: cannot watch strapi-codegen.config.json (EPERM); restart to pick up changes"]);
		h.controller.abort();
		await done;
	});

	it("stops watching the config when its watcher errors", async () => {
		const h = harness();
		const { done } = await started(h, { sections: [fileSection(producer(["a"]))], interval: 2000, configFile: "/work/strapi-codegen.config.json" });
		const [configWatcher] = h.open("/work");
		configWatcher?.fail(new Error("EMFILE"));
		expect(configWatcher?.closed).toBe(true);
		expect(h.err).toEqual(["config: cannot watch strapi-codegen.config.json (EMFILE); restart to pick up changes"]);
		h.controller.abort();
		await done;
	});
});

describe("displayPath", () => {
	it("shows a path relative to the working directory, or . for the directory itself", () => {
		expect(displayPath("/work", "/work/src/types.ts")).toBe("src/types.ts");
		expect(displayPath("/work", "/cms/src")).toBe("../cms/src");
		expect(displayPath("/work", "/work")).toBe(".");
	});
});

describe("writeIfChanged", () => {
	it("writes a new file, creating its directory, and leaves an identical one untouched", async () => {
		const dir = await mkdtemp(join(tmpdir(), "strapi-watch-"));
		const target = join(dir, "nested", "types.ts");
		expect(await writeIfChanged(target, "one")).toBe(true);
		const before = (await stat(target)).mtimeMs;
		await new Promise((resolve) => setTimeout(resolve, 20));
		expect(await writeIfChanged(target, "one")).toBe(false);
		expect((await stat(target)).mtimeMs).toBe(before);
		expect(await writeIfChanged(target, "two")).toBe(true);
		expect(await readFile(target, "utf8")).toBe("two");
	});
});

describe("nodeWatch", () => {
	it("reports changes below a directory, recursively", async () => {
		const dir = await mkdtemp(join(tmpdir(), "strapi-watch-"));
		const seen: (string | null)[] = [];
		const watcher = nodeWatch(dir, { recursive: true }, (filename) => seen.push(filename), () => undefined);
		await new Promise((resolve) => setTimeout(resolve, 100));
		await writeFile(join(dir, "schema.json"), "{}", "utf8");
		await vi.waitFor(() => expect(seen.some((name) => name?.endsWith("schema.json"))).toBe(true), { timeout: 5000, interval: 25 });
		watcher.close();
	});

	it("hands watcher errors to the error callback", async () => {
		const dir = await mkdtemp(join(tmpdir(), "strapi-watch-"));
		const errors: Error[] = [];
		const watcher = nodeWatch(dir, { recursive: false }, () => undefined, (error) => errors.push(error));
		(watcher as unknown as { emit: (event: string, error: Error) => void }).emit("error", new Error("boom"));
		watcher.close();
		expect(errors.map((e) => e.message)).toEqual(["boom"]);
	});
});
