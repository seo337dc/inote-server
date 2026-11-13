import { decodeGroupCursor, encodeGroupCursor } from './memo-cursor';

// 그룹 목록(GET /memos/groups)의 커서 — (그룹 updatedAt, key) 한 쌍을 불투명한 문자열로 주고받는다.
describe('memo-cursor', () => {
  const cursor = {
    updatedAt: new Date('2026-11-12T08:30:15.123Z'),
    key: 'post:p1',
  };

  it('인코딩한 커서를 디코딩하면 같은 값이 나온다', () => {
    expect(decodeGroupCursor(encodeGroupCursor(cursor))).toEqual(cursor);
  });

  it('밀리초까지 보존한다 (같은 시각 구분용)', () => {
    const decoded = decodeGroupCursor(encodeGroupCursor(cursor));
    expect(decoded?.updatedAt.getTime()).toBe(cursor.updatedAt.getTime());
  });

  it('URL에 그대로 쓸 수 있는 문자열이다 (+ / = 없음)', () => {
    const encoded = encodeGroupCursor({
      updatedAt: new Date(),
      key: 'a/b+c==?&',
    });
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('key에 콜론이 들어 있어도 안전하다 (글·독서 key는 "종류:id")', () => {
    const c = {
      updatedAt: new Date('2026-01-01T00:00:00Z'),
      key: 'reading:abc:def',
    };
    expect(decodeGroupCursor(encodeGroupCursor(c))).toEqual(c);
  });

  it('잘못된 커서는 null이다 — 빈 문자열, 아무 문자열, base64가 아님', () => {
    for (const bad of ['', 'abc', '!!!', '%%%']) {
      expect(decodeGroupCursor(bad)).toBeNull();
    }
  });

  it('JSON이 아니거나 모양이 틀리면 null이다', () => {
    const b64 = (v: unknown) =>
      Buffer.from(JSON.stringify(v)).toString('base64url');
    expect(
      decodeGroupCursor(Buffer.from('not json').toString('base64url')),
    ).toBeNull();
    expect(decodeGroupCursor(b64({}))).toBeNull();
    expect(decodeGroupCursor(b64({ u: '2026-01-01T00:00:00Z' }))).toBeNull();
    expect(decodeGroupCursor(b64({ k: 'post:p1' }))).toBeNull();
    expect(decodeGroupCursor(b64({ u: 123, k: 'post:p1' }))).toBeNull();
    expect(
      decodeGroupCursor(b64({ u: 'not a date', k: 'post:p1' })),
    ).toBeNull();
    expect(
      decodeGroupCursor(b64({ u: '2026-01-01T00:00:00Z', k: 5 })),
    ).toBeNull();
    expect(decodeGroupCursor(b64(['x']))).toBeNull();
  });
});
