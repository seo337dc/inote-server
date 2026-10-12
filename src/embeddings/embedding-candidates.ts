import { Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';

// 유사 글 조회의 "후보 글 id"를 정하는 곳 — 설계: inote 레포 docs/kure/PLAN.md 5.6.
//
// inote-ai는 글의 공개 여부를 모른다. 여기서 "이 요청자가 이 기능에서 볼 수 있는 글"을 정해 id로 넘기면,
// inote-ai는 그 안에서만 순위를 매긴다. 그래서 이 파일이 비공개 글 유출을 막는 유일한 관문이다.
// B(관련 글)·C(카테고리 제안·유사 글 알림)·D(RAG)가 모두 여기 함수를 쓴다 — 흩어지면 하나가 빠진다.
//
// 가장 조심할 점: Prisma에서 `userId: undefined`는 "조건 없음"이라 모든 글이 맞는다.
// 비로그인·빈 id를 그대로 where에 넣으면 비공개 글까지 후보가 되므로, 반드시 아래처럼 따로 처리한다.

// inote-ai가 한 번에 받는 후보 id의 상한(app/routers/embeddings.py의 MAX_CANDIDATES와 같아야 한다)
export const MAX_CANDIDATE_IDS = 5000;

const PUBLISHED: Prisma.PostWhereInput = { publishedAt: { not: null } };

// 아무 글도 맞지 않는 조건 — 요청자를 알 수 없을 때 "전체"로 새지 않게 하는 안전장치
const MATCH_NOTHING: Prisma.PostWhereInput = { id: { in: [] } };

function excluding(postId?: string | null): Prisma.PostWhereInput {
  return postId ? { NOT: { id: postId } } : {};
}

function hasId(id?: string | null): id is string {
  return typeof id === 'string' && id.length > 0;
}

/** 발행된 공개 글 — 비로그인 요청자가 볼 수 있는 전부. D(RAG)의 요청자 검증 전에는 로그인해도 이것만 쓴다. */
export function publicCandidatesWhere(
  excludePostId?: string | null,
): Prisma.PostWhereInput {
  return { AND: [PUBLISHED, { isPrivate: false }, excluding(excludePostId)] };
}

/**
 * B(읽는 사람 화면): 발행됨 AND (공개 OR 요청자 본인 글), 자기 자신 제외 — 글 상세 조회 규칙과 같다.
 * viewerId가 없으면(비로그인) 공개 글만.
 */
export function readableCandidatesWhere(
  viewerId: string | null | undefined,
  excludePostId?: string | null,
): Prisma.PostWhereInput {
  if (!hasId(viewerId)) return publicCandidatesWhere(excludePostId);
  return {
    AND: [
      PUBLISHED,
      { OR: [{ isPrivate: false }, { userId: viewerId }] },
      excluding(excludePostId),
    ],
  };
}

/**
 * C(쓰는 사람 화면): 요청자 본인의 발행 글만(비공개 포함), 수정 중인 글 제외. 남의 글은 쓰지 않는다.
 * userId가 없으면 아무것도 맞지 않는다(공개 글로 대신하지 않는다).
 */
export function ownCandidatesWhere(
  userId: string | null | undefined,
  excludePostId?: string | null,
): Prisma.PostWhereInput {
  if (!hasId(userId)) return MATCH_NOTHING;
  return { AND: [PUBLISHED, { userId }, excluding(excludePostId)] };
}

// findMany만 쓰는 최소 모양 — PrismaService와 테스트용 가짜 둘 다 받는다
type PostFinder = {
  post: {
    findMany(args: {
      where: Prisma.PostWhereInput;
      select: { id: true };
      orderBy: Prisma.PostOrderByWithRelationInput[];
      take: number;
    }): Promise<{ id: string }[]>;
  };
};

const defaultLogger = new Logger('EmbeddingCandidates');

/**
 * where에 맞는 글 id를 최근 저장순으로 돌려준다. 최대 MAX_CANDIDATE_IDS개 —
 * 넘으면 가장 오래된 글을 빼고(유출이 아니라 누락이므로 안전) 경고를 남긴다.
 * 이 상한에 닿으면 "AI가 상위 N개를 돌려주고 BE가 거르는" 방식으로 바꿀 때다(PLAN 5.6).
 */
export async function findCandidateIds(
  prisma: PostFinder,
  where: Prisma.PostWhereInput,
  logger: Pick<Logger, 'warn'> = defaultLogger,
): Promise<string[]> {
  const rows = await prisma.post.findMany({
    where,
    select: { id: true },
    orderBy: [
      { lastEditedAt: { sort: 'desc', nulls: 'last' } },
      { createdAt: 'desc' },
    ],
    take: MAX_CANDIDATE_IDS + 1, // 하나 더 읽어서 상한을 넘었는지 안다
  });
  if (rows.length > MAX_CANDIDATE_IDS) {
    logger.warn(
      `candidate posts exceed ${MAX_CANDIDATE_IDS}; keeping the most recent ones`,
    );
    return rows.slice(0, MAX_CANDIDATE_IDS).map((r) => r.id);
  }
  return rows.map((r) => r.id);
}
