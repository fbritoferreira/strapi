/**
 * Strapi 5 email provider that sends through Cloudflare Email Sending.
 *
 * Install it from npm and point Strapi's email plugin at it:
 *
 * ```ts
 * // config/plugins.ts
 * export default ({ env }) => ({
 *   email: {
 *     config: {
 *       provider: '@fbritoferreira/strapi-provider-email-cloudflare',
 *       providerOptions: {
 *         apiToken: env('CLOUDFLARE_API_TOKEN'),
 *         accountId: env('CLOUDFLARE_ACCOUNT_ID'),
 *       },
 *       settings: { defaultFrom: 'Example <hello@example.com>' },
 *     },
 *   },
 * });
 * ```
 *
 * @module
 */
import { mapSendOptions, type SendOptions, type Settings } from './map.js';

export type {
  Address,
  Attachment,
  CloudflareAttachment,
  CloudflareBody,
  SendOptions,
  Settings,
} from './map.js';

/** The `providerOptions` block of the email plugin config. */
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

/** Cloudflare's delivery report for one message, returned by `send()`. */
export interface DeliveryResult {
  /** Recipients the message was delivered to. */
  delivered?: string[];
  /** Recipients the message is queued for. */
  queued?: string[];
  /** Recipients that bounced permanently. */
  permanent_bounces?: string[];
  /** Recipients skipped because they are on the suppression list. */
  suppressed_recipients?: string[];
  /** Cloudflare's ID for the message. */
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
  /** Sends one message and resolves with Cloudflare's delivery report; rejects on an API error. */
  send(options: SendOptions): Promise<DeliveryResult>;
}

/** The provider object Strapi loads from `email.config.provider`. */
export interface CloudflareEmailProvider {
  /** Provider name, `cloudflare`. */
  name: string;
  /** Called once at boot with `providerOptions` and `settings`; throws if `apiToken` or `accountId` is missing. */
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
