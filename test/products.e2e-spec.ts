import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { httpServer } from './utils/http-server';

// Estes testes cobrem só o que roda ANTES de qualquer acesso a banco (guard
// de autenticação e pipe de validação Zod) — não exigem DATABASE_URL real.
// Os caminhos felizes (busca/detalhe com dado real, aprovação/rejeição,
// etc.) precisam de um Postgres de teste configurado — ver quickstart.md.
describe('Products (e2e)', () => {
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

  it('POST /products sem token retorna 401', () => {
    return request(httpServer(app))
      .post('/products')
      .send({
        ean: '12345678',
        name: 'X',
        brand: 'Y',
        qty: '1kg',
        category: 'merc',
      })
      .expect(401);
  });

  it('POST /products com token inválido retorna 401', () => {
    return request(httpServer(app))
      .post('/products')
      .set('Authorization', 'Bearer token-invalido')
      .send({
        ean: '12345678',
        name: 'X',
        brand: 'Y',
        qty: '1kg',
        category: 'merc',
      })
      .expect(401);
  });

  it('GET /products/search com página inválida retorna 400 antes de tocar o banco', () => {
    return request(httpServer(app)).get('/products/search?page=-1').expect(400);
  });

  it('GET /products/ean/:ean/lookup sem token retorna 401 (não consulta o Open Food Facts)', () => {
    return request(httpServer(app))
      .get('/products/ean/7891000100103/lookup')
      .expect(401);
  });

  it('GET /products/ean/:ean/lookup com token inválido retorna 401', () => {
    return request(httpServer(app))
      .get('/products/ean/7891000100103/lookup')
      .set('Authorization', 'Bearer token-invalido')
      .expect(401);
  });

  it('GET /products/ean/:ean/exists com EAN mal formado retorna 400', () => {
    return request(httpServer(app)).get('/products/ean/abc/exists').expect(400);
  });
});
