import type { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types';

// app.getHttpServer() é tipado como `any` — este cast único evita repetir
// `as App` (ou desabilitar a regra) em cada teste e2e.
export function httpServer(app: INestApplication): App {
  return app.getHttpServer() as App;
}
