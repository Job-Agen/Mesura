import type { ApiErrorDto } from '@mesura/shared';

/** Play Store build: fixed https API, no server picker (see app.config.js). */
export const IS_PRODUCTION_BUILD = process.env.EXPO_PUBLIC_APP_VARIANT === 'production';

/**
 * Server picker on the login screen: in development, or in a sandbox build made with
 * EXPO_PUBLIC_SERVER_PICKER=true. The tester APK hides it and always uses its built-in API.
 */
export const SHOW_SERVER_PICKER = !IS_PRODUCTION_BUILD && (__DEV__ || process.env.EXPO_PUBLIC_SERVER_PICKER === 'true');

export const DEFAULT_API_URL = normalizeUrl(process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000');
let API_URL = DEFAULT_API_URL;

function normalizeUrl(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

/**
 * Sandbox only: lets an installed APK target any reachable API without rebuilding. Without the
 * server picker, a URL saved by an older build is ignored and the built-in API is used.
 */
export function setApiBaseUrl(url: string | null): void {
  API_URL = url && SHOW_SERVER_PICKER ? normalizeUrl(url) : DEFAULT_API_URL;
}

export function getApiBaseUrl(): string {
  return API_URL;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly issues: ApiErrorDto['issues'] = [],
  ) {
    super(message);
  }
}

let accessToken: string | null = null;
let onUnauthorized: (() => void) | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function setUnauthorizedHandler(handler: (() => void) | null): void {
  onUnauthorized = handler;
}

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE';

export async function request<T>(method: Method, path: string, body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, `Impossible de joindre Mesura pour le moment. Vérifiez votre connexion (API : ${API_URL}).`);
  }

  const text = await response.text();
  const data: unknown = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const error = (data ?? {}) as Partial<ApiErrorDto>;
    if (response.status === 401 && accessToken) onUnauthorized?.();
    const message =
      typeof error.message === 'string'
        ? error.message
        : response.status === 429
          ? 'Trop de tentatives. Patientez une minute puis réessayez.'
          : "Une erreur s'est produite. Veuillez réessayer.";
    throw new ApiError(response.status, message, error.issues);
  }
  return data as T;
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return "Une erreur s'est produite. Veuillez réessayer.";
}
