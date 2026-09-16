import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateMandalartItemDto } from './dto/update-mandalart-item.dto';

// 만다르트 로드맵 — 조회는 누구나, 수정은 소유자(MANDALART_OWNER_USER_ID)만.
// 별도 role 체계가 없는 개인 로드맵이라, INTERNAL_SECRET처럼 고정 env값과 대조하는 방식으로 간단히 처리.
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

  async update(userId: string, id: string, dto: UpdateMandalartItemDto) {
    this.assertOwner(userId);
    await this.findOne(id);
    return this.prisma.mandalartItem.update({ where: { id }, data: dto });
  }

  private assertOwner(userId: string) {
    if (userId !== process.env.MANDALART_OWNER_USER_ID) {
      throw new ForbiddenException('본인만 수정할 수 있습니다.');
    }
  }
}
