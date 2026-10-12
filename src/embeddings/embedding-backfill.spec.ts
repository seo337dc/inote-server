// 기존 글 임베딩 백필(embedding-backfill.ts) 테스트 목록 — 구현은 직접 채운다.
//
// 접근 방법
//   - 파싱·안전장치는 순수 함수라 입출력만 보면 된다.
//   - runBackfill은 DB·네트워크를 받지 않는다: loadPage/send/log를 가짜로 넘긴다
//     (loadPage는 배열을 afterId 기준으로 잘라 주는 짧은 함수, send는 jest.fn()).
//   - 실제 개발 DB·로컬 AI 서버로는 한 번 끝까지 확인해 두었다 (2026-10-12, A6-5).
//
// 지켜야 할 약속(계약)
//   1) 짝이 어긋난 대상(운영 DB→로컬 AI, 로컬 DB→운영 AI)은 --allow-remote여도 항상 거절한다
//   2) 한 번에 하나씩 보낸다 (동시 실행 없음)
//   3) 실패는 기록하고 넘어가되, 연속 5번 실패하면 멈춘다
//   4) 로그·출력에는 글 id만 남긴다 (제목·본문·비밀번호 없음)

describe('parseBackfillArgs', () => {
  it.todo('옵션이 없으면 { dryRun: false, allowRemote: false }');
  it.todo(
    '--dry-run, --allow-remote, --limit N / --limit=N, --only ID / --only=ID를 해석한다',
  );
  it.todo('pnpm이 넘기는 단독 `--`는 무시한다');
  it.todo(
    '알 수 없는 옵션, 값이 없는 --limit/--only, 0·음수·소수·문자 --limit은 오류',
  );
});

describe('assertSafeTarget / describeTarget', () => {
  it.todo('둘 다 로컬(127.0.0.1, localhost, ::1)이면 --allow-remote 없이 통과');
  it.todo('둘 다 원격이면 --allow-remote가 있어야 통과');
  it.todo(
    '짝이 어긋나면(운영 DB + 로컬 AI, 로컬 DB + 원격 AI) --allow-remote여도 거절',
  );
  it.todo('DATABASE_URL·INOTE_AI_URL이 없거나 올바른 주소가 아니면 거절');
  it.todo(
    'localhost.evil.com, 127.0.0.1.evil.com 같은 이름은 로컬로 치지 않는다',
  );
  it.todo('오류 메시지와 describeTarget 결과에 비밀번호가 없다');
});

describe('runBackfill', () => {
  it.todo('글을 id 순서대로 하나씩 보낸다 (동시에 둘 이상 진행되지 않는다)');
  it.todo('embedded / unchanged 결과를 따로 센다');
  it.todo('제목·본문이 모두 빈 글은 보내지 않고 empty로 센다');
  it.todo('실패한 글은 { id, error }로 기록하고 다음 글로 넘어간다');
  it.todo(
    '연속 5번 실패하면 멈추고 aborted: true, 중간에 성공하면 연속 실패 횟수가 초기화된다',
  );
  it.todo('--limit은 시도한 글 수 기준이다 (빈 글은 세지 않는다)');
  it.todo('dry-run은 send를 부르지 않고 wouldSend만 센다');
  it.todo('shouldStop이 true가 되면 지금 글까지만 하고 interrupted: true');
  it.todo(
    '페이지 경계(0, 1, 49, 50, 51, 103개)에서도 모든 글을 빠짐없이 한 번씩 처리한다',
  );
  it.todo('로그에 제목·본문이 없다');
});

describe('putPostEmbedding / isEmptyPost', () => {
  it.todo(
    'EMBEDDINGS_ENABLED가 꺼져 있어도 PUT을 보낸다 (주소·헤더·본문·signal)',
  );
  it.todo('응답 status가 unchanged면 "unchanged", 그 외에는 "embedded"');
  it.todo(
    '비정상 응답·네트워크 오류·INOTE_AI_URL 없음이면 던진다 (연결 실패는 원인 코드가 메시지에 붙는다)',
  );
  it.todo(
    'isEmptyPost: ("", ""), ("  ", "<p></p>")는 true, 제목만·본문만 있으면 false',
  );
});
