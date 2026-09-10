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
import { CurrentUser } from '../auth/current-user.decorator';
import { BlogService } from './blog.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';

// 2단계: 조회는 로그인 없이 공개, 작성/수정/삭제는 로그인 필수 (2026-09-10)
@ApiTags('Blog')
@Controller('blog/posts')
export class BlogController {
  constructor(private readonly blogService: BlogService) {}

  @Get()
  @ApiOperation({ summary: '글 목록 조회' })
  findAll() {
    return this.blogService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: '글 단건 조회' })
  findOne(@Param('id') id: string) {
    return this.blogService.findOne(id);
  }

  @Post()
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: '글 작성 (로그인 필요)' })
  create(@CurrentUser() user: { id: string }, @Body() dto: CreatePostDto) {
    return this.blogService.create(user.id, dto);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: '글 수정 (본인 글만)' })
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
