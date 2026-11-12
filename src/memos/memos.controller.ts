import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
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
  @ApiOperation({
    summary:
      '내 메모 목록 (최근 수정순) — targetType·targetId를 생략하면 전체, targetType만 주면 종류별(general=일반 메모). 글·독서 메모에는 대상 제목(targetTitle)이 붙는다',
  })
  findAll(@CurrentUser() user: { id: string }, @Query() query: FindMemosQuery) {
    return this.memosService.findAll(user.id, query);
  }

  @Post()
  @ApiOperation({
    summary:
      '메모 만들기 — 본인이 작성한 글·독서 기록에만 (임시저장 글 포함, 남의 글·작성자 없는 글은 403), 또는 대상 없는 일반 메모(general). 대상당(일반 메모는 전체) 최대 10장, 넘으면 409. title·content는 생략 가능',
  })
  @ApiConflictResponse({ description: '대상당 메모 10장 상한을 넘음' })
  create(@CurrentUser() user: { id: string }, @Body() dto: CreateMemoDto) {
    return this.memosService.create(user.id, dto);
  }

  @Patch(':id')
  @ApiOperation({
    summary:
      '메모 제목·내용 수정 (본인 것만, 보낸 필드만 고침, 둘 다 없으면 400, 빈 문자열이면 지운 것)',
  })
  update(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: UpdateMemoDto,
  ) {
    return this.memosService.update(user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: '메모 삭제 (본인 것만, 없거나 남의 메모는 404)' })
  remove(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.memosService.remove(user.id, id);
  }
}
