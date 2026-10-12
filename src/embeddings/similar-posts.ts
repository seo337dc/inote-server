import { Logger } from '@nestjs/common';
import {
  describeError,
  internalHeaders,
  isEmbeddingsEnabled,
} from './inote-ai-embeddings';

// 유사 글 조회 — inote-ai의 POST /embeddings/similar를 부르는 읽기용 함수. 설계: inote 레포 docs/kure/PLAN.md (B2).
// 후보 id는 호출하는 쪽이 embedding-candidates.ts로 정한다. 이 함수는 "후보 안에서 가까운 글 id와 점수"만 돌려준다.
//
// 규칙
// - **절대 던지지 않는다**: 어떤 실패(AI 서버 장애, 시간 초과, 이상한 응답)도 빈 배열이다. 호출하는 쪽은 "비슷한 글 없음"으로 그린다.
// - **AI 응답을 믿지 않는다**: 후보 밖 id·자기 자신·기준 미달·점수가 이상한 항목·중복은 여기서 다시 걸러낸다(이중 방어).
//   AI가 후보 밖의 글(비공개 글)을 돌려주는 버그가 생겨도 이 함수를 지나면 나가지 못한다.
// - **EMBEDDINGS_ENABLED가 꺼져 있으면 부르지 않는다**(저장 훅과 같은 스위치).
// - 읽기 경로라 시간 제한이 짧다(3초). 저장 훅의 45초와 다르다 — 사용자가 화면에서 기다리는 요청이다.
// - 로그에는 글 id와 오류 메시지만 남긴다(후보 id 목록·본문은 남기지 않는다).

const defaultLogger = new Logger('SimilarPosts');

export const SIMILAR_TIMEOUT_MS = 3_000;
// A7의 유사 쌍 라벨로 확정하기 전의 임시 기준 — PLAN 결정 8·16
export const DEFAULT_SIMILAR_MIN_SCORE = 0.6;

export type SimilarPost = { postId: string; score: number };

/** SIMILAR_MIN_SCORE(0~1)를 읽는다. 없거나 범위를 벗어나면 기본값 */
export function getSimilarMinScore(
  logger: Pick<Logger, 'warn'> = defaultLogger,
): number {
  const raw = process.env.SIMILAR_MIN_SCORE;
  if (raw === undefined || raw.trim() === '') return DEFAULT_SIMILAR_MIN_SCORE;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    logger.warn(
      `SIMILAR_MIN_SCORE must be a number between 0 and 1; using ${DEFAULT_SIMILAR_MIN_SCORE}`,
    );
    return DEFAULT_SIMILAR_MIN_SCORE;
  }
  return value;
}

export async function findSimilarPosts(
  params: {
    postId: string;
    candidateIds: string[];
    limit: number;
    minScore?: number;
  },
  logger: Pick<Logger, 'warn'> = defaultLogger,
): Promise<SimilarPost[]> {
  const { postId, limit } = params;
  const candidates = [...new Set(params.candidateIds)];
  // 꺼져 있거나 볼 수 있는 글이 없으면 부를 이유가 없다
  if (!isEmbeddingsEnabled() || candidates.length === 0) return [];

  const url = process.env.INOTE_AI_URL;
  if (!url) {
    logger.warn(`skip similar posts for ${postId}: INOTE_AI_URL is not set`);
    return [];
  }
  const minScore = params.minScore ?? getSimilarMinScore(logger);

  let body: unknown;
  try {
    const res = await fetch(`${url.replace(/\/+$/, '')}/embeddings/similar`, {
      method: 'POST',
      headers: internalHeaders(),
      body: JSON.stringify({
        postId,
        candidateIds: candidates,
        limit,
        minScore,
      }),
      signal: AbortSignal.timeout(SIMILAR_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`inote-ai responded ${res.status}`);
    body = await res.json();
  } catch (e) {
    logger.warn(
      `failed to find similar posts for ${postId}: ${describeError(e)}`,
    );
    return [];
  }

  return sanitize(body, postId, new Set(candidates), minScore, limit);
}

// AI 응답에서 쓸 수 있는 항목만 남긴다 — 점수 높은 순, 같은 글은 한 번만, 최대 limit개
function sanitize(
  body: unknown,
  postId: string,
  candidates: Set<string>,
  minScore: number,
  limit: number,
): SimilarPost[] {
  const items = (body as { items?: unknown } | null)?.items;
  if (!Array.isArray(items)) return [];

  const seen = new Set<string>();
  const result: SimilarPost[] = [];
  for (const item of items as unknown[]) {
    const { postId: id, score } = (item ?? {}) as {
      postId?: unknown;
      score?: unknown;
    };
    if (typeof id !== 'string' || typeof score !== 'number') continue;
    if (!Number.isFinite(score) || score < minScore) continue;
    if (id === postId || !candidates.has(id) || seen.has(id)) continue;
    seen.add(id);
    result.push({ postId: id, score });
  }
  return result.sort((a, b) => b.score - a.score).slice(0, limit);
}
