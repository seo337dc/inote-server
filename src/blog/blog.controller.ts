import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { OptionalAuthGuard } from '../auth/optional-auth.guard';
import { InternalSecretGuard } from '../auth/internal-secret.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { BlogService } from './blog.service';
import { UpdatePostDto } from './dto/update-post.dto';

// 2단계: 조회는 로그인 없이 공개, 작성/수정/삭제는 로그인 필수 (2026-09-10)
// 3단계: 글쓰기는 draft(빈 글) 먼저 생성 후 저장 시 발행 — draft는 작성자만 조회 가능 (2026-09-11)
@ApiTags('Blog')
@Controller('blog/posts')
export class BlogController {
  constructor(private readonly blogService: BlogService) {}

  @Get()
  @ApiOperation({ summary: '글 목록 조회 (발행된 글만)' })
  findAll() {
    return this.blogService.findAll();
  }

  @Get('mine/drafts')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @ApiOperation({
    summary: '내 draft 목록 (로그인 필요) — 글쓰기 진입 시 이어쓰기 안내용',
  })
  findMyDrafts(@CurrentUser() user: { id: string }) {
    return this.blogService.findMyDrafts(user.id);
  }

  @Get(':id')
  @UseGuards(OptionalAuthGuard)
  @ApiOperation({ summary: '글 단건 조회 (draft는 작성자만)' })
  findOne(
    @CurrentUser() user: { id: string } | undefined,
    @Param('id') id: string,
  ) {
    return this.blogService.findOne(id, user?.id);
  }

  @Get(':id/owner')
  @UseGuards(InternalSecretGuard)
  @ApiOperation({
    summary: '[내부 전용] 글 작성자 ID 조회 — inote-ai 대화 기록 접근 제어용',
  })
  async getOwner(@Param('id') id: string) {
    return { userId: await this.blogService.getOwnerId(id) };
  }

  @Post('draft')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @ApiOperation({
    summary: '빈 글(draft) 생성 (로그인 필요) — 글쓰기 화면 진입 시 호출',
  })
  createDraft(@CurrentUser() user: { id: string }) {
    return this.blogService.createDraft(user.id);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: '글 저장/수정 (본인 글만) — 처음 저장 시 발행됨' })
  update(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: UpdatePostDto,
  ) {
    return this.blogService.update(user.id, id, dto);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: '글 삭제 (본인 글만)' })
  remove(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.blogService.remove(user.id, id);
  }
}
