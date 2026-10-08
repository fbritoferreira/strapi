import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';

/** A Cloudflare Email Sending address: bare string, or `{ address, name }`. */
export type Address = string | { address: string; name?: string };

export interface Attachment {
  filename?: string;
  content?: string | Buffer;
  path?: string;
  cid?: string;
  content_id?: string;
  type?: string;
  contentType?: string;
  encoding?: string;
  disposition?: string;
  [key: string]: unknown;
}

export interface SendOptions {
  from?: string;
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  replyTo?: string;
  subject: string;
  text?: string;
  html?: string;
  headers?: Record<string, string>;
  attachments?: Attachment[];
  [key: string]: unknown;
}

export interface Settings {
  defaultFrom?: string;
  defaultReplyTo?: string;
}

export interface CloudflareBody {
  from: Address;
  to: Address | Address[];
  subject: string;
  text?: string;
  html?: string;
  cc?: Address | Address[];
  bcc?: Address | Address[];
  reply_to?: Address;
  headers?: Record<string, string>;
  attachments?: {
    content: string;
    filename: string;
    type: string;
    disposition: string;
    content_id?: string;
  }[];
}

// Minimal extension → MIME table. Cloudflare requires a `type` per attachment;
// an octet-stream fallback beats rejecting the send over a guessed-wrong type.
const MIME_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  txt: 'text/plain',
  html: 'text/html',
  css: 'text/css',
  csv: 'text/csv',
  json: 'application/json',
  xml: 'application/xml',
  zip: 'application/zip',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  ics: 'text/calendar',
};

const ADDRESS_PATTERN = /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/;

/**
 * Validate a plain address, split `Name <a@b.com>` into `{ address, name }`,
 * and leave anything else untouched so Cloudflare reports the real problem.
 */
export const toAddress = (value: string): Address => {
  const trimmed = value.trim();
  const match = /^(.*?)<\s*([^<>\s]+)\s*>$/.exec(trimmed);
  const address = match?.[2] ?? trimmed;
  const name = match?.[1]?.trim().replace(/^"|"$/g, '');

  if (!ADDRESS_PATTERN.test(address)) throw new Error(`Invalid email address: "${value}"`);
  return name ? { address, name } : address;
};

const toAddressList = (value: string | string[] | undefined): Address | Address[] | undefined => {
  if (value === undefined) return undefined;
  const mapped = (Array.isArray(value) ? value : [value]).map(toAddress);
  return mapped.length === 1 ? mapped[0] : mapped;
};

const mimeFor = (filename: string): string => {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  return MIME_TYPES[ext] ?? 'application/octet-stream';
};

type CloudflareAttachment = NonNullable<CloudflareBody['attachments']>[number];

/** Convert a Strapi/Nodemailer-style attachment into Cloudflare's shape. */
export const toCloudflareAttachment = async (attachment: Attachment): Promise<CloudflareAttachment> => {
  let { content } = attachment;

  if (content === undefined && attachment.path) {
    content = await readFile(attachment.path);
  }
  if (content === undefined) {
    throw new Error(`Attachment "${attachment.filename ?? attachment.path ?? 'unknown'}" has no content or path`);
  }

  const encoded = Buffer.isBuffer(content)
    ? content.toString('base64')
    : attachment.encoding === 'base64'
      ? content
      : Buffer.from(content, 'utf8').toString('base64');

  const filename = attachment.filename ?? (attachment.path ? basename(attachment.path) : 'attachment');
  const contentId = attachment.content_id ?? attachment.cid;

  return {
    content: encoded,
    filename,
    type: attachment.type ?? attachment.contentType ?? mimeFor(filename),
    disposition: attachment.disposition ?? (contentId ? 'inline' : 'attachment'),
    ...(contentId ? { content_id: contentId } : {}),
  };
};

/**
 * Map Strapi's `send()` options onto the Cloudflare Email Sending request body.
 * Throws descriptive errors for what Cloudflare would otherwise reject with a
 * generic `invalid_request_schema`.
 */
export const mapSendOptions = async (options: SendOptions, settings: Settings = {}): Promise<CloudflareBody> => {
  const from = options.from ?? settings.defaultFrom;
  const replyTo = options.replyTo ?? settings.defaultReplyTo;

  if (!from) throw new Error('No sender address: pass `from` or set `settings.defaultFrom`');
  if (!options.to) throw new Error('Missing recipient: `to` is required');
  if (!options.subject) throw new Error('Missing `subject`');
  if (!options.text && !options.html) throw new Error('Missing body: provide `text` or `html`');

  const body: CloudflareBody = {
    from: toAddress(from),
    to: toAddressList(options.to) as Address | Address[],
    subject: options.subject,
  };

  if (options.text) body.text = options.text;
  if (options.html) body.html = options.html;
  if (replyTo) body.reply_to = toAddress(replyTo);

  const cc = toAddressList(options.cc);
  const bcc = toAddressList(options.bcc);
  if (cc) body.cc = cc;
  if (bcc) body.bcc = bcc;

  if (options.headers && Object.keys(options.headers).length > 0) {
    body.headers = options.headers;
  }

  if (options.attachments?.length) {
    body.attachments = await Promise.all(options.attachments.map(toCloudflareAttachment));
  }

  return body;
};
