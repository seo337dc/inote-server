// 그룹 목록(GET /memos/groups)의 커서 — 마지막으로 준 그룹의 (updatedAt, key) 한 쌍을 불투명한 문자열로 만든다.
// 서버만 만들고 읽는다(클라이언트는 받은 nextCursor를 그대로 되돌려 준다). base64url이라 쿼리 문자열에 그대로 쓸 수 있다.
export type GroupCursor = { updatedAt: Date; key: string };

export function encodeGroupCursor({ updatedAt, key }: GroupCursor): string {
  return Buffer.from(
    JSON.stringify({ u: updatedAt.toISOString(), k: key }),
  ).toString('base64url');
}

/** 잘못된 커서(모양·날짜가 틀림)는 null — 호출하는 쪽이 400으로 바꾼다. */
export function decodeGroupCursor(value: string): GroupCursor | null {
  try {
    const parsed: unknown = JSON.parse(
      Buffer.from(value, 'base64url').toString('utf8'),
    );
    if (typeof parsed !== 'object' || parsed === null) return null;
    const { u, k } = parsed as { u?: unknown; k?: unknown };
    if (typeof u !== 'string' || typeof k !== 'string') return null;
    const updatedAt = new Date(u);
    if (Number.isNaN(updatedAt.getTime())) return null;
    return { updatedAt, key: k };
  } catch {
    return null;
  }
}
