import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateReadingLogDto } from './dto/update-reading-log.dto';

const DETAIL_INCLUDE = { aiSummary: true };

@Injectable()
export class ReadingLogsService {
  private readonly logger = new Logger(ReadingLogsService.name);

  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.readingLog.findMany({
      where: { publishedAt: { not: null } },
      orderBy: { createdAt: 'desc' },
      include: DETAIL_INCLUDE,
    });
  }

  findMyDrafts(userId: string) {
    return this.prisma.readingLog.findMany({
      where: { userId, publishedAt: null },
      orderBy: { updatedAt: 'desc' },
    });
  }

  // 조회 없이 존재만 확인 — update/remove가 소유권 체크 전에 씀 (blog.service.ts와 동일 패턴).
  private async findRaw(id: string) {
    const log = await this.prisma.readingLog.findUnique({
      where: { id },
      include: DETAIL_INCLUDE,
    });
    if (!log) throw new NotFoundException('독서 기록을 찾을 수 없습니다.');
    return log;
  }

  // 공개 조회 — 발행된 기록은 누구나, draft는 작성자 본인만.
  async findOne(id: string, requesterUserId?: string) {
    const log = await this.findRaw(id);
    if (!log.publishedAt && log.userId !== requesterUserId) {
      throw new NotFoundException('독서 기록을 찾을 수 없습니다.');
    }
    return log;
  }

  createDraft(userId: string) {
    return this.prisma.readingLog.create({
      data: { title: '', userId },
    });
  }

  async update(userId: string, id: string, dto: UpdateReadingLogDto) {
    const log = await this.findRaw(id);
    if (log.userId !== userId) {
      throw new ForbiddenException('본인이 작성한 기록만 수정할 수 있습니다.');
    }
    const { publish, startedAt, finishedAt, ...fields } = dto;

    // DTO의 @IsOptional()은 title이 아예 안 왔을 때 뒤의 @ValidateIf+@MinLength까지
    // 스킵시켜버려서(class-validator 특성), "이번 요청에 title이 왔는지"만으론 검증이 안 됨.
    // PATCH는 부분 수정이라 title이 이전 저장분에 이미 있을 수도 있으므로, DTO가 아니라
    // "발행 시 최종 반영될 title"(이번 요청 값 or 기존 값) 기준으로 여기서 검증한다.
    if (publish && !(dto.title ?? log.title).trim()) {
      throw new BadRequestException('발행하려면 책 제목이 필요합니다.');
    }

    const updated = await this.prisma.readingLog.update({
      where: { id },
      data: {
        ...fields,
        ...(startedAt !== undefined ? { startedAt: new Date(startedAt) } : {}),
        ...(finishedAt !== undefined
          ? { finishedAt: new Date(finishedAt) }
          : {}),
        ...(publish ? { publishedAt: log.publishedAt ?? new Date() } : {}),
      },
      include: DETAIL_INCLUDE,
    });

    if (publish) {
      await this.generateBookInfo(updated.id, updated.title, updated.author);
    }

    return updated;
  }

  // 발행 직후 inote-ai에 책 정보(장르/줄거리/작가소개) 생성을 요청해 ReadingLogSummary에 반영.
  // AI 서버 장애가 독서 기록 저장 자체를 막으면 안 되므로 실패해도 예외를 던지지 않는다
  // (blog.service.ts의 summarize()와 동일한 fail-open 패턴).
  private async generateBookInfo(
    readingLogId: string,
    title: string,
    author: string | null,
  ) {
    try {
      const res = await fetch(`${process.env.INOTE_AI_URL}/book-info`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-secret': process.env.INTERNAL_SECRET ?? '',
        },
        body: JSON.stringify({ title, author }),
      });
      if (!res.ok) throw new Error(`inote-ai responded ${res.status}`);

      const info = (await res.json()) as {
        genre: string | null;
        synopsis: string | null;
        authorBio: string | null;
      };
      await this.prisma.readingLogSummary.upsert({
        where: { readingLogId },
        create: { readingLogId, ...info },
        update: info,
      });
    } catch (e) {
      this.logger.warn(
        `failed to generate book info for reading log ${readingLogId}: ${e}`,
      );
    }
  }

  async remove(userId: string, id: string) {
    const log = await this.findRaw(id);
    if (log.userId !== userId) {
      throw new ForbiddenException('본인이 작성한 기록만 삭제할 수 있습니다.');
    }
    return this.prisma.readingLog.delete({ where: { id } });
  }
}
