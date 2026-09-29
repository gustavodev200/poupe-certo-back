import { createHash } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';

const TIMEOUT_MS = 8000;
const FOLDER = 'poupe-certo/products';

const uploadResponseSchema = z.object({
  secure_url: z.string().url(),
});

// Assinatura do Upload API: SHA-1 dos parâmetros assinados em ordem
// alfabética ("a=1&b=2") com o API secret concatenado no fim, sem separador.
// `file`, `api_key`, `cloud_name` e `resource_type` ficam fora da assinatura.
// https://cloudinary.com/documentation/authentication_signatures
export function signParams(
  params: Record<string, string>,
  apiSecret: string,
): string {
  const toSign = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&');
  return createHash('sha1')
    .update(toSign + apiSecret)
    .digest('hex');
}

// Upload server-side sem SDK (uma única chamada, research.md#3). O Cloudinary
// baixa a URL remota ele mesmo; o back nunca trafega bytes da imagem.
@Injectable()
export class CloudinaryService {
  private readonly logger = new Logger(CloudinaryService.name);
  private readonly cloudName?: string;
  private readonly apiKey?: string;
  private readonly apiSecret?: string;

  constructor(config: ConfigService) {
    this.cloudName = config.get<string>('CLOUDINARY_CLOUD_NAME') || undefined;
    this.apiKey = config.get<string>('CLOUDINARY_API_KEY') || undefined;
    this.apiSecret = config.get<string>('CLOUDINARY_API_SECRET') || undefined;
    if (!this.isEnabled()) {
      this.logger.warn(
        'CLOUDINARY_* não configurado — produtos serão cadastrados sem foto.',
      );
    }
  }

  isEnabled(): boolean {
    return Boolean(this.cloudName && this.apiKey && this.apiSecret);
  }

  /**
   * Sobe a imagem de `remoteUrl` com public_id determinístico por EAN.
   * `overwrite=false` torna a operação idempotente: se o asset já existe o
   * Cloudinary devolve o existente. Nunca lança — falha vira `null` para não
   * bloquear o cadastro (FR-013).
   */
  async uploadProductImage(
    ean: string,
    remoteUrl: string,
  ): Promise<string | null> {
    if (!this.cloudName || !this.apiKey || !this.apiSecret) return null;

    const signed = {
      overwrite: 'false',
      public_id: `${FOLDER}/${ean}`,
      timestamp: String(Math.floor(Date.now() / 1000)),
    };
    const body = new URLSearchParams({
      ...signed,
      file: remoteUrl,
      api_key: this.apiKey,
      signature: signParams(signed, this.apiSecret),
    });

    try {
      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${encodeURIComponent(this.cloudName)}/image/upload`,
        { method: 'POST', body, signal: AbortSignal.timeout(TIMEOUT_MS) },
      );
      if (!response.ok) {
        // Corpo de erro do Cloudinary não contém o secret, mas logamos só o
        // status para não vazar nada de configuração em log de produção.
        this.logger.warn(
          `Upload Cloudinary falhou para ${ean}: HTTP ${response.status}`,
        );
        return null;
      }
      const parsed = uploadResponseSchema.safeParse(await response.json());
      if (!parsed.success) {
        this.logger.warn(`Resposta inesperada do Cloudinary para ${ean}`);
        return null;
      }
      return parsed.data.secure_url;
    } catch (error) {
      this.logger.warn(
        `Upload Cloudinary falhou para ${ean}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }
}
