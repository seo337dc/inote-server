import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdatePostDto } from './dto/update-post.dto';

const AUTHOR_SELECT = { user: { select: { name: true, email: true } } };
const DETAIL_INCLUDE = {
  ...AUTHOR_SELECT,
  aiSummary: { select: { summary: true } },
};

const EMPTY_CONTENT = ['', '<p></p>'];

@Injectable()
export class BlogService {
  private readonly logger = new Logger(BlogService.name);

  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.post.findMany({
      where: { publishedAt: { not: null } },
      orderBy: { createdAt: 'desc' },
      include: AUTHOR_SELECT,
    });
  }

  // 글 조회 없이 존재만 확인 — update/remove가 소유권 체크 전에 씀.
  // (draft 노출 제한과 무관하게, 작성자 본인은 항상 자기 글을 가져올 수 있어야 함)
  private async findRaw(id: string) {
    const post = await this.prisma.post.findUnique({
      where: { id },
      include: DETAIL_INCLUDE,
    });
    if (!post) throw new NotFoundException('글을 찾을 수 없습니다.');
    return post;
  }

  // 공개 조회 — 발행된 글은 누구나, draft는 작성자 본인만 (그 외엔 404로 존재 자체를 숨김)
  async findOne(id: string, requesterUserId?: string) {
    const post = await this.findRaw(id);
    if (!post.publishedAt && post.userId !== requesterUserId) {
      throw new NotFoundException('글을 찾을 수 없습니다.');
    }
    return post;
  }

  // inote-ai가 대화 기록 접근 제어에 쓰는 내부 전용 조회 — 존재 안 하면 null.
  async getOwnerId(id: string): Promise<string | null> {
    const post = await this.prisma.post.findUnique({ where: { id } });
    return post?.userId ?? null;
  }

  findMyDrafts(userId: string) {
    return this.prisma.post.findMany({
      where: { userId, publishedAt: null },
      orderBy: { updatedAt: 'desc' },
    });
  }

  createDraft(userId: string) {
    return this.prisma.post.create({
      data: { title: '', content: '', category: '', userId },
    });
  }

  // publish가 true일 때만 진짜 저장(발행 + AI 요약 갱신). 그 외엔 임시저장 — 내용만 갱신하고
  // 발행 상태·요약은 건드리지 않는다 (자동저장이 Groq를 계속 호출하지 않도록).
  async update(userId: string, id: string, dto: UpdatePostDto) {
    const post = await this.findRaw(id);
    if (post.userId !== userId) {
      throw new ForbiddenException('본인이 작성한 글만 수정할 수 있습니다.');
    }
    const { publish, ...fields } = dto;
    const updated = await this.prisma.post.update({
      where: { id },
      data: {
        ...fields,
        ...(publish ? { publishedAt: post.publishedAt ?? new Date() } : {}),
      },
      include: DETAIL_INCLUDE,
    });

    if (publish) {
      await this.summarize(updated.id, updated.title, updated.content);
    }

    return updated;
  }

  async remove(userId: string, id: string) {
    const post = await this.findRaw(id);
    if (post.userId !== userId) {
      throw new ForbiddenException('본인이 작성한 글만 삭제할 수 있습니다.');
    }
    return this.prisma.post.delete({ where: { id } });
  }

  // 저장 직후 inote-ai에 요약을 요청해 PostSummary에 반영.
  // AI 서버 장애가 글 저장 자체를 막으면 안 되므로 실패해도 예외를 던지지 않는다.
  private async summarize(postId: string, title: string, content: string) {
    if (EMPTY_CONTENT.includes(content)) return;

    try {
      const res = await fetch(`${process.env.INOTE_AI_URL}/summarize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-secret': process.env.INTERNAL_SECRET ?? '',
        },
        body: JSON.stringify({ title, content }),
      });
      if (!res.ok) throw new Error(`inote-ai responded ${res.status}`);

      const { summary } = (await res.json()) as { summary: string[] };
      await this.prisma.postSummary.upsert({
        where: { postId },
        create: { postId, summary },
        update: { summary },
      });
    } catch (e) {
      this.logger.warn(`failed to summarize post ${postId}: ${e}`);
    }
  }
}
