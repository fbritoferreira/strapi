import { fail, ok, type Result } from "../errors";
import type { HttpClient } from "../http";
import type {
	AuthSession,
	FetchInit,
	LogoutResult,
	RefreshedSession,
	RegisterResult,
	SentEmailConfirmation,
	StrapiUser,
} from "../types";
import type { ClientContext } from "./collection";

/** Strapi only mounts `/auth/refresh` and `/auth/logout` in this mode. */
const REFRESH_MODE_HINT =
	'Strapi: no refresh endpoint; set plugin::users-permissions.jwtManagement to "refresh" to enable refresh tokens';

/**
 * Client for the users-permissions auth routes at `/api/auth/*`.
 *
 * Every method returns the body Strapi sends, unwrapped — these routes have no
 * `data`/`meta` envelope. The returned `jwt` is not applied to later requests
 * on its own; pass it to {@link Strapi.setToken} when you want that.
 *
 * `T` is the user shape, defaulting to {@link StrapiUser}.
 */
export class AuthClient<T extends object = StrapiUser> {
	private readonly http: HttpClient;

	/** Usually reached as `strapi.auth` rather than constructed directly. */
	constructor(context: ClientContext) {
		this.http = context.http;
	}

	/** `POST /api/auth/local`. Exchanges an identifier and password for a JWT. */
	async login(options: { identifier: string; password: string; init?: FetchInit }): Promise<Result<AuthSession<T>>> {
		const { identifier, password, init } = options;
		return this.post<AuthSession<T>>("auth/local", { identifier, password }, init);
	}

	/**
	 * `POST /api/auth/local/register`. Creates a user.
	 *
	 * When email confirmation is enabled, Strapi answers with the user alone and
	 * no `jwt`, so the account has to be confirmed before it can sign in.
	 */
	async register(options: {
		username: string;
		email: string;
		password: string;
		init?: FetchInit;
	}): Promise<Result<RegisterResult<T>>> {
		const { username, email, password, init } = options;
		return this.post<RegisterResult<T>>("auth/local/register", { username, email, password }, init);
	}

	/** `POST /api/auth/forgot-password`. Emails a reset code. */
	async forgotPassword(options: { email: string; init?: FetchInit }): Promise<Result<{ ok: boolean }>> {
		return this.post<{ ok: boolean }>("auth/forgot-password", { email: options.email }, options.init);
	}

	/** `POST /api/auth/reset-password`. Completes the flow started by {@link forgotPassword}. */
	async resetPassword(options: {
		code: string;
		password: string;
		passwordConfirmation: string;
		init?: FetchInit;
	}): Promise<Result<AuthSession<T>>> {
		const { code, password, passwordConfirmation, init } = options;
		return this.post<AuthSession<T>>("auth/reset-password", { code, password, passwordConfirmation }, init);
	}

	/** `POST /api/auth/change-password`. Needs the signed-in user's token. */
	async changePassword(options: {
		currentPassword: string;
		password: string;
		passwordConfirmation: string;
		init?: FetchInit;
	}): Promise<Result<AuthSession<T>>> {
		const { currentPassword, password, passwordConfirmation, init } = options;
		return this.post<AuthSession<T>>("auth/change-password", { currentPassword, password, passwordConfirmation }, init);
	}

	/** `POST /api/auth/send-email-confirmation`. Resends the confirmation email. */
	async sendEmailConfirmation(options: { email: string; init?: FetchInit }): Promise<Result<SentEmailConfirmation>> {
		return this.post<SentEmailConfirmation>("auth/send-email-confirmation", { email: options.email }, options.init);
	}

	/**
	 * `POST /api/auth/refresh`. Rotates a refresh token into a new JWT.
	 *
	 * Only mounted when `jwtManagement` is `"refresh"`; otherwise Strapi answers
	 * 404 and this says so. With an httpOnly refresh cookie the token travels in
	 * the cookie and the response carries no `refreshToken`.
	 */
	async refresh(options: { refreshToken?: string; init?: FetchInit } = {}): Promise<Result<RefreshedSession>> {
		const { refreshToken, init } = options;
		const [err, body] = await this.request<RefreshedSession>(
			"auth/refresh",
			refreshToken === undefined ? {} : { refreshToken },
			init
		);
		if (err) return fail(err.status === 404 ? { ...err, message: REFRESH_MODE_HINT } : err);
		if (!body) return fail({ name: "HTTPError", message: "Strapi: refresh answered with an empty body" });
		return ok(body);
	}

	/**
	 * `POST /api/auth/logout`. Revokes the current session.
	 *
	 * `scope` and `deviceId` narrow what is revoked. Like {@link refresh}, this
	 * route exists only in the `"refresh"` JWT mode.
	 */
	async logout(options: { scope?: string; deviceId?: string; init?: FetchInit } = {}): Promise<Result<LogoutResult>> {
		const { scope, deviceId, init } = options;
		const [err, body] = await this.request<LogoutResult>(
			"auth/logout",
			{ ...(scope !== undefined && { scope }), ...(deviceId !== undefined && { deviceId }) },
			init
		);
		if (err) return fail(err.status === 404 ? { ...err, message: REFRESH_MODE_HINT } : err);
		return ok(body ?? { ok: true });
	}

	private async request<R>(path: string, payload: unknown, init: FetchInit | undefined) {
		return this.http.request<R>(path, { ...init, method: "POST", body: JSON.stringify(payload) });
	}

	/** `POST` helper that maps an empty body to an error rather than `null`. */
	private async post<R>(path: string, payload: unknown, init: FetchInit | undefined): Promise<Result<R>> {
		const [err, body] = await this.request<R>(path, payload, init);
		if (err) return fail(err);
		if (!body) return fail({ name: "HTTPError", message: `Strapi: ${path} answered with an empty body` });
		return ok(body);
	}
}
