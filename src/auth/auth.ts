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
    'https://inote-blog.vercel.app',
  ],

  session: {
    expiresIn: 60 * 60 * 24, // 1일
    updateAge: 60 * 60 * 12, // 12시간마다 자동 갱신
  },

  // inote-blog: 이메일/비밀번호 가입 지원 (지금은 이메일 인증 없이 가입 즉시 로그인 —
  // 필요해지면 이메일 서비스(Resend 등) 붙이고 requireEmailVerification: true로 전환)
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
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
