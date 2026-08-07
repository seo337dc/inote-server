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
import { CreateBookDto } from './dto/create-book.dto';
import { UpdateBookDto } from './dto/update-book.dto';
import { BooksService } from './books.service';

@ApiTags('Money - Books')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('money/books')
export class BooksController {
  constructor(private readonly booksService: BooksService) {}

  @Get()
  @ApiOperation({ summary: '추천 도서 목록 조회 (공유된 것 + 내가 등록한 것)' })
  @ApiQuery({ name: 'category', enum: FinanceCategory, required: false })
  @ApiQuery({ name: 'q', required: false, description: '제목 검색' })
  findAll(
    @CurrentUser() user: { id: string },
    @Query('category') category?: FinanceCategory,
    @Query('q') q?: string,
  ) {
    return this.booksService.findAll(user.id, { category, q });
  }

  @Get(':id')
  @ApiOperation({ summary: '도서 단건 조회' })
  findOne(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.booksService.findOne(user.id, id);
  }

  @Post()
  @ApiOperation({ summary: '도서 등록' })
  create(@CurrentUser() user: { id: string }, @Body() dto: CreateBookDto) {
    return this.booksService.create(user.id, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: '도서 수정 (본인 등록만)' })
  update(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: UpdateBookDto,
  ) {
    return this.booksService.update(user.id, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: '도서 삭제 (본인 등록만)' })
  remove(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.booksService.remove(user.id, id);
  }

  @Post(':id/like')
  @ApiOperation({ summary: '좋아요 토글' })
  toggleLike(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.booksService.toggleLike(user.id, id);
  }
}
