// 후보 글 id 함수(embedding-candidates.ts) 테스트 목록 — 비공개 글 유출을 막는 핵심이라 직접 작성한다.
//
// 접근 방법
//   - where 생성 함수(publicCandidatesWhere / readableCandidatesWhere / ownCandidatesWhere)는 순수 함수라
//     DB 없이 "만들어진 where 모양"을 검사할 수 있다. 다만 모양 검사만으로는 AND/OR 중첩이 헷갈리므로,
//     글 목록(공개·비공개·임시저장·남의 글·작성자 없는 글)을 메모리에서 같은 규칙으로 걸러 본 정답과
//     비교하는 작은 평가 함수를 만들어 쓰는 방법도 있다.
//   - findCandidateIds는 { post: { findMany: jest.fn() } } 가짜로 받아서 호출 인자와 반환값을 본다.
//   - 실제 DB 대조는 개발 DB(scripts/dev-db.sh, 시드 포함)로 한 번 확인해 두었다 (2026-10-12, A6-3).
//
// 가장 조심할 함정
//   - Prisma에서 `userId: undefined`는 "조건 없음"이다. 비로그인·빈 문자열을 where에 그대로 넣지 않는다.
//   - 비로그인을 `userId: null`로 바꿔 넣으면 "작성자 없는(탈퇴 등) 비공개 글"이 후보가 된다 — 반드시 막는다.

describe('후보 글 id — where 규칙', () => {
  describe('publicCandidatesWhere (공개)', () => {
    it.todo('발행되고 공개인 글만 맞는다 (임시저장·비공개 제외)');
    it.todo('excludePostId를 주면 그 글을 뺀다');
  });

  describe('readableCandidatesWhere (B: 읽는 사람 화면)', () => {
    it.todo(
      '로그인: 발행됨 AND (공개 OR 내 글) — 내 비공개 글은 포함, 남의 비공개 글은 제외',
    );
    it.todo('임시저장(publishedAt null)은 내 글이어도 제외');
    it.todo('자기 자신(excludePostId)은 제외');
    it.todo('비로그인(null·undefined·빈 문자열): 공개 글만, 공개 규칙과 같다');
    it.todo(
      '비로그인일 때 where에 userId: null/undefined가 들어가지 않는다 (작성자 없는 비공개 글 유출 방지)',
    );
  });

  describe('ownCandidatesWhere (C: 쓰는 사람 화면)', () => {
    it.todo('내 발행 글만(비공개 포함), 남의 글·임시저장 제외');
    it.todo('수정 중인 글(excludePostId)은 제외');
    it.todo(
      'userId가 없으면(null·undefined·빈 문자열) 아무것도 맞지 않는다 — 공개 글로 대신하지 않는다',
    );
  });
});

describe('후보 글 id — findCandidateIds', () => {
  it.todo(
    'id만 select하고 최근 저장순(lastEditedAt desc nulls last, createdAt desc)으로 읽는다',
  );
  it.todo('MAX_CANDIDATE_IDS 이하면 그대로 돌려주고 경고하지 않는다');
  it.todo(
    'MAX_CANDIDATE_IDS를 넘으면 앞 MAX개만(최근 글) 돌려주고 경고를 남긴다',
  );
  it.todo('상한 판정을 위해 MAX+1개를 읽는다 (take: MAX_CANDIDATE_IDS + 1)');
  it.todo('상수가 inote-ai의 MAX_CANDIDATES(5000)와 같다');
});
