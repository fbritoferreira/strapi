import { afterEach, describe, expect, it, vi } from 'vitest';

import provider from '../index.js';

const providerOptions = { apiToken: 'token-123', accountId: 'acct-456' };
const options = { from: 'no-reply@example.com', to: 'a@example.com', subject: 'Hi', html: '<p>hi</p>' };

const okResponse = (result: object = { delivered: ['a@example.com'] }) =>
  new Response(JSON.stringify({ success: true, errors: [], result }), { status: 200 });

/** Replace global fetch with a spy that answers with `respond`. */
const stubFetch = (respond: (url: string, init: RequestInit) => Response | Promise<Response>) => {
  const mock = vi.fn(async (url: string, init: RequestInit) => respond(url, init));
  vi.stubGlobal('fetch', mock);
  return mock;
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('init', () => {
  it('requires an api token and account id', () => {
    expect(() => provider.init({ apiToken: '', accountId: 'acct' })).toThrow('apiToken');
    expect(() => provider.init({ apiToken: 'token', accountId: '' })).toThrow('accountId');
  });
});

describe('send', () => {
  it('posts the mapped body to the account endpoint', async () => {
    const fetchMock = stubFetch(() => okResponse());

    const instance = provider.init(providerOptions, { defaultFrom: 'no-reply@example.com' });
    const result = await instance.send(options);

    expect(result).toEqual({ delivered: ['a@example.com'] });

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://api.cloudflare.com/client/v4/accounts/acct-456/email/sending/send');
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({ authorization: 'Bearer token-123' });
    expect(JSON.parse(init.body as string)).toMatchObject({
      to: 'a@example.com',
      from: 'no-reply@example.com',
      subject: 'Hi',
      html: '<p>hi</p>',
    });
  });

  it('honours a custom base url', async () => {
    const fetchMock = stubFetch(() => okResponse());

    await provider.init({ ...providerOptions, baseUrl: 'https://proxy.internal/v4/' }).send(options);

    expect(fetchMock.mock.calls[0]![0]).toBe('https://proxy.internal/v4/accounts/acct-456/email/sending/send');
  });

  it('throws with the Cloudflare error code and message', async () => {
    stubFetch(
      () =>
        new Response(
          JSON.stringify({
            success: false,
            errors: [{ code: 10102, message: 'email.sending.error.authentication.forbidden' }],
          }),
          { status: 403 }
        )
    );

    await expect(provider.init(providerOptions).send(options)).rejects.toThrow(
      'Cloudflare email sending failed: 10102 email.sending.error.authentication.forbidden'
    );
  });

  it('reports a non-JSON failure body', async () => {
    stubFetch(() => new Response('bad gateway', { status: 502 }));

    await expect(provider.init(providerOptions).send(options)).rejects.toThrow('HTTP 502');
  });

  it('surfaces mapping errors without calling Cloudflare', async () => {
    const fetchMock = stubFetch(() => okResponse());

    await expect(provider.init(providerOptions).send({ ...options, to: 'nope' })).rejects.toThrow(
      'Invalid email address'
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
