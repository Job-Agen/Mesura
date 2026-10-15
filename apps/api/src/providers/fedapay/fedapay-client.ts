import { Logger, ServiceUnavailableException } from '@nestjs/common';

/** Minimal FedaPay REST client (https://docs.fedapay.com): the key decides sandbox or live. */
export class FedaPayClient {
  private readonly logger = new Logger(FedaPayClient.name);
  readonly sandbox: boolean;
  private readonly baseUrl: string;

  constructor(private readonly secretKey: string) {
    this.sandbox = secretKey.startsWith('sk_sandbox_');
    this.baseUrl = this.sandbox ? 'https://sandbox-api.fedapay.com/v1' : 'https://api.fedapay.com/v1';
  }

  async call<T = unknown>(method: 'GET' | 'POST' | 'PUT', path: string, body?: unknown): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: { Authorization: `Bearer ${this.secretKey}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      // The body may echo customer data: log the status only.
      this.logger.error(`FedaPay ${method} ${path.split('/')[1]} failed with HTTP ${response.status}`);
      throw new ServiceUnavailableException('Le service Mobile Money ne répond pas. Réessayez dans un instant.');
    }
    return (await response.json()) as T;
  }
}
