import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMandalartItemDto } from './dto/create-mandalart-item.dto';
import { UpdateMandalartItemDto } from './dto/update-mandalart-item.dto';

// 만다르트 로드맵 — 조회는 누구나(비회원 포함), 수정·추가는 관리자(role: ADMIN)만.
@Injectable()
export class MandalartService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.mandalartItem.findMany({
      orderBy: [{ theme: 'asc' }, { position: 'asc' }],
    });
  }

  async findOne(id: string) {
    const item = await this.prisma.mandalartItem.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('항목을 찾을 수 없습니다.');
    return item;
  }

  async create(role: string | undefined, dto: CreateMandalartItemDto) {
    this.assertAdmin(role);

    const position = dto.position ?? (await this.nextPosition(dto.theme));

    return this.prisma.mandalartItem.create({
      data: {
        theme: dto.theme,
        themeName: dto.themeName,
        title: dto.title,
        position,
      },
    });
  }

  async update(
    role: string | undefined,
    id: string,
    dto: UpdateMandalartItemDto,
  ) {
    this.assertAdmin(role);
    await this.findOne(id);
    return this.prisma.mandalartItem.update({ where: { id }, data: dto });
  }

  private async nextPosition(theme: string) {
    const count = await this.prisma.mandalartItem.count({ where: { theme } });
    return count;
  }

  private assertAdmin(role: string | undefined) {
    if (role !== 'ADMIN') {
      throw new ForbiddenException('관리자만 수정·추가할 수 있습니다.');
    }
  }
}
