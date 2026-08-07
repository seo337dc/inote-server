import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('금융 지식 API (e2e) — 미인증 접근', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('/money/terms', () => {
    it('GET — 미인증 시 401', () => {
      return request(app.getHttpServer())
        .get('/api/v1/money/terms')
        .expect(401);
    });

    it('POST — 미인증 시 401', () => {
      return request(app.getHttpServer())
        .post('/api/v1/money/terms')
        .send({ term: 'PER', description: '주가수익비율', category: 'STOCK' })
        .expect(401);
    });
  });

  describe('/money/books', () => {
    it('GET — 미인증 시 401', () => {
      return request(app.getHttpServer())
        .get('/api/v1/money/books')
        .expect(401);
    });

    it('POST — 미인증 시 401', () => {
      return request(app.getHttpServer())
        .post('/api/v1/money/books')
        .send({
          title: '부의 추월차선',
          author: 'MJ 드마코',
          comment: '추천',
          category: 'ECONOMY',
        })
        .expect(401);
    });
  });
});
