import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { CreateMemoDto } from './dto/create-memo.dto';
import { FindMemosQuery } from './dto/find-memos.query';
import { UpdateMemoDto } from './dto/update-memo.dto';
import { MemosService } from './memos.service';

// 메모는 작성자만 본다 — 공개 글 응답에 섞이지 않도록 글·독서 기록 API와 분리된 컨트롤러
@ApiTags('Memos')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('memos')
export class MemosController {
  constructor(private readonly memosService: MemosService) {}

  @Get()
  @ApiOperation({ summary: '대상(글·독서 기록)에 붙은 내 메모 목록 (생성순)' })
  findAll(@CurrentUser() user: { id: string }, @Query() query: FindMemosQuery) {
    return this.memosService.findAll(user.id, query);
  }

  @Post()
  @ApiOperation({
    summary:
      '메모 만들기 — 본인이 작성한 글·독서 기록에만 (임시저장 글 포함, 남의 글·작성자 없는 글은 403)',
  })
  create(@CurrentUser() user: { id: string }, @Body() dto: CreateMemoDto) {
    return this.memosService.create(user.id, dto);
  }

  @Patch(':id')
  @ApiOperation({
    summary: '메모 내용 수정 (본인 것만, 빈 문자열이면 내용을 지운 것)',
  })
  update(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: UpdateMemoDto,
  ) {
    return this.memosService.update(user.id, id, dto);
  }
}
