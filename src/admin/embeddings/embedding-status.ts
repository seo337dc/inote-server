// 상태 판정 — 계약: inote 레포 docs/todo/admin-embeddings.md "1단계 계약(확정)".

export type EmbeddingStatus =
  | 'excluded'
  | 'unknown'
  | 'processing'
  | 'pending'
  | 'failed'
  | 'incomplete'
  | 'outdated'
  | 'done';

export type EmbeddingFilter =
  'all' | 'incomplete' | 'failed' | 'done' | 'excluded';

import type { AiEmbeddingState } from '../../embeddings/inote-ai-embedding-status';

// 글에서 판정에 쓰는 값만
export type PostForStatus = {
  publishedAt: Date | null;
  isPrivate: boolean;
  archivedAt: Date | null;
  lastEditedAt: Date | null;
};

// "재임베딩 필요" 판정의 허용 오차 — 저장 직후 임베딩이 늦게 끝나는 것을 오탐하지 않게
export const OUTDATED_TOLERANCE_MS = 10_000;

/** 임베딩 대상이 아닌 글 — 발행되지 않았거나, 비공개이거나, 보관한 글 */
export function isExcluded(post: PostForStatus): boolean {
  return (
    post.publishedAt === null || post.isPrivate || post.archivedAt !== null
  );
}

/**
 * 우선순위: excluded > unknown > processing > failed > pending > incomplete > outdated > done.
 * ai가 null이면 AI 호출 자체가 실패한 것이다(대상 글은 unknown).
 * job.status가 done이면 job은 무시하고 조각 수·시각으로 판정한다.
 * "outdated"는 해시 비교가 아니라 시각 비교라 추정이다.
 */
export function deriveEmbeddingStatus(
  post: PostForStatus,
  ai: AiEmbeddingState | null,
): EmbeddingStatus {
  if (isExcluded(post)) return 'excluded';
  if (ai === null) return 'unknown';

  const jobStatus = ai.job?.status;
  if (jobStatus === 'processing') return 'processing';
  if (jobStatus === 'failed') return 'failed';
  if (jobStatus === 'pending') return 'pending';

  if (ai.chunkCount === 0) return 'incomplete';

  if (post.lastEditedAt !== null && ai.embeddedAt !== null) {
    const embeddedAt = new Date(ai.embeddedAt).getTime();
    if (embeddedAt < post.lastEditedAt.getTime() - OUTDATED_TOLERANCE_MS) {
      return 'outdated';
    }
  }
  return 'done';
}

// "incomplete" 탭은 아직 끝나지 않은 것 전부를 묶는다
const INCOMPLETE_TAB: ReadonlySet<EmbeddingStatus> = new Set([
  'incomplete',
  'outdated',
  'pending',
  'processing',
]);

export function matchesFilter(
  status: EmbeddingStatus,
  filter: EmbeddingFilter,
): boolean {
  if (filter === 'all') return true;
  if (filter === 'incomplete') return INCOMPLETE_TAB.has(status);
  return status === filter;
}
