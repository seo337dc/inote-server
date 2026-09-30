import { Test } from '@nestjs/testing';
import { CategoriesService } from './categories.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * 카테고리 드래그 이동(위치 변경) — 직접 작성할 테스트 골격
 *
 * ── 계약 (FE와 합의됨) ────────────────────────────────────────────────
 *  PATCH /categories/:id/move   body: { parentId: string | null, index: number }
 *   - parentId: 새 부모 (null이면 최상위) / index: "옮기는 것을 뺀 새 부모의 자식 목록"에서의 위치
 *   - 응답: 정리된 전체 카테고리 목록 (position 순)
 *   - 400: 자기 자신·자기 하위 밑으로 이동 / 이동 후 (하위 포함) 깊이가 3단계 초과
 *   - 404: 옮길 카테고리 또는 새 부모가 내 것이 아님(없음)
 *
 * ── 구현 계획 (mock을 어떻게 세울지 힌트) ────────────────────────────
 *  service.move(userId, id, dto)
 *   1) postCategory.findMany({ where: { userId } })          ← 내 카테고리 전부를 한 번에 조회
 *   2) 검증 후 메모리에서 새 부모/순서/깊이를 계산
 *   3) 바뀐 행만 postCategory.update({ where: { id }, data: { parentId?, depth?, position? } })
 *      → prisma.$transaction([...update들])  으로 한 번에 묶어 실행
 *   4) 마지막에 정렬된 전체 목록(findMany, orderBy position → createdAt)을 돌려줌
 *   ※ 그래서 findMany는 두 번 호출된다: 1번째 = 이동 전 목록, 2번째 = 이동 후 목록
 *
 * ── 골격 예시 ───────────────────────────────────────────────────────
 *  const cat = (id, parentId, depth, position) => ({ id, userId: 'u1', name: id, parentId, depth, position });
 *
 *  it('...', async () => {
 *    // Arrange: findMany.mockResolvedValueOnce([...이동 전 목록])   (필요하면 2번째 결과도)
 *    // Act:     const result = await service.move('u1', 'C', { parentId: null, index: 0 });
 *    // Assert:  postCategory.update 호출 인자(where/data), $transaction 호출, result, 예외 타입
 *  });
 *
 * 공통 테스트 트리(참고):   A(0) ─ A1(0) ─ A11(0)
 *                              └ A2(1)
 *                          B(1)
 *                          C(2)
 * ─────────────────────────────────────────────────────────────────────
 */
describe('CategoriesService — 이동/순서', () => {
  let service: CategoriesService;

  const mockPrisma = {
    postCategory: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      createMany: jest.fn(),
      create: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module = await Test.createTestingModule({
      providers: [
        CategoriesService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get(CategoriesService);
  });

  it('테스트 모듈이 만들어진다 (골격이 깨지지 않았는지 확인용 — 다른 테스트를 채운 뒤 지워도 됨)', () => {
    expect(service).toBeDefined();
  });

  describe('move — 검증 (예외)', () => {
    it.todo('옮길 카테고리가 내 목록에 없으면(남의 것 포함) NotFoundException');
    it.todo('새 부모(parentId)가 내 목록에 없으면 NotFoundException');
    it.todo('자기 자신 밑으로 옮기면 BadRequestException');
    it.todo('자기 하위 카테고리 밑으로 옮기면 BadRequestException');
    it.todo(
      '이동 후 3단계를 넘으면 BadRequestException (3단계 카테고리 밑에 넣기)',
    );
    it.todo(
      '하위가 딸린 카테고리는 하위 깊이까지 더해 3단계를 넘으면 BadRequestException',
    );
    it.todo('검증에 실패하면 update/$transaction이 한 번도 호출되지 않는다');
  });

  describe('move — 순서 변경 (같은 부모 안)', () => {
    it.todo(
      'C를 맨 앞(index 0)으로 옮기면 C=0, A=1, B=2로 position을 다시 매긴다',
    );
    it.todo(
      'index는 "옮기는 것을 뺀 목록" 기준이다 (A를 C 뒤로: index 2 → B=0, C=1, A=2)',
    );
    it.todo('index가 범위를 넘으면 맨 뒤로, 음수면 맨 앞으로 맞춘다');
    it.todo('위치가 바뀌지 않은 형제 행은 update하지 않는다 (바뀐 행만)');
    it.todo('제자리로 옮기면(변화 없음) update를 하지 않는다');
  });

  describe('move — 다른 부모로 이동', () => {
    it.todo(
      'B를 A 밑 index 1로 옮기면 B의 parentId=A, depth=2, position=1이 된다',
    );
    it.todo(
      '새 부모의 기존 자식들은 끼어든 자리 뒤로 position이 한 칸씩 밀린다',
    );
    it.todo(
      '원래 부모에서 빠진 자리의 형제 position을 0부터 다시 메운다 (C: 2 → 1)',
    );
    it.todo('최상위로 빼면(parentId null) depth가 1이 된다');
    it.todo(
      '하위가 딸린 카테고리(A1)를 옮기면 하위(A11)의 depth도 함께 바뀐다',
    );
  });

  describe('move — 저장과 응답', () => {
    it.todo('모든 update는 prisma.$transaction 하나로 묶어서 실행한다');
    it.todo(
      '응답은 이동 후 전체 목록이며 position → createdAt 순으로 정렬해 조회한 값이다',
    );
  });

  describe('findAll / create — position 이 함께 필요한 부분', () => {
    it.todo('findAll은 position → createdAt 순(orderBy)으로 조회한다');
    it.todo('기본 5개를 만들 때 position을 0~4로 채운다');
    it.todo(
      'create는 새 카테고리를 같은 부모의 마지막 position(형제 수)에 넣는다',
    );
  });

  // ── 이 파일이 아닌 다른 곳에서 다룰 것 (메모) ──────────────────────
  //  · DTO 검증: src/categories/dto/move-category.dto.spec.ts 골격 참고
  //  · 기존 카테고리에 position 채우기(마이그레이션): 단위 테스트가 아니라 통합 단계(테스트 전용 DB)에서 확인
  //  · 로그인 필요(AuthGuard)/실제 HTTP 응답: 통합 테스트에서 확인
});
