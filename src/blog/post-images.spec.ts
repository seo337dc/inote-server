import { applyPromotions, planPromotions } from './post-images';

// 글 본문(HTML)의 <img src>에서 "내 tmp 폴더" 이미지를 찾아 영구 위치로 옮길 계획을 세우는 순수 함수 테스트.
// DB·R2 없이 문자열만 다루므로 mock이 필요 없다.
//
// 계약 (docs/EDITOR_IMAGE_UPLOAD.md 5절 — inote 레포)
//   tmp   <PUBLIC>/tmp/post/<userId>/<uuid>.<ext>
//   영구  <PUBLIC>/post/<userId>/<postId>/<uuid>.<ext>   (uuid·확장자는 그대로)
//
// 사용할 함수 (구현은 테스트가 채워진 뒤에 한다)
//   planPromotions(content, { publicUrl, userId, postId }): Promotion[]
//     Promotion = { fromUrl, fromKey, toUrl, toKey } — 같은 이미지는 한 번만, 본문에 나온 순서대로
//   applyPromotions(content, promotions): string
//     본문의 <img src="fromUrl">을 toUrl로 바꾼 새 본문
const CTX = {
  publicUrl: 'https://cdn.example.com',
  userId: 'u1',
  postId: 'p1',
};
const UUID_A = '11111111-1111-4111-8111-111111111111';
const UUID_B = '22222222-2222-4222-8222-222222222222';
const tmpUrl = (uuid: string, ext = 'png', userId = 'u1') =>
  `${CTX.publicUrl}/tmp/post/${userId}/${uuid}.${ext}`;

describe('planPromotions', () => {
  it('내 tmp 이미지 1장 → fromKey/toKey/fromUrl/toUrl을 계약대로 만든다', () => {
    const content = `<p>글</p><img src="${tmpUrl(UUID_A)}" style="width: 60%">`;

    expect(planPromotions(content, CTX)).toEqual([
      {
        fromUrl: tmpUrl(UUID_A),
        fromKey: `tmp/post/u1/${UUID_A}.png`,
        toUrl: `${CTX.publicUrl}/post/u1/p1/${UUID_A}.png`,
        toKey: `post/u1/p1/${UUID_A}.png`,
      },
    ]);
  });

  it('이미지가 여러 장이면 본문에 나온 순서대로 돌려준다', () => {
    const content = `<img src="${tmpUrl(UUID_B)}"><p>x</p><img src="${tmpUrl(UUID_A)}">`;

    const plan = planPromotions(content, CTX);

    expect(plan.map((p) => p.fromKey)).toEqual([
      `tmp/post/u1/${UUID_B}.png`,
      `tmp/post/u1/${UUID_A}.png`,
    ]);
  });

  it('같은 이미지가 본문에 여러 번 나와도 한 번만 담는다', () => {
    const content = `<img src="${tmpUrl(UUID_A)}"><img src="${tmpUrl(UUID_A)}" style="width: 30%">`;

    expect(planPromotions(content, CTX)).toHaveLength(1);
  });

  it('확장자(jpg·jpeg·png·webp·gif)와 uuid는 그대로 이어받는다', () => {
    for (const ext of ['jpg', 'jpeg', 'png', 'webp', 'gif']) {
      const [promotion] = planPromotions(
        `<img src="${tmpUrl(UUID_A, ext)}">`,
        CTX,
      );
      expect(promotion.toKey).toBe(`post/u1/p1/${UUID_A}.${ext}`);
    }
  });

  it('남의 tmp 폴더(userId 다름) 주소는 담지 않는다 — 남의 파일을 자기 글로 가져오기 방지', () => {
    const content = `<img src="${tmpUrl(UUID_A, 'png', 'u2')}">`;

    expect(planPromotions(content, CTX)).toEqual([]);
  });

  it('이미 post/... 영구 주소, 외부 URL(https://other.com/a.png)은 담지 않는다', () => {
    const content =
      `<img src="${CTX.publicUrl}/post/u1/p1/${UUID_A}.png">` +
      '<img src="https://other.com/a.png">';

    expect(planPromotions(content, CTX)).toEqual([]);
  });

  it('uuid 형식이 아니거나 ../ 가 섞인 파일명은 담지 않는다 (키 조작 방지)', () => {
    const base = `${CTX.publicUrl}/tmp/post/u1`;
    const content =
      `<img src="${base}/evil.png">` +
      `<img src="${base}/../../uploads/u1/${UUID_A}.png">` +
      `<img src="${base}/${UUID_A}.svg">`;

    expect(planPromotions(content, CTX)).toEqual([]);
  });

  it('tmp 주소가 <img>가 아닌 곳(링크 href, 본문 글자)에 있으면 담지 않는다', () => {
    const url = tmpUrl(UUID_A);
    const content = `<a href="${url}">링크</a><p>${url}</p>`;

    expect(planPromotions(content, CTX)).toEqual([]);
  });

  it('publicUrl이 비어 있으면(환경변수 없음) 빈 배열이다', () => {
    const content = `<img src="${tmpUrl(UUID_A)}">`;

    expect(planPromotions(content, { ...CTX, publicUrl: '' })).toEqual([]);
  });

  it('이미지가 없는 본문은 빈 배열이다', () => {
    expect(planPromotions('<p>글만 있다</p>', CTX)).toEqual([]);
  });
});

describe('applyPromotions', () => {
  const promotionOf = (uuid: string) => ({
    fromUrl: tmpUrl(uuid),
    fromKey: `tmp/post/u1/${uuid}.png`,
    toUrl: `${CTX.publicUrl}/post/u1/p1/${uuid}.png`,
    toKey: `post/u1/p1/${uuid}.png`,
  });

  it('모든 <img src>의 fromUrl을 toUrl로 바꾼다 (같은 이미지가 두 번이면 둘 다)', () => {
    const content = `<img src="${tmpUrl(UUID_A)}"><p>x</p><img src="${tmpUrl(UUID_A)}">`;

    const result = applyPromotions(content, [promotionOf(UUID_A)]);

    expect(result).toBe(
      `<img src="${promotionOf(UUID_A).toUrl}"><p>x</p><img src="${promotionOf(UUID_A).toUrl}">`,
    );
  });

  it('style="width: 60%" 같은 다른 속성과 본문 나머지는 그대로 둔다', () => {
    const content = `<p>앞</p><img src="${tmpUrl(UUID_A)}" style="width: 60%"><p>뒤</p>`;

    const result = applyPromotions(content, [promotionOf(UUID_A)]);

    expect(result).toBe(
      `<p>앞</p><img src="${promotionOf(UUID_A).toUrl}" style="width: 60%"><p>뒤</p>`,
    );
  });

  it('promotions가 비어 있으면 본문을 그대로 돌려준다', () => {
    const content = `<img src="${tmpUrl(UUID_A)}">`;

    expect(applyPromotions(content, [])).toBe(content);
  });

  it('계획에 없는 <img>(외부 URL 등)는 건드리지 않는다', () => {
    const content = `<img src="https://other.com/a.png"><img src="${tmpUrl(UUID_A)}">`;

    const result = applyPromotions(content, [promotionOf(UUID_A)]);

    expect(result).toBe(
      `<img src="https://other.com/a.png"><img src="${promotionOf(UUID_A).toUrl}">`,
    );
  });

  it('계획에 없는 tmp 이미지(복사에 실패한 것)는 tmp 주소 그대로 둔다', () => {
    const content = `<img src="${tmpUrl(UUID_A)}"><img src="${tmpUrl(UUID_B)}">`;

    const result = applyPromotions(content, [promotionOf(UUID_A)]);

    expect(result).toContain(`src="${tmpUrl(UUID_B)}"`);
  });
});
