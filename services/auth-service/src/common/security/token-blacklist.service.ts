import { Injectable, Logger } from '@nestjs/common';

type RedisClient = {
  on(event: 'error', listener: (error: Error) => void): void;
  connect(): Promise<void>;
  set(key: string, value: string, mode: 'EX', ttl: number): Promise<unknown>;
  get(key: string): Promise<string | null>;
};

@Injectable()
export class TokenBlacklistService {
  private readonly logger = new Logger(TokenBlacklistService.name);
  private client: RedisClient | null = null;

  private createRedisClient(): RedisClient | null {
    try {
      // Lazy load to avoid hard-fail if dependency is not installed yet.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const RedisCtor = require('ioredis');

      const host = process.env.REDIS_HOST || 'redis-master.fieldops-data.svc.cluster.local';
      const port = Number(process.env.REDIS_PORT || '6379');
      const password = process.env.REDIS_PASSWORD || undefined;

      return new RedisCtor({
        host,
        port,
        password,
        maxRetriesPerRequest: 2,
        lazyConnect: true,
      }) as RedisClient;
    } catch {
      this.logger.warn('ioredis dependency not available; JWT blacklist is disabled.');
      return null;
    }
  }

  private getClient(): RedisClient | null {
    if (process.env.JWT_BLACKLIST_ENABLED === 'false') {
      return null;
    }

    if (!this.client) {
      this.client = this.createRedisClient();

      this.client?.on('error', (err: Error) => {
        this.logger.warn(`Redis blacklist unavailable: ${err.message}`);
      });
    }

    return this.client;
  }

  private key(jti: string): string {
    return `jwt:blacklist:${jti}`;
  }

  async blacklist(jti: string, ttlSeconds: number): Promise<void> {
    if (!jti || ttlSeconds <= 0) {
      return;
    }

    const client = this.getClient();
    if (!client) {
      return;
    }

    try {
      await client.connect().catch(() => undefined);
      await client.set(this.key(jti), '1', 'EX', ttlSeconds);
    } catch (error) {
      this.logger.warn(`Failed to blacklist JWT ${jti}: ${(error as Error).message}`);
    }
  }

  async isBlacklisted(jti: string | undefined): Promise<boolean> {
    if (!jti) {
      return false;
    }

    const client = this.getClient();
    if (!client) {
      return false;
    }

    try {
      await client.connect().catch(() => undefined);
      const value = await client.get(this.key(jti));
      return value !== null;
    } catch (error) {
      this.logger.warn(`Failed to check JWT blacklist: ${(error as Error).message}`);
      return false;
    }
  }
}
