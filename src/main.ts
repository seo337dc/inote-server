import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { toNodeHandler } from 'better-auth/node';
import { auth } from './auth/auth';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 1. CORS 먼저 — Better Auth 요청에도 적용되어야 하므로 최우선 등록
  app.enableCors({
    origin: ['http://localhost:3000', 'http://localhost:3100', 'https://inote-money.vercel.app'],
    credentials: true,
  });

  // 2. Better Auth 핸들러 — NestJS 라우터보다 먼저 등록
  app.use((req: any, res: any, next: any) => {
    if (req.url?.startsWith('/api/v1/auth')) {
      return toNodeHandler(auth)(req, res);
    }
    return next();
  });

  app.setGlobalPrefix('api/v1');

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const config = new DocumentBuilder()
    .setTitle('iNote Server API')
    .setDescription('iNote 시리즈 공통 백엔드 API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, config));

  const port = process.env.PORT ?? 3200;
  await app.listen(port);
  console.log(`🚀 Server running on http://localhost:${port}`);
  console.log(`📚 Swagger: http://localhost:${port}/api/docs`);
  console.log(`🔐 Auth: http://localhost:${port}/api/v1/auth`);
}

bootstrap();
