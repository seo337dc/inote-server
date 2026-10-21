// 글 본문(HTML)의 tmp 이미지를 영구 위치로 옮길 계획을 세우고 본문 주소를 바꾸는 순수 함수.
//
//   tmp   <PUBLIC>/tmp/post/<userId>/<uuid>.<ext>
//   영구  <PUBLIC>/post/<userId>/<postId>/<uuid>.<ext>   (uuid·확장자는 그대로)
//
// <img> 파싱은 정규식으로 한다 — 에디터(Tiptap)가 내보내는 HTML이 결정적이고, 승격 대상은 아래
// 파일명 규칙(uuid + 허용 확장자)에 정확히 맞는 주소뿐이라 `../` 같은 키 조작이나 남의 폴더 주소는
// 애초에 매칭되지 않는다.

export type PostImageContext = {
  publicUrl: string;
  userId: string;
  postId: string;
};

export type Promotion = {
  fromUrl: string;
  fromKey: string;
  toUrl: string;
  toKey: string;
};

// <img ... src="값" ...> 의 src 값만 잡는다 (링크 href나 본문 글자는 걸리지 않는다)
const IMG_SRC = /(<img\b[^>]*?\ssrc=")([^"]*)(")/gi;

const FILE_NAME =
  '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.(?:jpg|jpeg|png|webp|gif)';

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function planPromotions(
  content: string,
  ctx: PostImageContext,
): Promotion[] {
  if (!ctx.publicUrl) return [];

  const prefix = `${ctx.publicUrl}/tmp/post/${ctx.userId}/`;
  const ownTmp = new RegExp(`^${escapeRegExp(prefix)}(${FILE_NAME})$`);

  const promotions: Promotion[] = [];
  const seen = new Set<string>();
  for (const match of content.matchAll(IMG_SRC)) {
    const fromUrl = match[2];
    if (seen.has(fromUrl)) continue;
    const file = ownTmp.exec(fromUrl)?.[1];
    if (!file) continue;
    seen.add(fromUrl);
    const toKey = `post/${ctx.userId}/${ctx.postId}/${file}`;
    promotions.push({
      fromUrl,
      fromKey: `tmp/post/${ctx.userId}/${file}`,
      toUrl: `${ctx.publicUrl}/${toKey}`,
      toKey,
    });
  }
  return promotions;
}

export function applyPromotions(
  content: string,
  promotions: Promotion[],
): string {
  if (promotions.length === 0) return content;
  const toByFrom = new Map(promotions.map((p) => [p.fromUrl, p.toUrl]));
  return content.replace(
    IMG_SRC,
    (whole, head: string, src: string, tail: string) => {
      const to = toByFrom.get(src);
      return to ? `${head}${to}${tail}` : whole;
    },
  );
}
