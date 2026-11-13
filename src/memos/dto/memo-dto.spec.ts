// 요청 DTO 검증 테스트 — 2차(메모 여러 장) 계약: inote 레포 docs/todo/memo.md
//
// class-validator의 validate()에 plainToInstance(Dto, {...})를 넣어 오류 개수를 본다
// (admin-embeddings.api.spec.ts와 같은 방식, supertest·DB 불필요).
// 이 DTO들은 테스트보다 먼저 만들어져 있어서 빨간 단계가 없다 — 경계값이 실제로 걸리는지 확인하는 용도다.

import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateMemoDto } from './create-memo.dto';
import { UpdateMemoDto } from './update-memo.dto';
import { FindMemosQuery } from './find-memos.query';
import { FindMemoGroupsQuery } from './find-memo-groups.query';

const BASE = { targetType: 'post', targetId: 'p1' };
const create = (body: Record<string, unknown>) =>
  validate(plainToInstance(CreateMemoDto, { ...BASE, ...body }));
const find = (query: Record<string, unknown>) =>
  validate(plainToInstance(FindMemosQuery, query));
const update = (body: Record<string, unknown>) =>
  validate(plainToInstance(UpdateMemoDto, body));

describe('CreateMemoDto', () => {
  // FE는 +를 누를 때 { targetType, targetId }만 보낸다
  it('targetType·targetId만 있어도 통과한다 (title·content 생략 가능)', async () => {
    expect(await create({})).toHaveLength(0);
  });

  it('title이 30자면 통과하고 31자면 실패한다 (경계)', async () => {
    expect(await create({ title: 'a'.repeat(30) })).toHaveLength(0);
    expect(await create({ title: 'a'.repeat(31) })).not.toHaveLength(0);
  });

  it('title이 빈 문자열이어도 통과한다', async () => {
    expect(await create({ title: '' })).toHaveLength(0);
  });

  it('title이 문자열이 아니면(숫자 등) 실패한다', async () => {
    for (const title of [1, true, ['a'], {}]) {
      expect(await create({ title })).not.toHaveLength(0);
    }
  });

  it('content가 10,000자면 통과하고 10,001자면 실패한다 (기존 규칙 유지)', async () => {
    expect(await create({ content: 'a'.repeat(10000) })).toHaveLength(0);
    expect(await create({ content: 'a'.repeat(10001) })).not.toHaveLength(0);
  });

  it('targetType이 post·reading 밖이면 실패한다 (기존 규칙 유지)', async () => {
    expect(await create({ targetType: 'comment' })).not.toHaveLength(0);
    expect(await create({ targetType: 'reading' })).toHaveLength(0);
  });
});

describe('UpdateMemoDto', () => {
  // "둘 중 하나는 있어야 한다"는 서비스에서 막는다(BadRequestException). DTO는 각 필드가 선택이라는 것만 본다
  it('title만 있어도, content만 있어도 통과한다', async () => {
    expect(await update({ title: '제목' })).toHaveLength(0);
    expect(await update({ content: '본문' })).toHaveLength(0);
  });

  it('아무것도 없는 {}도 DTO 검증은 통과한다 (비어 있는지는 서비스가 판단한다)', async () => {
    expect(await update({})).toHaveLength(0);
  });

  it('title이 31자면 실패한다', async () => {
    expect(await update({ title: 'a'.repeat(30) })).toHaveLength(0);
    expect(await update({ title: 'a'.repeat(31) })).not.toHaveLength(0);
  });

  it('content가 10,001자면 실패한다 (기존 규칙 유지)', async () => {
    expect(await update({ content: 'a'.repeat(10001) })).not.toHaveLength(0);
  });
});

// 3차 — 일반 메모(general)는 대상이 없다. 계약: inote 레포 docs/todo/memo.md '3차'
describe('CreateMemoDto — general (3차)', () => {
  it('general은 targetId 없이 통과한다', async () => {
    expect(
      await validate(plainToInstance(CreateMemoDto, { targetType: 'general' })),
    ).toHaveLength(0);
  });

  it('general에 targetId를 보내도 DTO는 통과한다 (서비스가 무시한다)', async () => {
    expect(
      await validate(
        plainToInstance(CreateMemoDto, {
          targetType: 'general',
          targetId: 'p1',
        }),
      ),
    ).toHaveLength(0);
  });

  it('post·reading은 targetId가 없거나 빈 문자열이면 실패한다', async () => {
    for (const targetType of ['post', 'reading']) {
      expect(
        await validate(plainToInstance(CreateMemoDto, { targetType })),
      ).not.toHaveLength(0);
      expect(
        await validate(
          plainToInstance(CreateMemoDto, { targetType, targetId: '' }),
        ),
      ).not.toHaveLength(0);
    }
  });

  it('general 메모도 title·content 길이 규칙을 따른다', async () => {
    expect(
      await validate(
        plainToInstance(CreateMemoDto, {
          targetType: 'general',
          title: 'a'.repeat(31),
        }),
      ),
    ).not.toHaveLength(0);
  });
});

describe('FindMemosQuery (3차: 대상 없이도 조회)', () => {
  it('아무것도 없는 쿼리는 통과한다 (내 메모 전체)', async () => {
    expect(await find({})).toHaveLength(0);
  });

  it('targetType만 있어도 통과한다 (종류별)', async () => {
    for (const targetType of ['general', 'post', 'reading']) {
      expect(await find({ targetType })).toHaveLength(0);
    }
  });

  it('targetType + targetId는 통과한다 (기존 호출)', async () => {
    expect(await find({ targetType: 'post', targetId: 'p1' })).toHaveLength(0);
  });

  it('targetId만 있고 targetType이 없으면 실패한다 (어느 종류의 id인지 알 수 없다)', async () => {
    expect(await find({ targetId: 'p1' })).not.toHaveLength(0);
  });

  it('targetType이 세 종류 밖이면 실패한다', async () => {
    expect(await find({ targetType: 'comment' })).not.toHaveLength(0);
  });
});

// 4차 — 그룹 목록 조회(GET /memos/groups) 쿼리. 계약: inote 레포 docs/todo/memo.md '4차'
describe('FindMemoGroupsQuery', () => {
  const groups = (query: Record<string, unknown>) =>
    validate(plainToInstance(FindMemoGroupsQuery, query));

  it('아무것도 없는 쿼리는 통과한다 (전체, 첫 페이지, 기본 개수)', async () => {
    expect(await groups({})).toHaveLength(0);
  });

  it('targetType은 general·post·reading만 통과한다', async () => {
    for (const targetType of ['general', 'post', 'reading']) {
      expect(await groups({ targetType })).toHaveLength(0);
    }
    expect(await groups({ targetType: 'comment' })).not.toHaveLength(0);
  });

  it('limit은 쿼리 문자열의 숫자를 정수로 바꾸고 1~50만 통과한다 (경계)', async () => {
    expect(await groups({ limit: '1' })).toHaveLength(0);
    expect(await groups({ limit: '50' })).toHaveLength(0);
    expect(await groups({ limit: '0' })).not.toHaveLength(0);
    expect(await groups({ limit: '51' })).not.toHaveLength(0);
    expect(await groups({ limit: '-3' })).not.toHaveLength(0);
  });

  it('limit이 정수가 아니면 실패한다', async () => {
    for (const limit of ['abc', '1.5', '']) {
      expect(await groups({ limit })).not.toHaveLength(0);
    }
  });

  it('limit은 숫자로 변환된다 (문자열로 남지 않는다)', () => {
    const q = plainToInstance(FindMemoGroupsQuery, { limit: '20' });
    expect(q.limit).toBe(20);
  });

  it('cursor는 비어 있지 않은 문자열이어야 한다 (모양 검증은 서비스에서 400)', async () => {
    expect(await groups({ cursor: 'abc' })).toHaveLength(0);
    expect(await groups({ cursor: '' })).not.toHaveLength(0);
  });
});
