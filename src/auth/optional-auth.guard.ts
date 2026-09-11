import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { fromNodeHeaders } from 'better-auth/node';
import { auth } from './auth';

// AuthGuard와 달리 로그인 안 했어도 통과시킴 — 로그인했으면 request.user를 채워주고,
// 안 했으면 request.user는 그냥 undefined로 남김 (컨트롤러/서비스가 각자 판단).
@Injectable()
export class OptionalAuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    const session = await auth.api.getSession({
      headers: fromNodeHeaders(request.headers),
    });

    if (session) {
      request.user = session.user;
      request.session = session.session;
    }

    return true;
  }
}
