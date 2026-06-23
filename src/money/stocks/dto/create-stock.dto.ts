import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';

export class CreateStockDto {
  @ApiProperty({ description: '종목 코드', example: '005930' })
  @IsString()
  ticker: string;

  @ApiProperty({ description: '종목명', example: '삼성전자' })
  @IsString()
  name: string;

  @ApiProperty({ description: '통화', enum: ['KRW', 'USD'] })
  @IsIn(['KRW', 'USD'])
  currency: string;

  @ApiProperty({ description: '입력 모드', enum: ['shares', 'amount'] })
  @IsIn(['shares', 'amount'])
  inputMode: string;

  @ApiPropertyOptional({ description: '보유 수량 (수량 모드)', example: 10 })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  quantity?: number;

  @ApiPropertyOptional({ description: '평균 매입가 (수량 모드)', example: 75000 })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  buyPrice?: number;

  @ApiPropertyOptional({ description: '투자 총액 (금액 모드)', example: 1000 })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  investAmount?: number;

  @ApiPropertyOptional({ description: '메모' })
  @IsOptional()
  @IsString()
  memo?: string;
}
