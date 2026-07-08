import { Body, Controller, Get, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ReviewType } from '@prisma/client';
import { AuthGuard } from '../../auth/auth.guard';
import { CurrentUser } from '../../auth/current-user.decorator';
import { UpsertReviewDto } from './dto/upsert-review.dto';
import { ReviewsService } from './reviews.service';

@ApiTags('Money - Reviews')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('money/reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get()
  @ApiOperation({ summary: '리뷰 단건 조회' })
  @ApiQuery({ name: 'type', enum: ReviewType })
  @ApiQuery({ name: 'year', example: 2026 })
  @ApiQuery({ name: 'period', description: 'WEEKLY: ISO 주차, MONTHLY: 월(1-12)', example: 28 })
  findOne(
    @CurrentUser() user: { id: string },
    @Query('type') type: ReviewType,
    @Query('year') year: string,
    @Query('period') period: string,
  ) {
    return this.reviewsService.findOne(user.id, type, parseInt(year), parseInt(period));
  }

  @Put()
  @ApiOperation({ summary: '리뷰 저장 (없으면 생성, 있으면 수정)' })
  upsert(@CurrentUser() user: { id: string }, @Body() dto: UpsertReviewDto) {
    return this.reviewsService.upsert(user.id, dto);
  }
}
