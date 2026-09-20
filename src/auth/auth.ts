import 'dotenv/config';
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { oneTimeToken } from 'better-auth/plugins';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const isProduction = process.env.NODE_ENV === 'production';

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),

  baseURL: process.env.BETTER_AUTH_URL ?? 'http://localhost:3200',
  basePath: '/api/v1/auth',

  trustedOrigins: [
    'http://localhost:3000',
    'http://localhost:3100',
    'http://localhost:3011',
    'https://inote-money.vercel.app',
    'https://inote-main.vercel.app',
  ],

  session: {
    expiresIn: 60 * 60 * 24, // 1일
    updateAge: 60 * 60 * 12, // 12시간마다 자동 갱신
  },

  // OAuth state 검증 실패 시 fallback 목적지. 클라이언트가 매번 넘기는 errorCallbackURL로
  // 대부분 처리되지만, "이미 소비된 state 재사용"(뒤로가기 후 재로그인 시도) 같은 경우는
  // better-auth가 원래 앱 정보를 복구 못 해서 이 기본값으로 떨어짐 — 이때 로그인 페이지로
  // 보내면, 첫 로그인은 이미 성공한 상태라 세션이 있어 자동으로 홈으로 리다이렉트됨.
  // 지금은 inote 하나로 고정 — inote-money 등 다른 프론트도 실서비스되면 앱별로 구분해서
  // 보내는 방식(예: 별도 쿠키로 origin 기억)으로 확장 필요 (inote-money LEARNING.md 참고).
  onAPIError: {
    errorURL:
      process.env.AUTH_ERROR_FALLBACK_URL ?? 'http://localhost:3011/login',
  },

  // inote(웹): 이메일/비밀번호 가입 지원 (지금은 이메일 인증 없이 가입 즉시 로그인 —
  // 필요해지면 이메일 서비스(Resend 등) 붙이고 requireEmailVerification: true로 전환)
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },

  user: {
    additionalFields: {
      role: {
        type: 'string',
        input: false, // 가입 요청 바디로 임의 지정 못 하게 막음 — DB에서 직접 관리
      },
    },
  },

  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    },
  },

  advanced: {
    crossSubDomainCookies: {
      enabled: false,
    },
    defaultCookieAttributes: {
      sameSite: isProduction ? 'none' : 'lax',
      secure: isProduction,
    },
  },

  // RN(Expo) 네이티브 앱: 시스템 브라우저에서 받은 세션을 앱 WebView 쿠키로 교환하는 용도
  plugins: [oneTimeToken({ expiresIn: 1 })],
});

export type Auth = typeof auth;
