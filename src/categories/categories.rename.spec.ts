import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * 카테고리 이름 수정 — 직접 작성할 테스트 골격 (작업 #6)
 *
 * ── 계약 (FE와 합의됨) ────────────────────────────────────────────────
 *  PATCH /categories/:id   body: { name: string }
 *   - 응답: 수정된 카테고리 (PostCategory 한 건)
 *   - 이름 규칙: 앞뒤 공백을 지운 뒤 1~50자 (DTO에서 검증·정리)
 *   - 400: 내 카테고리 중 다른 것과 이름이 같음 (글이 카테고리를 "이름 문자열"로 가리키므로 이름이 겹치면 안 됨)
 *   - 404: 카테고리가 없거나 내 것이 아님
 *   - 이름이 지금과 같으면(변경 없음): 아무것도 쓰지 않고 그대로 돌려줌
 *   - ⚠️ 글의 카테고리는 이름 문자열이라, 이름을 바꾸면 "내 글 중 옛 이름을 가진 글"의 category도
 *     같은 트랜잭션으로 새 이름으로 바꿔야 한다 (다른 사람 글은 건드리지 않음)
 *
 * ── 구현 계획 (mock을 어떻게 세울지 힌트) ────────────────────────────
 *  service.rename(userId, id, dto)
 *   1) postCategory.findUnique({ where: { id } })   → 없거나 userId가 다르면 NotFoundException
 *   2) dto.name === 현재 이름  → 그대로 반환 (findFirst/트랜잭션 호출 없음)
 *   3) postCategory.findFirst({ where: { userId, name: dto.name, NOT: { id } } })  → 있으면 BadRequestException
 *   4) prisma.$transaction([
 *        postCategory.update({ where: { id }, data: { name: dto.name } }),
 *        post.updateMany({ where: { userId, category: 옛이름 }, data: { category: dto.name } }),
 *      ])
 *   5) 트랜잭션 결과의 첫 번째 값(수정된 카테고리)을 반환
 *   ※ $transaction은 배열 형태로 부르므로 mockResolvedValue([수정된카테고리, { count: n }])로 세운다.
 *
 * ── 골격 예시 ───────────────────────────────────────────────────────
 *  it('...', async () => {
 *    // Arrange: findUnique.mockResolvedValue({ id: 'c1', userId: 'u1', name: '학습' })
 *    //          findFirst.mockResolvedValue(null)
 *    //          $transaction.mockResolvedValue([{ id: 'c1', name: '공부' }, { count: 2 }])
 *    // Act:     const result = await service.rename('u1', 'c1', { name: '공부' });
 *    // Assert:  postCategory.update / post.updateMany 호출 인자, $transaction 호출, result, 예외 타입
 *  });
 * ─────────────────────────────────────────────────────────────────────
 */
describe('CategoriesService — 이름 수정', () => {
  let service: CategoriesService;

  const mockPrisma = {
    postCategory: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      createMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    post: {
      updateMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  // 테스트에서 "내 카테고리"로 쓰는 기본 값 (사용자 u1, 이름 '학습')
  const OWN = {
    id: 'c1',
    userId: 'u1',
    name: '학습',
    parentId: null,
    depth: 1,
    position: 0,
  };

  // 이름 수정이 성공하는 상황을 세팅한다:
  // 내 카테고리가 있고, 같은 이름의 다른 카테고리는 없으며, 트랜잭션이 [수정된 카테고리, { count }]를 돌려준다.
  function arrangeSuccess(updatedPostCount = 2) {
    mockPrisma.postCategory.findUnique.mockResolvedValue(OWN);
    mockPrisma.postCategory.findFirst.mockResolvedValue(null);
    mockPrisma.$transaction.mockResolvedValue([
      { ...OWN, name: '공부' },
      { count: updatedPostCount },
    ]);
  }

  beforeEach(async () => {
    // 이전 테스트에서 설정한 mock 값·호출 기록이 다음 테스트로 새지 않도록 매번 초기화한다
    jest.resetAllMocks();

    const module = await Test.createTestingModule({
      providers: [
        CategoriesService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get(CategoriesService);
  });

  describe('rename — 검증 (예외)', () => {
    it('카테고리가 없으면 NotFoundException', async () => {
      // Arrange: 그 id의 카테고리를 DB에서 찾았더니 없다(null)
      mockPrisma.postCategory.findUnique.mockResolvedValue(null);

      // Act & Assert: rename은 NotFoundException으로 거절되어야 한다
      await expect(
        service.rename('u1', 'c1', { name: '공부' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('다른 사람의 카테고리면 NotFoundException (존재 여부를 숨김)', async () => {
      // Arrange: 카테고리는 있지만 주인이 다른 사용자('other')다
      mockPrisma.postCategory.findUnique.mockResolvedValue({
        ...OWN,
        userId: 'other',
      });

      // Act & Assert: 403이 아니라 404로 답해서 남의 카테고리가 존재한다는 사실도 알려 주지 않는다
      await expect(
        service.rename('u1', 'c1', { name: '공부' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('내 다른 카테고리와 이름이 같으면 BadRequestException', async () => {
      // Arrange: 내 카테고리 c1은 있고, '공부'라는 이름의 다른 카테고리(c2)가 이미 있다
      mockPrisma.postCategory.findUnique.mockResolvedValue(OWN);
      mockPrisma.postCategory.findFirst.mockResolvedValue({
        id: 'c2',
        userId: 'u1',
        name: '공부',
      });

      // Act & Assert: 글이 카테고리를 이름 문자열로 가리키므로 이름이 겹치면 400
      await expect(
        service.rename('u1', 'c1', { name: '공부' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('중복 검사에서 자기 자신은 제외한다 (findFirst의 NOT: { id })', async () => {
      // Arrange: 중복이 없고 저장이 성공하는 상황
      arrangeSuccess();

      // Act
      await service.rename('u1', 'c1', { name: '공부' });

      // Assert: 내 카테고리 중 "같은 이름이면서 자기 자신(c1)이 아닌 것"을 찾았는지
      // (자기 자신을 빼지 않으면 이름을 바꾸지 않을 때도 자기 자신과 중복으로 걸린다)
      expect(mockPrisma.postCategory.findFirst).toHaveBeenCalledWith({
        where: { userId: 'u1', name: '공부', NOT: { id: 'c1' } },
      });
    });

    it('검증에 실패하면 update/updateMany/$transaction이 한 번도 호출되지 않는다', async () => {
      // Arrange: 이름 중복으로 실패하는 상황
      mockPrisma.postCategory.findUnique.mockResolvedValue(OWN);
      mockPrisma.postCategory.findFirst.mockResolvedValue({ id: 'c2' });

      // Act: 실패하는 것 자체는 위 테스트가 확인하므로 여기서는 결과를 무시하고 부른다
      await service.rename('u1', 'c1', { name: '공부' }).catch(() => undefined);

      // Assert: 실패했으면 DB에 아무것도 쓰면 안 된다
      expect(mockPrisma.postCategory.update).not.toHaveBeenCalled();
      expect(mockPrisma.post.updateMany).not.toHaveBeenCalled();
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('rename — 변경 없음', () => {
    it('지금 이름과 같으면 쓰기 없이 기존 카테고리를 그대로 돌려준다', async () => {
      // Arrange: 내 카테고리의 지금 이름은 '학습'
      mockPrisma.postCategory.findUnique.mockResolvedValue(OWN);

      // Act: 같은 이름 '학습'으로 "수정"을 요청한다
      const result = await service.rename('u1', 'c1', { name: '학습' });

      // Assert: 바뀐 게 없으니 기존 카테고리를 그대로 반환하고 DB 쓰기는 하지 않는다
      expect(result).toEqual(OWN);
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
      expect(mockPrisma.postCategory.update).not.toHaveBeenCalled();
      expect(mockPrisma.post.updateMany).not.toHaveBeenCalled();
    });

    it('변경이 없으면 중복 검사(findFirst)도 하지 않는다', async () => {
      // Arrange
      mockPrisma.postCategory.findUnique.mockResolvedValue(OWN);

      // Act
      await service.rename('u1', 'c1', { name: '학습' });

      // Assert: 불필요한 DB 조회를 줄인다
      expect(mockPrisma.postCategory.findFirst).not.toHaveBeenCalled();
    });
  });

  describe('rename — 저장', () => {
    it('카테고리 이름과 내 글의 category를 하나의 $transaction으로 함께 바꾼다', async () => {
      // Arrange
      arrangeSuccess();

      // Act
      await service.rename('u1', 'c1', { name: '공부' });

      // Assert: 트랜잭션은 딱 한 번, 안에는 두 작업(카테고리 update, 글 updateMany)이 배열로 들어간다
      // → 둘 중 하나만 성공하고 다른 하나가 실패하는 일이 없도록 한꺼번에 처리
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
      const operations = mockPrisma.$transaction.mock.calls[0][0] as unknown[];
      expect(Array.isArray(operations)).toBe(true);
      expect(operations).toHaveLength(2);
    });

    it('글 갱신은 내 글만 대상이다 (updateMany의 where에 userId와 옛 이름)', async () => {
      // Arrange
      arrangeSuccess();

      // Act
      await service.rename('u1', 'c1', { name: '공부' });

      // Assert: 옛 이름 '학습'을 가진 "내 글"만 새 이름 '공부'로 바꾼다 (다른 사람 글은 건드리지 않음)
      expect(mockPrisma.post.updateMany).toHaveBeenCalledWith({
        where: { userId: 'u1', category: '학습' },
        data: { category: '공부' },
      });
    });

    it('카테고리는 name만 바꾸고 parentId·depth·position은 건드리지 않는다', async () => {
      // Arrange
      arrangeSuccess();

      // Act
      await service.rename('u1', 'c1', { name: '공부' });

      // Assert: data에 name만 있어야 한다 (트리 구조와 순서는 그대로)
      expect(mockPrisma.postCategory.update).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: { name: '공부' },
      });
    });

    it('수정된 카테고리(트랜잭션 결과의 첫 번째 값)를 돌려준다', async () => {
      // Arrange: 트랜잭션이 [수정된 카테고리, 글 갱신 결과]를 돌려준다
      arrangeSuccess();

      // Act
      const result = await service.rename('u1', 'c1', { name: '공부' });

      // Assert: FE는 수정된 카테고리 한 건을 받는다 (글 갱신 결과 { count }가 아님)
      expect(result).toEqual({ ...OWN, name: '공부' });
    });

    it('글이 하나도 없어도(updateMany count 0) 정상적으로 이름이 바뀐다', async () => {
      // Arrange: 그 카테고리에 속한 글이 0개
      arrangeSuccess(0);

      // Act
      const result = await service.rename('u1', 'c1', { name: '공부' });

      // Assert: 글이 없어도 오류 없이 카테고리 이름만 바뀐 결과를 돌려준다
      expect(result).toEqual({ ...OWN, name: '공부' });
    });
  });
});
