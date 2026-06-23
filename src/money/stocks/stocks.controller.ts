import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../../auth/auth.guard';
import { CurrentUser } from '../../auth/current-user.decorator';
import { CreateStockDto } from './dto/create-stock.dto';
import { UpdateStockDto } from './dto/update-stock.dto';
import { StocksService } from './stocks.service';

@ApiTags('Money - Stocks')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('money/stocks')
export class StocksController {
  constructor(private readonly stocksService: StocksService) {}

  @Get()
  @ApiOperation({ summary: '보유 주식 목록 조회' })
  findAll(@CurrentUser() user: { id: string }) {
    return this.stocksService.findAll(user.id);
  }

  @Post()
  @ApiOperation({ summary: '주식 추가' })
  create(@CurrentUser() user: { id: string }, @Body() dto: CreateStockDto) {
    return this.stocksService.create(user.id, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: '주식 수정' })
  update(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: UpdateStockDto,
  ) {
    return this.stocksService.update(user.id, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: '주식 삭제' })
  remove(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.stocksService.remove(user.id, id);
  }
}
