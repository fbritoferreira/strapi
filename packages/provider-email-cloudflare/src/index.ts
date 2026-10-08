import { mapSendOptions, type SendOptions, type Settings } from './map.js';

export type { Attachment, CloudflareBody, SendOptions, Settings } from './map.js';

export interface ProviderOptions {
  /** Cloudflare API token with the Email Sending permission. */
  apiToken: string;
  /** Cloudflare account ID the sending domain is onboarded to. */
  accountId: string;
  /** Override the API host (default `https://api.cloudflare.com/client/v4`). */
  baseUrl?: string;
  /** Request timeout in milliseconds (default 15000). */
  timeoutMs?: number;
}

interface DeliveryResult {
  delivered?: string[];
  queued?: string[];
  permanent_bounces?: string[];
  suppressed_recipients?: string[];
  message_id?: string;
}

interface CloudflareResponse {
  success?: boolean;
  errors?: { code?: number; message?: string }[];
  result?: DeliveryResult;
}

const describeFailure = (status: number, payload: CloudflareResponse | null): string => {
  const error = payload?.errors?.[0];
  const detail = error ? `${error.code ?? status} ${error.message ?? 'unknown error'}` : `HTTP ${status}`;
  return `Cloudflare email sending failed: ${detail}`;
};

/** What Strapi gets back from `init()` — one method, called for every send. */
export interface EmailProviderInstance {
  send(options: SendOptions): Promise<DeliveryResult>;
}

export interface CloudflareEmailProvider {
  name: string;
  init(providerOptions: ProviderOptions, settings?: Settings): EmailProviderInstance;
}

/**
 * Cloudflare Email Sending provider for Strapi's Email feature.
 *
 * Strapi loads this via `email.config.provider` and calls `init(providerOptions, settings)`
 * once at boot; every `strapi.plugin('email').service('email').send()` then routes to `send`.
 */
const provider: CloudflareEmailProvider = {
  name: 'cloudflare',

  init(providerOptions: ProviderOptions, settings: Settings = {}) {
    const {
      apiToken,
      accountId,
      baseUrl = 'https://api.cloudflare.com/client/v4',
      timeoutMs = 15_000,
    } = providerOptions ?? {};

    if (!apiToken) throw new Error('[email:cloudflare] `providerOptions.apiToken` is required');
    if (!accountId) throw new Error('[email:cloudflare] `providerOptions.accountId` is required');

    const endpoint = `${baseUrl.replace(/\/$/, '')}/accounts/${encodeURIComponent(accountId)}/email/sending/send`;

    return {
      async send(options: SendOptions): Promise<DeliveryResult> {
        const body = await mapSendOptions(options, settings);

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            authorization: `Bearer ${apiToken}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(timeoutMs),
        });

        const payload = (await response.json().catch(() => null)) as CloudflareResponse | null;

        if (!response.ok || payload?.success === false) {
          throw new Error(describeFailure(response.status, payload));
        }

        return payload?.result ?? {};
      },
    };
  },
};

export default provider;
