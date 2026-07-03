import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { InputMode, Market } from '@prisma/client';
import { IsEnum, IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';

export class CreateStockDto {
  @ApiProperty({ description: '시장 구분', enum: Market, example: Market.KR })
  @IsEnum(Market)
  market: Market;

  @ApiPropertyOptional({ description: '종목 코드', example: '005930' })
  @IsOptional()
  @IsString()
  ticker?: string;

  @ApiProperty({ description: '종목명', example: '삼성전자' })
  @IsString()
  name: string;

  @ApiProperty({ description: '입력 모드', enum: InputMode, example: InputMode.QUANTITY })
  @IsEnum(InputMode)
  inputMode: InputMode;

  @ApiPropertyOptional({ description: '보유 수량 (QUANTITY 모드)', example: 10 })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  quantity?: number;

  @ApiPropertyOptional({ description: '평균 매입가 (QUANTITY 모드)', example: 75000 })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  averagePrice?: number;

  @ApiPropertyOptional({ description: '투자 총액 (AMOUNT 모드, USD)', example: 1000 })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  investedAmount?: number;
}
