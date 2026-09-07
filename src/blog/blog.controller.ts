import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { BlogService } from './blog.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';

// 1단계: 로그인 없이 오픈된 CRUD. 로그인 붙을 때 AuthGuard + userId 추가 예정.
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
  @ApiOperation({ summary: '글 작성' })
  create(@Body() dto: CreatePostDto) {
    return this.blogService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: '글 수정' })
  update(@Param('id') id: string, @Body() dto: UpdatePostDto) {
    return this.blogService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: '글 삭제' })
  remove(@Param('id') id: string) {
    return this.blogService.remove(id);
  }
}
