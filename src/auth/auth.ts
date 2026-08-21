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
    'https://inote-money.vercel.app',
  ],

  session: {
    expiresIn: 60 * 60 * 24, // 1일
    updateAge: 60 * 60 * 12, // 12시간마다 자동 갱신
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
