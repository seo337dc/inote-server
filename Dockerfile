# Koyeb 배포용 (NestJS + Prisma). Render에서는 render.yaml의 빌드/시작 명령을 그대로 쓴다.
FROM node:22-bookworm-slim

# Prisma 엔진이 OpenSSL을 필요로 한다 (slim 이미지에는 없음)
RUN apt-get update -y \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable
WORKDIR /app

# 의존성 먼저 설치(캐시 활용). start 때 `prisma migrate deploy`를 쓰므로 devDependencies(prisma CLI)도 설치한다.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --prod=false

COPY . .

# prisma.config.ts가 DATABASE_URL을 읽으므로 빌드 시에는 자리표시자 값을 준다 (generate는 DB에 접속하지 않음)
RUN DATABASE_URL="postgresql://build:build@localhost:5432/build" pnpm exec prisma generate \
  && pnpm run build

ENV NODE_ENV=production
# 풀러(PgBouncer) 환경에서 prisma migrate의 advisory lock이 타임아웃 나는 문제 회피
ENV PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK=1
# Koyeb에서 노출할 포트와 맞춘다
ENV PORT=8000
EXPOSE 8000

# 시작: 마이그레이션 적용 후 서버 실행 (pnpm을 거치지 않고 바로 실행해 런타임에 패키지 매니저를 받지 않는다)
CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy && node dist/main"]
