import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FilesClient } from "../clients/files";
import { HttpClient } from "../http";
import { errorResponse, headerOf, installFetchMock, jsonResponse, lastCall, type FetchMock } from "./helpers";

const media = (id: number) => ({ id, documentId: `d${id}`, name: `f${id}.png`, url: `/uploads/f${id}.png`, mime: "image/png" });

describe("FilesClient", () => {
	let fetchMock: FetchMock;
	let files: FilesClient;

	beforeEach(() => {
		fetchMock = installFetchMock();
		files = new FilesClient({ http: new HttpClient({ baseURL: "http://h", token: "t" }), defaultLocale: "en", concurrency: 1 });
	});

	afterEach(() => vi.restoreAllMocks());

	it("find lists files with params", async () => {
		fetchMock.mockResolvedValueOnce(jsonResponse([media(1)]));
		const [err, data] = await files.find({ params: { filters: { mime: { $contains: "image" } } } });
		expect(err).toBeNull();
		expect(data).toEqual([media(1)]);
		expect(decodeURIComponent(lastCall(fetchMock).url)).toBe("http://h/api/upload/files?filters[mime][$contains]=image");
	});

	it("find returns [] on empty body and errors on failure", async () => {
		fetchMock.mockResolvedValueOnce(new Response("", { status: 200 }));
		expect((await files.find())[1]).toEqual([]);
		fetchMock.mockResolvedValueOnce(errorResponse(403, "ForbiddenError", "Forbidden"));
		expect((await files.find())[0]?.status).toBe(403);
	});

	it("findOne gets by id", async () => {
		fetchMock.mockResolvedValueOnce(jsonResponse(media(2)));
		const [err, data] = await files.findOne({ id: 2 });
		expect(err).toBeNull();
		expect(data?.id).toBe(2);
		expect(lastCall(fetchMock).url).toBe("http://h/api/upload/files/2");
	});

	it("upload posts multipart with files, ref fields and fileInfo", async () => {
		fetchMock.mockResolvedValueOnce(jsonResponse([media(3)], 201));
		const blob = new Blob(["hello"], { type: "text/plain" });
		const [err, data] = await files.upload({
			files: blob,
			fileName: "hello.txt",
			ref: "api::article.article",
			refId: "abc",
			field: "cover",
			fileInfo: { alternativeText: "alt" },
		});
		expect(err).toBeNull();
		expect(data?.[0]?.id).toBe(3);
		const { url, init } = lastCall(fetchMock);
		expect(url).toBe("http://h/api/upload");
		expect(init.method).toBe("POST");
		expect(headerOf(init, "content-type")).toBeNull();
		expect(headerOf(init, "authorization")).toBe("Bearer t");
		const form = init.body as FormData;
		expect(form).toBeInstanceOf(FormData);
		const file = form.get("files") as File;
		expect(file.name).toBe("hello.txt");
		expect(await file.text()).toBe("hello");
		expect(form.get("ref")).toBe("api::article.article");
		expect(form.get("refId")).toBe("abc");
		expect(form.get("field")).toBe("cover");
		expect(JSON.parse(String(form.get("fileInfo")))).toEqual({ alternativeText: "alt" });
	});

	it("upload appends every file and per-file fileInfo", async () => {
		fetchMock.mockResolvedValueOnce(jsonResponse([media(4), media(5)], 201));
		const [err, data] = await files.upload({
			files: [new File(["a"], "a.txt"), new Blob(["b"])],
			fileName: [undefined, "b.txt"],
			fileInfo: [{ caption: "A" }, { caption: "B" }],
		});
		expect(err).toBeNull();
		expect(data).toHaveLength(2);
		const form = lastCall(fetchMock).init.body as FormData;
		const uploaded = form.getAll("files") as File[];
		expect(uploaded.map((f) => f.name)).toEqual(["a.txt", "b.txt"]);
		expect(form.getAll("fileInfo").map((v) => JSON.parse(String(v)))).toEqual([{ caption: "A" }, { caption: "B" }]);
	});

	it("upload returns errors", async () => {
		fetchMock.mockResolvedValueOnce(errorResponse(413, "PayloadTooLargeError", "too big"));
		const [err, data] = await files.upload({ files: new Blob(["x"]) });
		expect(err?.status).toBe(413);
		expect(data).toBeNull();
	});

	it("upload returns [] when the response body is not an array", async () => {
		fetchMock.mockResolvedValueOnce(jsonResponse({ notAnArray: true }));
		const [err, data] = await files.upload({ files: new Blob(["x"]) });
		expect(err).toBeNull();
		expect(data).toEqual([]);
	});

	it("findOne returns errors on failure", async () => {
		fetchMock.mockResolvedValueOnce(errorResponse(403, "ForbiddenError", "Forbidden"));
		const [err, data] = await files.findOne({ id: 1 });
		expect(err?.status).toBe(403);
		expect(data).toBeNull();
	});

	it("update posts fileInfo to /upload?id=", async () => {
		fetchMock.mockResolvedValueOnce(jsonResponse({ ...media(6), name: "renamed.png" }));
		const [err, data] = await files.update({ id: 6, fileInfo: { name: "renamed.png" } });
		expect(err).toBeNull();
		expect(data?.name).toBe("renamed.png");
		expect(lastCall(fetchMock).url).toBe("http://h/api/upload?id=6");
		const form = lastCall(fetchMock).init.body as FormData;
		expect(JSON.parse(String(form.get("fileInfo")))).toEqual({ name: "renamed.png" });
	});

	it("delete removes by id and returns the file", async () => {
		fetchMock.mockResolvedValueOnce(jsonResponse(media(7)));
		const [err, data] = await files.delete({ id: 7 });
		expect(err).toBeNull();
		expect(data?.id).toBe(7);
		expect(lastCall(fetchMock).url).toBe("http://h/api/upload/files/7");
		expect(lastCall(fetchMock).init.method).toBe("DELETE");
	});

	it("single-object calls return NotFoundError on empty body", async () => {
		fetchMock.mockResolvedValueOnce(new Response("", { status: 200 }));
		expect((await files.findOne({ id: 1 }))[0]?.name).toBe("NotFoundError");
	});
});
