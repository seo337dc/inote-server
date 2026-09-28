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
import { CurrentUser } from '../auth/current-user.decorator';
import { ReadingLogsService } from './reading-logs.service';
import { UpdateReadingLogDto } from './dto/update-reading-log.dto';

@ApiTags('ReadingLogs')
@Controller('reading-logs')
export class ReadingLogsController {
  constructor(private readonly readingLogsService: ReadingLogsService) {}

  @Get()
  @ApiOperation({ summary: '독서 기록 목록 조회 (발행된 것만)' })
  findAll() {
    return this.readingLogsService.findAll();
  }

  @Get('mine/drafts')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: '내 draft 목록 (로그인 필요)' })
  findMyDrafts(@CurrentUser() user: { id: string }) {
    return this.readingLogsService.findMyDrafts(user.id);
  }

  @Get(':id')
  @UseGuards(OptionalAuthGuard)
  @ApiOperation({ summary: '독서 기록 단건 조회 (draft는 작성자만)' })
  findOne(
    @CurrentUser() user: { id: string } | undefined,
    @Param('id') id: string,
  ) {
    return this.readingLogsService.findOne(id, user?.id);
  }

  @Post('draft')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: '빈 독서 기록(draft) 생성 (로그인 필요)' })
  createDraft(@CurrentUser() user: { id: string }) {
    return this.readingLogsService.createDraft(user.id);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @ApiOperation({
    summary: '독서 기록 저장/수정 (본인 것만) — 처음 저장 시 발행됨',
  })
  update(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: UpdateReadingLogDto,
  ) {
    return this.readingLogsService.update(user.id, id, dto);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: '독서 기록 삭제 (본인 것만)' })
  remove(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.readingLogsService.remove(user.id, id);
  }
}
