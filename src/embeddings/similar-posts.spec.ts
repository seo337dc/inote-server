// 유사 글 조회(similar-posts.ts) 테스트 목록 — 구현은 직접 채운다.
//
// 준비 (inote-ai-embeddings.spec.ts와 같은 방식)
//   - jest.spyOn(global, 'fetch')로 inote-ai 호출을 가로챈다 (실제 네트워크 호출 금지)
//   - beforeEach: process.env에 EMBEDDINGS_ENABLED='true', INOTE_AI_URL, INTERNAL_SECRET 설정, SIMILAR_MIN_SCORE 삭제
//   - afterEach: process.env 원복 + jest.restoreAllMocks()
//   - 로거는 { warn: jest.fn() }를 마지막 인자로 넘긴다
//   - 응답은 { ok, status, json: () => Promise.resolve(본문) } 모양의 가짜로 만든다
//
// 지켜야 할 약속(계약)
//   1) 절대 던지지 않는다: 어떤 실패도 빈 배열이다
//   2) AI 응답을 믿지 않는다: 후보 밖 id(비공개 글)·자기 자신·기준 미달·이상한 항목·중복은 여기서 다시 걸러낸다
//   3) EMBEDDINGS_ENABLED가 정확히 'true'일 때만 부른다
//   4) 시간 제한은 3초(읽기 경로), 로그에는 글 id와 오류 메시지만 남긴다 (후보 id 목록·비밀키 없음)
//
// 개발 DB·로컬 AI 서버로는 한 번 끝까지 확인해 두었다 (2026-10-12, B2): 느린 서버 3.0초에 포기, 서버 꺼짐·401도 빈 목록.

describe('findSimilarPosts', () => {
  describe('호출 조건', () => {
    it.todo(
      '꺼져 있으면(미설정·false·"1"·"TRUE"·빈 문자열) fetch를 부르지 않고 빈 배열',
    );
    it.todo('후보가 비어 있으면 fetch를 부르지 않고 빈 배열');
    it.todo('INOTE_AI_URL이 없으면 fetch를 부르지 않고 경고만 남긴다');
  });

  describe('요청 모양', () => {
    it.todo(
      'POST {INOTE_AI_URL}/embeddings/similar, 끝 슬래시 무시, x-internal-secret 헤더, AbortSignal',
    );
    it.todo('본문은 { postId, candidateIds(중복 제거), limit, minScore }');
    it.todo(
      'minScore: 인자 > SIMILAR_MIN_SCORE > 기본값 0.6, 인자 0도 그대로 쓴다(0을 기본값으로 덮지 않는다)',
    );
  });

  describe('SIMILAR_MIN_SCORE (getSimilarMinScore)', () => {
    it.todo('0~1 숫자면 그 값, 공백은 무시');
    it.todo(
      '없거나 범위 밖(-0.1, 1.5)·숫자가 아님(abc, NaN, Infinity)이면 기본값 0.6 + 경고',
    );
  });

  describe('응답 걸러내기 (이중 방어)', () => {
    it.todo('AI가 후보 밖 id(비공개 글)를 돌려줘도 결과에 없다');
    it.todo('후보에 자기 자신이 들어 있어도(호출한 쪽 실수) 결과에서 뺀다');
    it.todo('기준 미달은 버리고, 기준과 같은 점수(0.6)는 포함한다');
    it.todo(
      '점수가 숫자가 아니거나(문자열·null·NaN) postId가 문자열이 아닌 항목, null·빈 객체 항목은 버린다',
    );
    it.todo('같은 글이 여러 번 오면 첫 항목만 쓴다');
    it.todo('AI 순서와 상관없이 점수 높은 순으로 돌려준다');
    it.todo('limit보다 많이 오면 limit개까지만');
  });

  describe('실패해도 던지지 않는다 (fail-open)', () => {
    it.todo(
      '401·404·422·500·503 응답이면 빈 배열이고 경고에 글 id와 상태 코드가 남는다',
    );
    it.todo('네트워크 오류·TimeoutError·JSON 파싱 오류여도 빈 배열');
    it.todo('본문 모양이 이상하면(null·배열·items 없음·items가 객체) 빈 배열');
    it.todo('경고 로그에 후보 id 목록·비밀키가 들어가지 않는다');
  });
});
