// 쿼리 DTO·가드 테스트 목록 (dto/list-admin-embeddings-query.dto.ts, 컨트롤러 admin-embeddings.controller.ts — 구현 예정)
//
// 접근 방법
//   - DTO는 class-validator의 validate()에 plainToInstance(ListAdminEmbeddingsQueryDto, {...})를 넣어 오류 개수를 본다
//     (admin-users의 ListAdminUsersQueryDto와 같은 방식. 기본값은 인스턴스를 만든 뒤 필드를 읽어 확인).
//   - 가드는 컨트롤러에 @UseGuards(AuthGuard, AdminGuard)가 붙어 있는지 Reflect.getMetadata('__guards__', Controller)로 확인하거나,
//     AdminGuard를 직접 호출해 role이 ADMIN이 아니면 ForbiddenException을 던지는지 본다(admin.guard.ts는 이미 있다).
//   - 주의: AuthGuard 다음에 AdminGuard 순서여야 한다(AdminGuard는 request.user가 채워져 있다고 가정한다).

import 'reflect-metadata';
import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AuthGuard } from '../../auth/auth.guard';
import { AdminGuard } from '../../auth/admin.guard';
import { AdminEmbeddingsController } from './admin-embeddings.controller';
import { ListAdminEmbeddingsQueryDto } from './dto/list-admin-embeddings-query.dto';

// better-auth가 ESM이라 AuthGuard 파일을 그대로 불러오지 못한다 — 순서 확인에는 클래스 정체성만 필요하다 (uploads.controller.spec.ts와 같은 방식)
jest.mock('../../auth/auth.guard', () => ({ AuthGuard: class {} }));

const errorsFor = async (query: Record<string, unknown>) =>
  validate(plainToInstance(ListAdminEmbeddingsQueryDto, query));

describe('ListAdminEmbeddingsQueryDto', () => {
  it('아무것도 안 주면 page 1, pageSize 20, status all', async () => {
    const dto = plainToInstance(ListAdminEmbeddingsQueryDto, {});

    expect(await validate(dto)).toHaveLength(0);
    expect(dto).toMatchObject({ page: 1, pageSize: 20, status: 'all' });
  });
  it('page가 1 미만이거나 정수가 아니면 검증에 실패한다', async () => {
    for (const page of ['0', '-1', '1.5', 'abc']) {
      expect(await errorsFor({ page })).not.toHaveLength(0);
    }
  });
  it('pageSize가 1 미만이거나 100을 넘으면 검증에 실패한다', async () => {
    for (const pageSize of ['0', '101']) {
      expect(await errorsFor({ pageSize })).not.toHaveLength(0);
    }
    expect(await errorsFor({ pageSize: '100' })).toHaveLength(0);
  });
  it('status가 all|incomplete|failed|done|excluded 밖의 값이면 검증에 실패한다', async () => {
    for (const status of ['unknown', 'outdated', 'ALL', '']) {
      expect(await errorsFor({ status })).not.toHaveLength(0);
    }
    for (const status of ['all', 'incomplete', 'failed', 'done', 'excluded']) {
      expect(await errorsFor({ status })).toHaveLength(0);
    }
  });
  it('쿼리 문자열의 숫자("2")가 숫자로 변환된다', () => {
    const dto = plainToInstance(ListAdminEmbeddingsQueryDto, {
      page: '2',
      pageSize: '50',
    });

    expect(dto).toMatchObject({ page: 2, pageSize: 50 });
  });
});

describe('GET /admin/embeddings 권한', () => {
  it('컨트롤러에 AuthGuard와 AdminGuard가 이 순서로 붙어 있다', () => {
    // AdminGuard는 AuthGuard가 request.user를 채운 뒤에 실행된다고 가정한다
    const guards = Reflect.getMetadata(
      '__guards__',
      AdminEmbeddingsController,
    ) as unknown[];

    expect(guards).toEqual([AuthGuard, AdminGuard]);
  });
  it('ADMIN이 아닌 사용자는 403(ForbiddenException)이다', () => {
    const contextFor = (user: unknown) =>
      ({
        switchToHttp: () => ({ getRequest: () => ({ user }) }),
      }) as ExecutionContext;
    const guard = new AdminGuard();

    expect(() => guard.canActivate(contextFor({ role: 'USER' }))).toThrow(
      ForbiddenException,
    );
    expect(() => guard.canActivate(contextFor(undefined))).toThrow(
      ForbiddenException,
    );
    expect(guard.canActivate(contextFor({ role: 'ADMIN' }))).toBe(true);
  });
});
