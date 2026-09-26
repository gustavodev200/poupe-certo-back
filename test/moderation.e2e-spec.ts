import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { httpServer } from './utils/http-server';

// Ver nota em products.e2e-spec.ts sobre o escopo destes testes (sem DB real).
// O caso "autenticado mas sem papel de operador → 403" exige um token
// Supabase válido de uma pessoa comum — não reproduzível sem login real.
describe('Moderation (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /moderation/queue sem token retorna 401', () => {
    return request(httpServer(app)).get('/moderation/queue').expect(401);
  });

  it('PATCH /moderation/products/:ean sem token retorna 401', () => {
    return request(httpServer(app))
      .patch('/moderation/products/12345678')
      .send({ decision: 'approve' })
      .expect(401);
  });

  it('PATCH /moderation/price-reports/:id sem token retorna 401', () => {
    return request(httpServer(app))
      .patch('/moderation/price-reports/11111111-1111-1111-1111-111111111111')
      .send({ decision: 'approve' })
      .expect(401);
  });
});
