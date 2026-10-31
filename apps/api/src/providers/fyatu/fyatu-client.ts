import { Logger, ServiceUnavailableException } from '@nestjs/common';

export interface FyatuSettings {
  apiKey: string;
  baseUrl: string;
  testMode: boolean;
}

/** Error answered by Fyatu, with its error code (e.g. CARDHOLDER_KYC_NOT_APPROVED). */
export class FyatuApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(`Fyatu error ${status} ${code}`);
  }
}

interface FyatuEnvelope<T> {
  success: boolean;
  data?: T;
  error?: { code?: string };
  code?: string;
}

/** Minimal Fyatu REST client (https://docs.fyatu.com/v3.20): bearer key, JSON envelope `{ success, data }`. */
export class FyatuClient {
  private readonly logger = new Logger(FyatuClient.name);

  constructor(private readonly settings: FyatuSettings) {}

  get apiKey(): string {
    return this.settings.apiKey;
  }

  get testMode(): boolean {
    return this.settings.testMode;
  }

  async call<T>(method: 'GET' | 'POST' | 'PATCH', path: string, body?: unknown): Promise<T> {
    let response: Response;
    try {
      response = await fetch(`${this.settings.baseUrl}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${this.settings.apiKey}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(this.settings.testMode ? { 'X-Fyatu-Mode': 'test' } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      this.logger.error(`Fyatu ${method} ${resource(path)} did not answer`);
      throw new ServiceUnavailableException("Le service de cartes ne répond pas. Réessayez dans un instant.");
    }
    const payload = (await response.json().catch(() => ({}))) as FyatuEnvelope<T>;
    if (!response.ok || payload.success === false) {
      const code = payload.error?.code ?? payload.code ?? 'UNKNOWN';
      // Responses may echo cardholder data: log the status and code only.
      this.logger.error(`Fyatu ${method} ${resource(path)} failed: HTTP ${response.status} ${code}`);
      throw new FyatuApiError(response.status, code);
    }
    return payload.data as T;
  }
}

/** "/cards/crd_123/fund" → "cards/fund": no ids in logs. */
const resource = (path: string) =>
  path
    .split('/')
    .filter((part) => part && !/^[a-z]{3}_/.test(part))
    .join('/');
