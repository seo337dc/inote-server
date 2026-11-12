import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../../auth/auth.guard';
import { AdminGuard } from '../../auth/admin.guard';
import { AdminEmbeddingsService } from './admin-embeddings.service';
import { ListAdminEmbeddingsQueryDto } from './dto/list-admin-embeddings-query.dto';

@ApiTags('Admin')
@ApiBearerAuth()
@UseGuards(AuthGuard, AdminGuard)
@Controller('admin/embeddings')
export class AdminEmbeddingsController {
  constructor(private readonly service: AdminEmbeddingsService) {}

  @Get()
  @ApiOperation({
    summary:
      '글 임베딩 상태 목록 (관리자 전용, 모든 사용자의 글 — 제목만 노출, 상태 탭·페이지네이션)',
  })
  list(@Query() query: ListAdminEmbeddingsQueryDto) {
    return this.service.list(query);
  }
}
