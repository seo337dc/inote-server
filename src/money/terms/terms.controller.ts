import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { FinanceCategory } from '@prisma/client';
import { AuthGuard } from '../../auth/auth.guard';
import { CurrentUser } from '../../auth/current-user.decorator';
import { CreateTermDto } from './dto/create-term.dto';
import { UpdateTermDto } from './dto/update-term.dto';
import { TermsService } from './terms.service';

@ApiTags('Money - Terms')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('money/terms')
export class TermsController {
  constructor(private readonly termsService: TermsService) {}

  @Get()
  @ApiOperation({ summary: '용어 목록 조회 (공유된 것 + 내가 등록한 것)' })
  @ApiQuery({ name: 'category', enum: FinanceCategory, required: false })
  @ApiQuery({ name: 'q', required: false, description: '용어명 검색' })
  findAll(
    @CurrentUser() user: { id: string },
    @Query('category') category?: FinanceCategory,
    @Query('q') q?: string,
  ) {
    return this.termsService.findAll(user.id, { category, q });
  }

  @Get(':id')
  @ApiOperation({ summary: '용어 단건 조회' })
  findOne(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.termsService.findOne(user.id, id);
  }

  @Post()
  @ApiOperation({ summary: '용어 등록' })
  create(@CurrentUser() user: { id: string }, @Body() dto: CreateTermDto) {
    return this.termsService.create(user.id, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: '용어 수정 (본인 등록만)' })
  update(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: UpdateTermDto,
  ) {
    return this.termsService.update(user.id, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: '용어 삭제 (본인 등록만)' })
  remove(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.termsService.remove(user.id, id);
  }

  @Post(':id/like')
  @ApiOperation({ summary: '좋아요 토글' })
  toggleLike(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.termsService.toggleLike(user.id, id);
  }
}
