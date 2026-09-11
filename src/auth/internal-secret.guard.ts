import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

// inote-ai 같은 내부 서비스가 고정 시크릿 헤더로 호출하는 전용 엔드포인트에 씀.
// 로그인 세션과는 무관 — 사람이 아니라 서버끼리의 호출을 검증.
@Injectable()
export class InternalSecretGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const secret = request.headers['x-internal-secret'];
    if (!secret || secret !== process.env.INTERNAL_SECRET) {
      throw new UnauthorizedException('unauthorized');
    }
    return true;
  }
}
