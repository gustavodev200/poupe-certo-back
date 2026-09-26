import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { httpServer } from './utils/http-server';

// Ver nota em products.e2e-spec.ts sobre o escopo destes testes (sem DB real).
describe('Users stats/contributions (e2e)', () => {
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

  it('GET /users/me/stats sem token retorna 401', () => {
    return request(httpServer(app)).get('/users/me/stats').expect(401);
  });

  it('GET /users/me/contributions sem token retorna 401', () => {
    return request(httpServer(app)).get('/users/me/contributions').expect(401);
  });
});
