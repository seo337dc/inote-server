import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export const SIMILAR_LIMIT_DEFAULT = 5;
export const SIMILAR_LIMIT_MAX = 10;

export class SimilarPostsQueryDto {
  @ApiPropertyOptional({
    description: `돌려줄 비슷한 글 수 (1~${SIMILAR_LIMIT_MAX}, 없으면 ${SIMILAR_LIMIT_DEFAULT})`,
    default: SIMILAR_LIMIT_DEFAULT,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(SIMILAR_LIMIT_MAX)
  limit?: number = SIMILAR_LIMIT_DEFAULT;
}
