import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { mapSendOptions, toAddress, toCloudflareAttachment } from '../map.js';

const base = {
  from: 'no-reply@example.com',
  to: 'a@example.com',
  subject: 'Hi',
  html: '<p>hi</p>',
};

describe('toAddress', () => {
  it('passes a plain address through', () => {
    expect(toAddress(' a@example.com ')).toBe('a@example.com');
  });

  it('splits a display name', () => {
    expect(toAddress('Support Team <support@example.com>')).toEqual({
      address: 'support@example.com',
      name: 'Support Team',
    });
  });

  it('drops empty quotes for a display name', () => {
    expect(toAddress('"Ops" <ops@example.com>')).toEqual({ address: 'ops@example.com', name: 'Ops' });
  });

  it('rejects a malformed address', () => {
    expect(() => toAddress('not-an-address')).toThrow('Invalid email address');
  });
});

describe('mapSendOptions', () => {
  it('falls back to the configured defaults', async () => {
    const body = await mapSendOptions(
      { ...base, from: undefined },
      {
        defaultFrom: 'No Reply <no-reply@example.com>',
        defaultReplyTo: 'support@example.com',
      }
    );

    expect(body.from).toEqual({ address: 'no-reply@example.com', name: 'No Reply' });
    expect(body.reply_to).toBe('support@example.com');
    expect(body.to).toBe('a@example.com');
    expect(body.subject).toBe('Hi');
    expect(body.html).toBe('<p>hi</p>');
    expect(body.text).toBeUndefined();
  });

  it('lets explicit options win over the defaults', async () => {
    const body = await mapSendOptions(
      { ...base, from: 'from@example.com', replyTo: 'reply@example.com', text: 'plain' },
      { defaultFrom: 'default@example.com', defaultReplyTo: 'default-reply@example.com' }
    );

    expect(body.from).toBe('from@example.com');
    expect(body.reply_to).toBe('reply@example.com');
    expect(body.text).toBe('plain');
  });

  it('maps recipient lists and headers', async () => {
    const body = await mapSendOptions({
      ...base,
      to: ['a@example.com', 'B <b@example.com>'],
      cc: 'c@example.com',
      bcc: ['d@example.com'],
      headers: { 'X-Campaign-ID': 'welcome' },
    });

    expect(body.to).toEqual(['a@example.com', { address: 'b@example.com', name: 'B' }]);
    expect(body.cc).toBe('c@example.com');
    expect(body.bcc).toBe('d@example.com');
    expect(body.headers).toEqual({ 'X-Campaign-ID': 'welcome' });
  });

  it('throws before calling Cloudflare when required fields are missing', async () => {
    await expect(mapSendOptions({ ...base, from: undefined })).rejects.toThrow('settings.defaultFrom');
    await expect(mapSendOptions({ ...base, to: '' })).rejects.toThrow('`to` is required');
    await expect(mapSendOptions({ ...base, subject: '' })).rejects.toThrow('`subject`');
    await expect(
      mapSendOptions({ to: 'a@example.com', subject: 'Hi', from: 'f@example.com' })
    ).rejects.toThrow('`text` or `html`');
    await expect(mapSendOptions({ ...base, from: 'broken' })).rejects.toThrow('Invalid email address');
  });

  it('encodes string content as base64 and infers a MIME type', async () => {
    const attachment = await toCloudflareAttachment({ filename: 'invoice.pdf', content: 'hello' });

    expect(attachment).toEqual({
      content: Buffer.from('hello', 'utf8').toString('base64'),
      filename: 'invoice.pdf',
      type: 'application/pdf',
      disposition: 'attachment',
    });
  });

  it('keeps content already flagged as base64', async () => {
    const attachment = await toCloudflareAttachment({ filename: 'a.txt', content: 'aGVsbG8=', encoding: 'base64' });
    expect(attachment.content).toBe('aGVsbG8=');
  });

  it('encodes buffers and marks cid attachments inline', async () => {
    const attachment = await toCloudflareAttachment({
      filename: 'logo.png',
      content: Buffer.from([1, 2, 3]),
      cid: 'logo',
    });

    expect(attachment).toMatchObject({
      content: Buffer.from([1, 2, 3]).toString('base64'),
      type: 'image/png',
      disposition: 'inline',
      content_id: 'logo',
    });
  });

  it('reads attachments from a path', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'cf-email-'));
    const file = join(dir, 'note.txt');
    await writeFile(file, 'from disk');

    try {
      const attachment = await toCloudflareAttachment({ path: file });
      expect(attachment.filename).toBe('note.txt');
      expect(attachment.type).toBe('text/plain');
      expect(Buffer.from(attachment.content, 'base64').toString('utf8')).toBe('from disk');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('rejects an attachment with nothing to send', async () => {
    await expect(toCloudflareAttachment({ filename: 'x.bin' })).rejects.toThrow('has no content or path');
  });
});
