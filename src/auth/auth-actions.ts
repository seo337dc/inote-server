import { fromNodeHeaders } from 'better-auth/node';
import { APIError } from 'better-auth/api';
import type { IncomingHttpHeaders } from 'http';
import { auth } from './auth';

// better-auth의 APIError를 그대로 노출하면 이 파일을 쓰는 쪽(users.service 등)도
// better-auth(ESM 전용)를 직접 import해야 해서, 단위테스트가 ts-jest(CJS)로 이 서비스를
// 로드할 때 깨짐. 그래서 여기서 plain class로 한 번 감싸서 내보냄 — better-auth import는
// 이 파일(e2e에서만 실제로 로드됨)에만 머무름.
export class AuthActionError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly body: Record<string, unknown>,
  ) {
    super(typeof body.message === 'string' ? body.message : 'Auth action failed');
  }
}

// setPassword는 better-auth에서 serverOnly라 클라이언트가 직접 못 부르고 서버에서
// auth.api를 직접 호출해야 함.
export async function setPasswordForSession(
  headers: IncomingHttpHeaders,
  newPassword: string,
) {
  try {
    await auth.api.setPassword({
      body: { newPassword },
      headers: fromNodeHeaders(headers),
    });
  } catch (e) {
    if (e instanceof APIError) {
      throw new AuthActionError(e.statusCode, e.body ?? { message: e.message });
    }
    throw e;
  }
}
