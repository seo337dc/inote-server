// inote-ai 상태 조회 호출(inote-ai-embedding-status.ts — fetchEmbeddingStatuses, fetchEmbedderHealth, 구현 예정) 테스트 목록.
//
// 접근 방법
//   - global.fetch를 jest.spyOn(global, 'fetch')로 가짜 Response로 바꾼다(inote-ai-embeddings.spec.ts가 하는 방식을 참고).
//   - 기존 함수들(글 저장·삭제)은 실패를 삼키는 fail-open이지만, 이 함수들은 **성공/실패를 호출자에게 알려야 한다**
//     (관리자 화면이 aiAvailable을 정하기 위해). 반환 모양은 구현할 때 정한다: 예) 실패 시 null 반환 또는 { ok: false }.
//
// 가장 조심할 함정
//   - 타임아웃 5초(AbortSignal.timeout) — 느린 서버가 목록 화면을 오래 붙들지 않게.
//   - INOTE_AI_URL 끝의 /는 제거해서 //embeddings가 되지 않게(기존 baseUrl 처리와 같다). INOTE_AI_URL·INTERNAL_SECRET이 없으면 실패로 취급한다.
//   - 로그에는 글 id 개수·오류 메시지만 남기고 응답 본문(lastError 등)은 남기지 않는다.

import {
  fetchEmbedderHealth,
  fetchEmbeddingStatuses,
} from './inote-ai-embedding-status';

const ITEMS = {
  p1: { chunkCount: 3, embeddedAt: '2026-11-04T08:00:00+00:00', job: null },
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });
const logger = () => ({ warn: jest.fn() }) as never;

describe('inote-ai 임베딩 상태 호출', () => {
  const saved = { ...process.env };
  let fetchMock: jest.SpyInstance;

  beforeEach(() => {
    process.env.INOTE_AI_URL = 'http://ai.test';
    process.env.INTERNAL_SECRET = 's3cret';
    fetchMock = jest.spyOn(global, 'fetch');
  });
  afterEach(() => {
    process.env = { ...saved };
    jest.restoreAllMocks();
  });

  describe('fetchEmbeddingStatuses', () => {
    it('POST {INOTE_AI_URL}/embeddings/status로 { postIds }를 보내고 x-internal-secret 헤더를 붙인다', async () => {
      fetchMock.mockResolvedValue(json({ items: ITEMS }));

      await fetchEmbeddingStatuses(['p1', 'p2']);

      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('http://ai.test/embeddings/status');
      expect(init.method).toBe('POST');
      expect(JSON.parse(init.body as string)).toEqual({
        postIds: ['p1', 'p2'],
      });
      expect(
        (init.headers as Record<string, string>)['x-internal-secret'],
      ).toBe('s3cret');
      expect(init.signal).toBeInstanceOf(AbortSignal); // 5초 시간 제한
    });
    it('INOTE_AI_URL 끝의 /를 제거한다', async () => {
      process.env.INOTE_AI_URL = 'http://ai.test///';
      fetchMock.mockResolvedValue(json({ items: ITEMS }));

      await fetchEmbeddingStatuses(['p1']);

      expect(fetchMock.mock.calls[0][0]).toBe(
        'http://ai.test/embeddings/status',
      );
    });
    it('200 응답의 items를 그대로 돌려준다', async () => {
      fetchMock.mockResolvedValue(json({ model: 'm', items: ITEMS }));

      await expect(fetchEmbeddingStatuses(['p1'])).resolves.toEqual(ITEMS);
    });
    it('200이 아니면 실패로 알린다 (throw하지 않는다)', async () => {
      for (const status of [401, 422, 503]) {
        fetchMock.mockResolvedValue(json({}, status));
        const log = { warn: jest.fn() };
        await expect(
          fetchEmbeddingStatuses(['p1'], log as never),
        ).resolves.toBeNull();
        expect(log.warn).toHaveBeenCalledWith(
          expect.stringContaining(String(status)),
        );
      }
    });
    it('연결 실패·타임아웃·JSON이 아닌 응답도 실패로 알린다', async () => {
      fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'));
      await expect(
        fetchEmbeddingStatuses(['p1'], logger()),
      ).resolves.toBeNull();

      fetchMock.mockRejectedValueOnce(
        new DOMException('timeout', 'TimeoutError'),
      );
      await expect(
        fetchEmbeddingStatuses(['p1'], logger()),
      ).resolves.toBeNull();

      fetchMock.mockResolvedValueOnce(
        new Response('not json', { status: 200 }),
      );
      await expect(
        fetchEmbeddingStatuses(['p1'], logger()),
      ).resolves.toBeNull();

      fetchMock.mockResolvedValueOnce(json({ unexpected: true })); // items가 없는 이상한 응답
      await expect(
        fetchEmbeddingStatuses(['p1'], logger()),
      ).resolves.toBeNull();
    });
    it('INOTE_AI_URL이 없으면 호출하지 않고 실패로 알린다', async () => {
      delete process.env.INOTE_AI_URL;

      await expect(
        fetchEmbeddingStatuses(['p1'], logger()),
      ).resolves.toBeNull();
      expect(fetchMock).not.toHaveBeenCalled();
    });
    it('postIds가 비어 있으면 호출하지 않고 빈 결과를 돌려준다', async () => {
      await expect(fetchEmbeddingStatuses([])).resolves.toEqual({});
      expect(fetchMock).not.toHaveBeenCalled();
    });
    it('EMBEDDINGS_ENABLED가 꺼져 있어도 호출한다 (관리자 화면은 스위치와 무관하다)', async () => {
      delete process.env.EMBEDDINGS_ENABLED;
      fetchMock.mockResolvedValue(json({ items: ITEMS }));

      await expect(fetchEmbeddingStatuses(['p1'])).resolves.toEqual(ITEMS);
    });
  });

  describe('fetchEmbedderHealth', () => {
    it('GET {INOTE_AI_URL}/embeddings/health를 부르고 embedder.reachable을 돌려준다', async () => {
      fetchMock.mockResolvedValueOnce(
        json({ embedder: { reachable: true, model: 'm' } }),
      );
      await expect(fetchEmbedderHealth()).resolves.toBe(true);

      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('http://ai.test/embeddings/health');
      expect(init.method ?? 'GET').toBe('GET');
      expect(
        (init.headers as Record<string, string>)['x-internal-secret'],
      ).toBe('s3cret');

      fetchMock.mockResolvedValueOnce(
        json({ embedder: { reachable: false, model: null } }),
      );
      await expect(fetchEmbedderHealth()).resolves.toBe(false);
    });
    it('AI 자체가 응답하지 않으면 reachable: false로 알린다 (throw하지 않는다)', async () => {
      fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'));
      await expect(fetchEmbedderHealth(logger())).resolves.toBe(false);

      fetchMock.mockResolvedValueOnce(json({}, 503));
      await expect(fetchEmbedderHealth(logger())).resolves.toBe(false);

      fetchMock.mockResolvedValueOnce(json({ unexpected: true }));
      await expect(fetchEmbedderHealth(logger())).resolves.toBe(false);

      delete process.env.INOTE_AI_URL;
      await expect(fetchEmbedderHealth(logger())).resolves.toBe(false);
    });
  });
});
