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

const BASE = { targetType: 'post', targetId: 'p1' };
const create = (body: Record<string, unknown>) =>
  validate(plainToInstance(CreateMemoDto, { ...BASE, ...body }));
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
