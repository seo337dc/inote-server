import { Test } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * 카테고리 위치 이동 — PATCH /categories/:id/move   body: { parentId: string | null, index: number }
 *  - parentId: 새 부모 (null이면 최상위) / index: "옮기는 것을 뺀 새 부모의 자식 목록"에서의 위치
 *  - 응답: 정리된 전체 카테고리 목록 (position → createdAt 순)
 *  - 400: 자기 자신·자기 하위 밑으로 이동 / 이동 후 (하위 포함) 깊이가 3단계 초과
 *  - 404: 옮길 카테고리 또는 새 부모가 내 것이 아님(없음)
 *  - 409: 다른 부모로 옮길 때 그 아래에 같은 이름이 이미 있음 (create·rename과 같은 규칙)
 *
 * 구현(service.move)은 이렇게 동작한다
 *  1) postCategory.findMany({ where: { userId } })  ← 내 카테고리 전부를 한 번에 조회
 *  2) 검증 후 메모리에서 새 부모/순서/깊이를 계산
 *  3) 값이 바뀐 행만 postCategory.update → prisma.$transaction([...update들]) 한 번으로 실행
 *  4) 마지막에 정렬된 전체 목록(findMany, orderBy position → createdAt)을 돌려줌
 *  ※ 그래서 findMany는 두 번 호출된다: 1번째 = 이동 전 목록, 2번째 = 이동 후 목록
 *
 * 공통 테스트 트리:   A(0) ─ A1(0) ─ A11(0)
 *                        └ A2(1)
 *                    B(1)
 *                    C(2)
 */
describe('CategoriesService — 이동/순서', () => {
  let service: CategoriesService;

  const mockPrisma = {
    postCategory: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      createMany: jest.fn(),
      create: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  type Row = {
    id: string;
    userId: string;
    name: string;
    parentId: string | null;
    depth: number;
    position: number;
    createdAt: Date;
  };

  // 만든 순서(createdAt)가 호출 순서대로 늘어나게 한다 — position이 같을 때의 정렬 기준
  let created = 0;
  const cat = (
    id: string,
    parentId: string | null,
    depth: number,
    position: number,
    name = id,
  ): Row => ({
    id,
    userId: 'u1',
    name,
    parentId,
    depth,
    position,
    createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, created++)),
  });

  const tree = (): Row[] => [
    cat('A', null, 1, 0),
    cat('A1', 'A', 2, 0),
    cat('A11', 'A1', 3, 0),
    cat('A2', 'A', 2, 1),
    cat('B', null, 1, 1),
    cat('C', null, 1, 2),
  ];

  // 이동 전 목록과 이동 후 목록(응답)을 순서대로 돌려준다
  const AFTER = [{ id: 'after-list' }];
  const arrange = (before: Row[] = tree()) => {
    // 한 테스트에서 여러 번 불러도(앞의 이동이 예외로 끝나 두 번째 값이 남는 경우) 이전 대기열이 섞이지 않게 비운다
    mockPrisma.postCategory.findMany.mockReset();
    mockPrisma.postCategory.findMany
      .mockResolvedValueOnce(before)
      .mockResolvedValueOnce(AFTER);
  };

  // 호출된 update들을 { 카테고리 id: 바꾼 값 } 으로
  const updates = (): Record<string, Record<string, unknown>> =>
    Object.fromEntries(
      mockPrisma.postCategory.update.mock.calls.map(
        ([arg]: [{ where: { id: string }; data: Record<string, unknown> }]) => [
          arg.where.id,
          arg.data,
        ],
      ),
    );

  // 호출 기록뿐 아니라 mockResolvedValueOnce로 쌓아 둔 값도 지운다 — 검증에 실패하는 테스트는 arrange()의 두 번째 값을
  // 쓰지 않고 끝나서, clearAllMocks만 하면 그 값이 다음 테스트의 첫 조회로 새어 들어간다
  const resetMocks = () => {
    jest.resetAllMocks();
    mockPrisma.postCategory.update.mockImplementation(
      (arg: { where: { id: string } }) => ({ updated: arg.where.id }),
    );
    mockPrisma.$transaction.mockResolvedValue([]);
  };

  beforeEach(async () => {
    resetMocks();
    created = 0;

    const module = await Test.createTestingModule({
      providers: [
        CategoriesService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get(CategoriesService);
  });

  describe('move — 검증 (예외)', () => {
    it('옮길 카테고리가 내 목록에 없으면(남의 것 포함) NotFoundException', async () => {
      arrange();

      await expect(
        service.move('u1', 'others-category', { parentId: null, index: 0 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('내 카테고리만 읽는다 — 목록은 userId로 조회한다 (남의 것은 애초에 목록에 없다)', async () => {
      arrange();

      await service.move('u1', 'C', { parentId: null, index: 0 });

      expect(mockPrisma.postCategory.findMany).toHaveBeenNthCalledWith(1, {
        where: { userId: 'u1' },
      });
    });

    it('새 부모(parentId)가 내 목록에 없으면 NotFoundException', async () => {
      arrange();

      await expect(
        service.move('u1', 'C', { parentId: 'no-such', index: 0 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('자기 자신 밑으로 옮기면 BadRequestException', async () => {
      arrange();

      await expect(
        service.move('u1', 'A', { parentId: 'A', index: 0 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('깊이 제한에 걸리지 않는 얕은 카테고리도 자기 자신 밑으로는 못 옮긴다 (자기 검사 자체를 확인)', async () => {
      // B(1단계, 하위 없음)를 B 밑으로 → 깊이는 2단계라 깊이 검사로는 통과한다
      arrange();
      await expect(
        service.move('u1', 'B', { parentId: 'B', index: 0 }),
      ).rejects.toThrow(BadRequestException);

      // A2(2단계, 하위 없음)를 A2 밑으로 → 깊이는 3단계라 깊이 검사로는 통과한다
      arrange();
      await expect(
        service.move('u1', 'A2', { parentId: 'A2', index: 0 }),
      ).rejects.toThrow(BadRequestException);
      expect(mockPrisma.postCategory.update).not.toHaveBeenCalled();
    });

    it('자기 하위 카테고리 밑으로 옮기면 BadRequestException (자식·손자 모두)', async () => {
      arrange();
      await expect(
        service.move('u1', 'A', { parentId: 'A1', index: 0 }),
      ).rejects.toThrow(BadRequestException);

      arrange();
      await expect(
        service.move('u1', 'A', { parentId: 'A11', index: 0 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('이동 후 3단계를 넘으면 BadRequestException (3단계 카테고리 밑에 넣기)', async () => {
      arrange();

      await expect(
        service.move('u1', 'C', { parentId: 'A11', index: 0 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('3단계까지는 옮길 수 있다 (2단계 카테고리 밑에 하위 없는 카테고리 넣기)', async () => {
      arrange();

      await service.move('u1', 'B', { parentId: 'A2', index: 0 });

      expect(updates().B).toEqual({ parentId: 'A2', depth: 3, position: 0 });
    });

    it('하위가 딸린 카테고리는 하위 깊이까지 더해 3단계를 넘으면 BadRequestException', async () => {
      // A1(2단계) 밑에 A11(3단계)이 있다 → A1을 A2(2단계) 밑으로 옮기면 A1=3, A11=4
      arrange();
      await expect(
        service.move('u1', 'A1', { parentId: 'A2', index: 0 }),
      ).rejects.toThrow(BadRequestException);

      // A(1단계)는 가장 깊은 하위가 3단계 → B(1단계) 밑으로 옮기면 A=2, A11=4
      arrange();
      await expect(
        service.move('u1', 'A', { parentId: 'B', index: 0 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('검증에 실패하면 update/$transaction이 한 번도 호출되지 않는다', async () => {
      const invalid: [string, string | null][] = [
        ['no-such', null], // 없는 카테고리
        ['C', 'no-such'], // 없는 부모
        ['A', 'A'], // 자기 자신
        ['A', 'A11'], // 자기 하위
        ['C', 'A11'], // 3단계 초과
      ];
      for (const [id, parentId] of invalid) {
        arrange();
        await expect(
          service.move('u1', id, { parentId, index: 0 }),
        ).rejects.toThrow();
      }

      expect(mockPrisma.postCategory.update).not.toHaveBeenCalled();
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('다른 부모로 옮길 곳에 같은 이름이 이미 있으면 ConflictException (create·rename과 같은 규칙)', async () => {
      // A 밑에 이름이 "B"인 카테고리가 따로 있다 → 최상위 B를 A 밑으로 옮기면 이름이 겹친다
      arrange([...tree(), cat('X', 'A', 2, 2, 'B')]);

      await expect(
        service.move('u1', 'B', { parentId: 'A', index: 0 }),
      ).rejects.toThrow(ConflictException);
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('같은 이름이 다른 부모 아래에 있는 것은 문제없다 (형제가 아니면 허용)', async () => {
      // 최상위 "B"를 A2 밑으로 옮긴다 — A 밑의 "B"(X)는 A2의 형제가 아니다
      arrange([...tree(), cat('X', 'A', 2, 2, 'B')]);

      await service.move('u1', 'B', { parentId: 'A2', index: 0 });

      expect(updates().B).toBeDefined();
    });
  });

  describe('move — 순서 변경 (같은 부모 안)', () => {
    it('C를 맨 앞(index 0)으로 옮기면 C=0, A=1, B=2로 position을 다시 매긴다', async () => {
      arrange();

      await service.move('u1', 'C', { parentId: null, index: 0 });

      expect(updates()).toEqual({
        C: { position: 0 },
        A: { position: 1 },
        B: { position: 2 },
      });
    });

    it('index는 "옮기는 것을 뺀 목록" 기준이다 (A를 C 뒤로: index 2 → B=0, C=1, A=2)', async () => {
      arrange();

      await service.move('u1', 'A', { parentId: null, index: 2 });

      expect(updates()).toEqual({
        B: { position: 0 },
        C: { position: 1 },
        A: { position: 2 },
      });
    });

    it('index가 범위를 넘으면 맨 뒤로, 음수면 맨 앞으로 맞춘다', async () => {
      arrange();
      await service.move('u1', 'A', { parentId: null, index: 99 });
      expect(updates()).toEqual({
        B: { position: 0 },
        C: { position: 1 },
        A: { position: 2 },
      });

      resetMocks();
      arrange();
      await service.move('u1', 'C', { parentId: null, index: -5 });
      expect(updates()).toEqual({
        C: { position: 0 },
        A: { position: 1 },
        B: { position: 2 },
      });
    });

    it('위치가 바뀌지 않은 형제 행은 update하지 않는다 (바뀐 행만)', async () => {
      arrange();

      // B를 맨 앞으로: B=0, A=1 — C는 그대로 2
      await service.move('u1', 'B', { parentId: null, index: 0 });

      expect(Object.keys(updates()).sort()).toEqual(['A', 'B']);
    });

    it('제자리로 옮기면(변화 없음) update도 $transaction도 하지 않는다', async () => {
      arrange();

      // B는 이미 최상위 1번째 — 뺀 목록 [A, C]에서 index 1이 제자리
      await service.move('u1', 'B', { parentId: null, index: 1 });

      expect(mockPrisma.postCategory.update).not.toHaveBeenCalled();
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('같은 부모 안에서 순서만 바꾸면 parentId·depth는 건드리지 않는다', async () => {
      arrange();

      await service.move('u1', 'A2', { parentId: 'A', index: 0 });

      expect(updates()).toEqual({
        A2: { position: 0 },
        A1: { position: 1 },
      });
    });
  });

  describe('move — 다른 부모로 이동', () => {
    it('B를 A 밑 index 1로 옮기면 B의 parentId=A, depth=2, position=1이 된다', async () => {
      arrange();

      await service.move('u1', 'B', { parentId: 'A', index: 1 });

      // position이 우연히 이전 값(1)과 같아도 새 자리를 통째로 적는다
      expect(updates().B).toEqual({ parentId: 'A', depth: 2, position: 1 });
    });

    it('새 부모의 기존 자식들은 끼어든 자리 뒤로 position이 한 칸씩 밀린다', async () => {
      arrange();

      // B를 A 밑 맨 앞(index 0)으로 → A1: 0→1, A2: 1→2
      await service.move('u1', 'B', { parentId: 'A', index: 0 });

      expect(updates().A1).toEqual({ position: 1 });
      expect(updates().A2).toEqual({ position: 2 });
      expect(updates().B).toEqual({ parentId: 'A', depth: 2, position: 0 });
    });

    it('원래 부모에서 빠진 자리의 형제 position을 0부터 다시 메운다 (C: 2 → 1)', async () => {
      arrange();

      await service.move('u1', 'B', { parentId: 'A', index: 0 });

      // 최상위에 A(0), C(2)가 남는다 → C가 1로 올라온다. 이미 0인 A는 그대로
      expect(updates().C).toEqual({ position: 1 });
      expect(updates().A).toBeUndefined();
    });

    it('최상위로 빼면(parentId null) depth가 1이 된다', async () => {
      arrange();

      await service.move('u1', 'A2', { parentId: null, index: 0 });

      expect(updates()).toEqual({
        A2: { parentId: null, depth: 1, position: 0 },
        A: { position: 1 },
        B: { position: 2 },
        C: { position: 3 },
      });
    });

    it('하위가 딸린 카테고리(A1)를 옮기면 하위(A11)의 depth도 함께 바뀐다', async () => {
      arrange();

      // A1(2단계, 하위 A11 3단계)을 최상위 index 1로 → A1=1단계, A11=2단계
      await service.move('u1', 'A1', { parentId: null, index: 1 });

      expect(updates()).toEqual({
        A1: { parentId: null, depth: 1, position: 1 },
        A11: { depth: 2 }, // 부모는 그대로 A1
        B: { position: 2 },
        C: { position: 3 },
        A2: { position: 0 }, // A 밑에 A2만 남아 빈틈이 메워진다
      });
    });

    it('하위가 딸린 카테고리를 더 깊은 곳으로 옮기면 하위의 depth가 같은 만큼 늘어난다', async () => {
      // B 밑에 하위 하나가 있는 상태에서 B를 A 밑(2단계)으로 → 하위는 3단계
      arrange([...tree(), cat('B1', 'B', 2, 0)]);

      await service.move('u1', 'B', { parentId: 'A', index: 2 });

      expect(updates().B).toEqual({ parentId: 'A', depth: 2, position: 2 });
      expect(updates().B1).toEqual({ depth: 3 });
    });
  });

  describe('move — 저장과 응답', () => {
    it('모든 update는 prisma.$transaction 하나로 묶어서 실행한다', async () => {
      arrange();

      await service.move('u1', 'C', { parentId: null, index: 0 });

      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
      const [operations] = mockPrisma.$transaction.mock.calls[0] as [unknown[]];
      // update 호출 3번(C·A·B)의 결과가 그대로 한 묶음에 들어간다
      expect(mockPrisma.postCategory.update).toHaveBeenCalledTimes(3);
      expect(operations).toHaveLength(3);
    });

    it('update는 where(id)와 바뀐 값만 담아 호출한다', async () => {
      arrange();

      await service.move('u1', 'C', { parentId: null, index: 0 });

      expect(mockPrisma.postCategory.update).toHaveBeenCalledWith({
        where: { id: 'C' },
        data: { position: 0 },
      });
    });

    it('응답은 이동 후 전체 목록이며 position → createdAt 순으로 정렬해 조회한 값이다', async () => {
      arrange();

      const result = await service.move('u1', 'C', {
        parentId: null,
        index: 0,
      });

      expect(mockPrisma.postCategory.findMany).toHaveBeenCalledTimes(2);
      expect(mockPrisma.postCategory.findMany).toHaveBeenNthCalledWith(2, {
        where: { userId: 'u1' },
        orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      });
      expect(result).toBe(AFTER);
    });

    it('제자리여도 응답으로 전체 목록을 돌려준다', async () => {
      arrange();

      const result = await service.move('u1', 'B', {
        parentId: null,
        index: 1,
      });

      expect(result).toBe(AFTER);
    });

    it('같은 position끼리는 만든 순서(createdAt)로 이어서 매긴다 (옛 데이터가 전부 0이어도 순서가 유지된다)', async () => {
      // 최상위 세 개가 모두 position 0 — 만든 순서는 A < B < C. DB가 돌려주는 순서는 일부러 섞는다(B, A, C)
      const a = cat('A', null, 1, 0);
      const b = cat('B', null, 1, 0);
      const c = cat('C', null, 1, 0);
      arrange([b, a, c]);

      // C를 맨 앞으로 → [C, A, B] = 0, 1, 2 (C는 이미 0이라 바뀌지 않는다). 만든 순서를 쓰지 않으면 [C, B, A]가 된다
      await service.move('u1', 'C', { parentId: null, index: 0 });

      expect(updates()).toEqual({
        A: { position: 1 },
        B: { position: 2 },
      });
    });
  });

  describe('findAll / create — position 이 함께 필요한 부분', () => {
    it('findAll은 position → createdAt 순(orderBy)으로 조회한다', async () => {
      mockPrisma.postCategory.findMany.mockResolvedValue([{ id: 'c1' }]);

      await service.findAll('u1');

      expect(mockPrisma.postCategory.findMany).toHaveBeenCalledWith({
        where: { userId: 'u1' },
        orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      });
    });

    it('기본 5개를 만들 때 position을 0~4로 채우고, 만든 뒤에도 같은 순서로 조회한다', async () => {
      mockPrisma.postCategory.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ id: 'c1' }]);

      await service.findAll('u1');

      const { data } = mockPrisma.postCategory.createMany.mock.calls[0][0] as {
        data: { name: string; position: number }[];
      };
      expect(data.map((d) => d.position)).toEqual([0, 1, 2, 3, 4]);
      expect(mockPrisma.postCategory.findMany).toHaveBeenNthCalledWith(2, {
        where: { userId: 'u1' },
        orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      });
    });

    it('create는 새 카테고리를 같은 부모의 마지막 position(형제 수)에 넣는다 — 최상위', async () => {
      mockPrisma.postCategory.findFirst.mockResolvedValue(null);
      mockPrisma.postCategory.count.mockResolvedValue(5);
      mockPrisma.postCategory.create.mockResolvedValue({ id: 'new' });

      await service.create('u1', { name: '새 카테고리' });

      expect(mockPrisma.postCategory.count).toHaveBeenCalledWith({
        where: { userId: 'u1', parentId: null },
      });
      expect(mockPrisma.postCategory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ position: 5 }) as unknown,
      });
    });

    it('create는 하위 카테고리도 그 부모의 형제 수를 position으로 쓴다', async () => {
      mockPrisma.postCategory.findUnique.mockResolvedValue({
        id: 'p1',
        userId: 'u1',
        depth: 1,
      });
      mockPrisma.postCategory.findFirst.mockResolvedValue(null);
      mockPrisma.postCategory.count.mockResolvedValue(2);
      mockPrisma.postCategory.create.mockResolvedValue({ id: 'new' });

      await service.create('u1', { name: '하위', parentId: 'p1' });

      expect(mockPrisma.postCategory.count).toHaveBeenCalledWith({
        where: { userId: 'u1', parentId: 'p1' },
      });
      expect(mockPrisma.postCategory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          parentId: 'p1',
          position: 2,
        }) as unknown,
      });
    });

    it('검증에 실패한 create는 형제 수를 세지 않는다', async () => {
      mockPrisma.postCategory.findFirst.mockResolvedValue({ id: 'dup' });

      await expect(service.create('u1', { name: '학습' })).rejects.toThrow(
        ConflictException,
      );

      expect(mockPrisma.postCategory.count).not.toHaveBeenCalled();
    });
  });
});
