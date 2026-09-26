import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { httpServer } from './utils/http-server';

// Ver nota em products.e2e-spec.ts sobre o escopo destes testes (sem DB real).
describe('PriceReports (e2e)', () => {
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

  it('POST /products/:ean/price-reports sem token retorna 401', () => {
    return request(httpServer(app))
      .post('/products/12345678/price-reports')
      .send({ marketId: '11111111-1111-1111-1111-111111111111', price: 10 })
      .expect(401);
  });

  it('POST /price-reports/:id/confirmations sem token retorna 401', () => {
    return request(httpServer(app))
      .post('/price-reports/11111111-1111-1111-1111-111111111111/confirmations')
      .expect(401);
  });
});
