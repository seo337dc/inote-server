import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  fetchEmbedderHealth,
  fetchEmbeddingStatuses,
  type AiEmbeddingState,
} from '../../embeddings/inote-ai-embedding-status';
import { ListAdminEmbeddingsQueryDto } from './dto/list-admin-embeddings-query.dto';
import {
  deriveEmbeddingStatus,
  isExcluded,
  matchesFilter,
  type EmbeddingStatus,
} from './embedding-status';

// 계약: inote 레포 docs/todo/admin-embeddings.md "1단계 계약(확정)".
// 목록에는 제목만 노출한다 — 본문·작성자는 읽지도 않는다(select에 없다).
const POST_SELECT = {
  id: true,
  title: true,
  category: true,
  isPrivate: true,
  publishedAt: true,
  archivedAt: true,
  lastEditedAt: true,
  createdAt: true,
};

const COUNT_KEYS = [
  'done',
  'incomplete',
  'outdated',
  'pending',
  'processing',
  'failed',
] as const;
type CountKey = (typeof COUNT_KEYS)[number];

const NO_EMBEDDING: AiEmbeddingState = {
  chunkCount: 0,
  embeddedAt: null,
  job: null,
};

@Injectable()
export class AdminEmbeddingsService {
  constructor(private readonly prisma: PrismaService) {}

  async list({
    page = 1,
    pageSize = 20,
    status = 'all',
  }: ListAdminEmbeddingsQueryDto) {
    // 글이 수천 편 이하라는 전제로 전체를 한 번 읽고 메모리에서 판정·필터·페이지·집계한다
    const posts = await this.prisma.post.findMany({ select: POST_SELECT });

    const eligibleIds = posts.filter((p) => !isExcluded(p)).map((p) => p.id);
    const [states, reachable] = await Promise.all([
      // 실패하면 null. 대상이 없으면 물어볼 것이 없으니 호출하지 않는다
      eligibleIds.length > 0
        ? fetchEmbeddingStatuses(eligibleIds)
        : Promise.resolve<Record<string, AiEmbeddingState>>({}),
      fetchEmbedderHealth(),
    ]);
    const aiAvailable = states !== null;

    const rows = posts
      .map((post) => {
        // AI가 응답했는데 이 글이 목록에 없으면 임베딩도 작업도 없는 글이다
        const ai = states ? (states[post.id] ?? NO_EMBEDDING) : null;
        const postStatus = deriveEmbeddingStatus(post, ai);
        const known = postStatus !== 'excluded' && ai ? ai : NO_EMBEDDING;
        return {
          sortKey: (post.lastEditedAt ?? post.createdAt).getTime(),
          status: postStatus,
          item: {
            postId: post.id,
            title: post.title,
            category: post.category,
            isPrivate: post.isPrivate,
            isArchived: post.archivedAt !== null,
            isPublished: post.publishedAt !== null,
            lastEditedAt: post.lastEditedAt?.toISOString() ?? null,
            status: postStatus,
            chunkCount: known.chunkCount,
            embeddedAt: known.embeddedAt,
            job: known.job,
          },
        };
      })
      .sort((a, b) => b.sortKey - a.sortKey);

    const filtered = rows.filter((r) => matchesFilter(r.status, status));

    return {
      items: filtered
        .slice((page - 1) * pageSize, page * pageSize)
        .map((r) => r.item),
      total: filtered.length,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(filtered.length / pageSize)),
      summary: this.summarize(
        rows.map((r) => r.status),
        aiAvailable,
      ),
      embedder: { reachable },
      aiAvailable,
    };
  }

  // 페이지·탭과 무관하게 전체 글 기준. 상태를 모르면(AI 응답 없음) counts는 null
  private summarize(statuses: EmbeddingStatus[], aiAvailable: boolean) {
    const excluded = statuses.filter((s) => s === 'excluded').length;
    const counts = Object.fromEntries(
      COUNT_KEYS.map((key) => [key, 0]),
    ) as Record<CountKey, number>;
    for (const s of statuses) {
      if ((COUNT_KEYS as readonly string[]).includes(s))
        counts[s as CountKey]++;
    }
    return {
      eligible: statuses.length - excluded,
      excluded,
      counts: aiAvailable ? counts : null,
    };
  }
}
