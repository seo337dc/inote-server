import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

// AuthGuard 다음에 실행되는 걸 전제로 함(request.user가 이미 채워져 있어야 함) —
// 컨트롤러에서 반드시 @UseGuards(AuthGuard, AdminGuard) 순서로 붙일 것.
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();

    if (request.user?.role !== 'ADMIN') {
      throw new ForbiddenException('관리자만 접근할 수 있습니다.');
    }

    return true;
  }
}
