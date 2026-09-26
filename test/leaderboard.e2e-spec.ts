import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { httpServer } from './utils/http-server';

// GET /leaderboard sem query é público e toca o banco — exige DATABASE_URL
// real para ser testado ponta a ponta (ver quickstart.md). Aqui cobrimos só
// a validação Zod, que roda antes de qualquer acesso a banco.
describe('Leaderboard (e2e)', () => {
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

  it('GET /leaderboard?limit=-1 retorna 400 antes de tocar o banco', () => {
    return request(httpServer(app)).get('/leaderboard?limit=-1').expect(400);
  });
});
