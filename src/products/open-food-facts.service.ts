import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  NOT_FOUND,
  parseOffResponse,
  type EanLookup,
} from './open-food-facts.parse';

const FOUND_TTL_MS = 24 * 60 * 60 * 1000;
const NOT_FOUND_TTL_MS = 60 * 60 * 1000;
// Erro/timeout fica pouco tempo em cache: segura rajada de repetição sem
// "congelar" o EAN como inexistente se o OFF só estava instável.
const UNAVAILABLE_TTL_MS = 60 * 1000;
const MAX_ENTRIES = 1000;
const TIMEOUT_MS = 4000;

const FIELDS =
  'product_name,product_name_pt,brands,quantity,image_front_url,categories_tags';

interface CacheEntry {
  value: EanLookup;
  expiresAt: number;
}

// Cache e dedupe são por instância (serverless na Vercel pode ter várias e
// reinicia) — aceitável: perder o cache só custa uma nova consulta
// (research.md#2). O EAN já chega validado pelo eanSchema no controller.
@Injectable()
export class OpenFoodFactsService {
  private readonly logger = new Logger(OpenFoodFactsService.name);
  private readonly cache = new Map<string, CacheEntry>();
  private readonly inFlight = new Map<string, Promise<EanLookup>>();
  private readonly userAgent: string;

  constructor(config: ConfigService) {
    this.userAgent = config.getOrThrow<string>('OFF_USER_AGENT');
  }

  lookup(ean: string): Promise<EanLookup> {
    const cached = this.cache.get(ean);
    if (cached && cached.expiresAt > Date.now()) {
      return Promise.resolve(cached.value);
    }

    const pending = this.inFlight.get(ean);
    if (pending) return pending;

    const request = this.fetchAndCache(ean).finally(() => {
      this.inFlight.delete(ean);
    });
    this.inFlight.set(ean, request);
    return request;
  }

  private async fetchAndCache(ean: string): Promise<EanLookup> {
    let value: EanLookup;
    let ttl: number;
    try {
      const response = await fetch(
        `https://world.openfoodfacts.org/api/v2/product/${ean}.json?fields=${FIELDS}`,
        {
          headers: { 'User-Agent': this.userAgent, Accept: 'application/json' },
          signal: AbortSignal.timeout(TIMEOUT_MS),
          redirect: 'error',
        },
      );
      if (response.status === 404) {
        value = NOT_FOUND;
        ttl = NOT_FOUND_TTL_MS;
      } else if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      } else {
        value = parseOffResponse(await response.json());
        ttl = value.found ? FOUND_TTL_MS : NOT_FOUND_TTL_MS;
      }
    } catch (error) {
      this.logger.warn(
        `Open Food Facts indisponível para ${ean}: ${error instanceof Error ? error.message : String(error)}`,
      );
      value = NOT_FOUND;
      ttl = UNAVAILABLE_TTL_MS;
    }

    this.store(ean, value, ttl);
    return value;
  }

  private store(ean: string, value: EanLookup, ttl: number) {
    this.cache.delete(ean);
    if (this.cache.size >= MAX_ENTRIES) {
      // Map itera em ordem de inserção — a primeira chave é a mais antiga.
      const oldest = this.cache.keys().next().value;
      if (oldest !== undefined) this.cache.delete(oldest);
    }
    this.cache.set(ean, { value, expiresAt: Date.now() + ttl });
  }
}
