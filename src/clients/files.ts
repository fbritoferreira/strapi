import { fail, ok, type Result } from "../errors";
import type { HttpClient } from "../http";
import { buildQuery } from "../query";
import type { FetchInit, QueryParams, StrapiMedia } from "../types";
import type { ClientContext } from "./collection";

const NOT_FOUND = { status: 404, name: "NotFoundError", message: "Not Found" } as const;

export interface FileInfo {
	name?: string;
	alternativeText?: string;
	caption?: string;
}

export interface UploadOptions {
	files: Blob | Blob[];
	/** Names for entries in `files` that are not `File` instances. */
	fileName?: string | (string | undefined)[];
	ref?: string;
	refId?: string | number;
	field?: string;
	fileInfo?: FileInfo | FileInfo[];
	init?: FetchInit;
}

/** Upload plugin `/api/upload`. Plain bodies, numeric ids. */
export class FilesClient {
	private readonly http: HttpClient;
	private readonly defaultLocale: string;

	constructor(context: ClientContext) {
		this.http = context.http;
		this.defaultLocale = context.defaultLocale;
	}

	async find(options: { params?: QueryParams<StrapiMedia>; init?: FetchInit } = {}): Promise<Result<StrapiMedia[]>> {
		const query = buildQuery(options.params, { defaultLocale: this.defaultLocale });
		const [err, body] = await this.http.request<StrapiMedia[]>(`upload/files${query}`, { ...options.init, method: "GET" });
		if (err) return fail(err);
		return ok(Array.isArray(body) ? body : []);
	}

	async findOne(options: { id: number; init?: FetchInit }): Promise<Result<StrapiMedia>> {
		return this.single(`upload/files/${options.id}`, { ...options.init, method: "GET" });
	}

	async upload(options: UploadOptions): Promise<Result<StrapiMedia[]>> {
		const { files, fileName, ref, refId, field, fileInfo, init } = options;
		const list = Array.isArray(files) ? files : [files];
		const names = Array.isArray(fileName) ? fileName : [fileName];
		const infos = Array.isArray(fileInfo) ? fileInfo : fileInfo ? [fileInfo] : [];

		const form = new FormData();
		list.forEach((blob, index) => {
			const name = names[index] ?? (blob instanceof File ? blob.name : `file-${index}`);
			form.append("files", blob, name);
		});
		if (ref !== undefined) form.append("ref", ref);
		if (refId !== undefined) form.append("refId", String(refId));
		if (field !== undefined) form.append("field", field);
		for (const info of infos) form.append("fileInfo", JSON.stringify(info));

		const [err, body] = await this.http.request<StrapiMedia[]>("upload", { ...init, method: "POST", body: form });
		if (err) return fail(err);
		return ok(Array.isArray(body) ? body : []);
	}

	async update(options: { id: number; fileInfo: FileInfo; init?: FetchInit }): Promise<Result<StrapiMedia>> {
		const form = new FormData();
		form.append("fileInfo", JSON.stringify(options.fileInfo));
		return this.single(`upload?id=${options.id}`, { ...options.init, method: "POST", body: form });
	}

	async delete(options: { id: number; init?: FetchInit }): Promise<Result<StrapiMedia>> {
		return this.single(`upload/files/${options.id}`, { ...options.init, method: "DELETE" });
	}

	private async single(path: string, init: FetchInit): Promise<Result<StrapiMedia>> {
		const [err, body] = await this.http.request<StrapiMedia>(path, init);
		if (err) return fail(err);
		if (!body) return fail(NOT_FOUND);
		return ok(body);
	}
}
