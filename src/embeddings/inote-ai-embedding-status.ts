import { Logger } from '@nestjs/common';
import {
  describeError,
  inoteAiBaseUrl,
  internalHeaders,
} from './inote-ai-embeddings';

// inote-ai의 POST /embeddings/status 응답 항목 — 글 하나의 임베딩 상태 (embeddedAt은 ISO 문자열)
export type AiEmbeddingState = {
  chunkCount: number;
  embeddedAt: string | null;
  job: {
    status: 'pending' | 'processing' | 'done' | 'failed';
    attempts: number;
    lastError: string | null;
  } | null;
};

// 관리자 임베딩 목록용 — inote-ai의 읽기 전용 상태 조회(POST /embeddings/status, GET /embeddings/health).
// 계약: inote 레포 docs/todo/admin-embeddings.md "1단계 계약(확정)".
//
// inote-ai-embeddings.ts의 글 저장·삭제 함수들과 달리 **실패를 호출자에게 알린다**(관리자 화면이 aiAvailable을 정해야 해서).
// 그래도 던지지는 않는다: 실패하면 fetchEmbeddingStatuses는 null, fetchEmbedderHealth는 false를 돌려준다.
// EMBEDDINGS_ENABLED와 무관하게 동작한다(관리자 전용 화면이라 글 저장 훅의 스위치를 따르지 않는다).
// 로그에는 글 id 개수·오류 메시지만 남기고 응답 본문(lastError 등)은 남기지 않는다.

const defaultLogger = new Logger('InoteAiEmbeddingStatus');

// 느린 AI 서버가 관리자 목록 화면을 오래 붙들지 않게
export const STATUS_TIMEOUT_MS = 5_000;

function baseUrl(logger: Logger, action: string): string | null {
  const url = inoteAiBaseUrl();
  if (!url) logger.warn(`skip ${action}: INOTE_AI_URL is not set`);
  return url;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * 글들의 임베딩 상태(조각 수·임베딩 시각·작업 상태)를 한 번에 가져온다.
 * 글 id → 상태. 실패(주소 없음·연결 실패·시간 초과·비정상 응답)면 null — 던지지 않는다.
 * id가 없으면 호출하지 않고 빈 결과를 돌려준다.
 */
export async function fetchEmbeddingStatuses(
  postIds: string[],
  logger: Logger = defaultLogger,
): Promise<Record<string, AiEmbeddingState> | null> {
  if (postIds.length === 0) return {};
  const url = baseUrl(logger, 'embedding status');
  if (!url) return null;
  try {
    const res = await fetch(`${url}/embeddings/status`, {
      method: 'POST',
      headers: internalHeaders(),
      body: JSON.stringify({ postIds }),
      signal: AbortSignal.timeout(STATUS_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`inote-ai responded ${res.status}`);
    const body: unknown = await res.json();
    if (!isObject(body) || !isObject(body.items)) {
      throw new Error('unexpected response shape');
    }
    return body.items as Record<string, AiEmbeddingState>;
  } catch (e) {
    logger.warn(
      `failed to fetch embedding status for ${postIds.length} posts: ${describeError(e)}`,
    );
    return null;
  }
}

/**
 * 임베딩 서비스(KURE)에 닿는지 inote-ai에 물어본다. inote-ai 자체가 응답하지 않으면 false — 던지지 않는다.
 */
export async function fetchEmbedderHealth(
  logger: Logger = defaultLogger,
): Promise<boolean> {
  const url = baseUrl(logger, 'embedder health');
  if (!url) return false;
  try {
    const res = await fetch(`${url}/embeddings/health`, {
      headers: internalHeaders(),
      signal: AbortSignal.timeout(STATUS_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`inote-ai responded ${res.status}`);
    const body: unknown = await res.json();
    return (
      isObject(body) &&
      isObject(body.embedder) &&
      body.embedder.reachable === true
    );
  } catch (e) {
    logger.warn(`failed to fetch embedder health: ${describeError(e)}`);
    return false;
  }
}
