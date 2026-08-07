import { ApiProperty } from '@nestjs/swagger';
import { GameResult } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class GameLogDto {
  @IsString()
  id: string;

  @IsInt()
  turn: number;

  @IsString()
  message: string;

  @IsString()
  type: string;

  @IsOptional()
  @IsNumber()
  amount?: number;

  @IsString()
  timestamp: string;
}

export class AssetStockDto {
  @IsString()
  id: string;

  @IsString()
  symbol: string;

  @IsString()
  name: string;

  @IsNumber()
  costPerShare: number;

  @IsNumber()
  shares: number;

  @IsNumber()
  dividendPerShare: number;
}

export class AssetRealEstateDto {
  @IsString()
  id: string;

  @IsString()
  name: string;

  @IsString()
  type: string;

  @IsNumber()
  cost: number;

  @IsNumber()
  downPayment: number;

  @IsNumber()
  mortgage: number;

  @IsNumber()
  cashflow: number;

  @IsNumber()
  roi: number;
}

export class LiabilityItemDto {
  @IsString()
  id: string;

  @IsString()
  name: string;

  @IsNumber()
  totalAmount: number;

  @IsNumber()
  monthlyExpense: number;

  @IsBoolean()
  canRepay: boolean;
}

export class CreateMiniGameResultDto {
  @ApiProperty({ description: '직업 ID', example: 'engineer' })
  @IsString()
  profession: string;

  @ApiProperty({
    description: '게임 결과',
    enum: GameResult,
    example: GameResult.WON,
  })
  @IsEnum(GameResult)
  result: GameResult;

  @ApiProperty({ description: '총 턴 수', example: 24 })
  @IsInt()
  turnCount: number;

  @ApiProperty({ description: '최종 보유 현금', example: 520 })
  @IsInt()
  finalCash: number;

  @ApiProperty({ description: '최종 패시브 인컴', example: 340 })
  @IsInt()
  finalPassiveIncome: number;

  @ApiProperty({ description: '최종 월 총지출', example: 321 })
  @IsInt()
  finalMonthlyExpenses: number;

  @ApiProperty({ description: '최종 월 잉여현금', example: 19 })
  @IsInt()
  finalMonthlyCashflow: number;

  @ApiProperty({ description: '최종 은행 대출 잔액', example: 0 })
  @IsInt()
  bankLoan: number;

  @ApiProperty({ description: '남은 부채 총합', example: 1200 })
  @IsInt()
  totalLiabilities: number;

  @ApiProperty({ description: '보유 주식 개수', example: 3 })
  @IsInt()
  stocksCount: number;

  @ApiProperty({ description: '보유 부동산 개수', example: 1 })
  @IsInt()
  realEstatesCount: number;

  @ApiProperty({ description: '자녀 수', example: 1 })
  @IsInt()
  childrenCount: number;

  @ApiProperty({ description: '최종 보유 주식 목록', type: [AssetStockDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AssetStockDto)
  finalStocks: AssetStockDto[];

  @ApiProperty({
    description: '최종 보유 부동산 목록',
    type: [AssetRealEstateDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AssetRealEstateDto)
  finalRealEstates: AssetRealEstateDto[];

  @ApiProperty({ description: '부채 스냅샷', type: [LiabilityItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LiabilityItemDto)
  liabilitiesSnapshot: LiabilityItemDto[];

  @ApiProperty({ description: '전체 턴별 행동 로그', type: [GameLogDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GameLogDto)
  gameLogs: GameLogDto[];
}
