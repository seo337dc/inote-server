import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { RenameCategoryDto } from './dto/rename-category.dto';

@ApiTags('Categories')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  @ApiOperation({
    summary: '내 카테고리 목록 조회 (없으면 기본 5개 자동 생성)',
  })
  findAll(@CurrentUser() user: { id: string }) {
    return this.categoriesService.findAll(user.id);
  }

  @Post()
  @ApiOperation({
    summary:
      '카테고리 추가 (최상위 또는 하위, 최대 3단계). 같은 부모 아래 같은 이름은 불가',
  })
  @ApiConflictResponse({
    description: '같은 부모 아래에 같은 이름의 카테고리가 이미 있음',
  })
  create(@CurrentUser() user: { id: string }, @Body() dto: CreateCategoryDto) {
    return this.categoriesService.create(user.id, dto);
  }

  @Patch(':id')
  @ApiOperation({
    summary:
      '카테고리 이름 수정. 같은 부모 아래 형제와 이름이 겹치면 불가, 이 카테고리 글의 이름 사본도 함께 바뀜',
  })
  @ApiConflictResponse({
    description: '같은 부모 아래에 같은 이름의 카테고리가 이미 있음',
  })
  @ApiNotFoundResponse({
    description: '카테고리가 없거나 내 것이 아님',
  })
  rename(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: RenameCategoryDto,
  ) {
    return this.categoriesService.rename(user.id, id, dto);
  }
}
