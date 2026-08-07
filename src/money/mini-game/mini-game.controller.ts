import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../../auth/auth.guard';
import { CurrentUser } from '../../auth/current-user.decorator';
import { CreateMiniGameResultDto } from './dto/create-mini-game-result.dto';
import { MiniGameService } from './mini-game.service';

@ApiTags('Money - MiniGame')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('money/mini-game/results')
export class MiniGameController {
  constructor(private readonly miniGameService: MiniGameService) {}

  @Get()
  @ApiOperation({ summary: '미니게임 결과 이력 조회' })
  findAll(@CurrentUser() user: { id: string }) {
    return this.miniGameService.findAll(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: '미니게임 결과 단건 조회' })
  findOne(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.miniGameService.findOne(user.id, id);
  }

  @Post()
  @ApiOperation({ summary: '미니게임 결과 저장' })
  create(
    @CurrentUser() user: { id: string },
    @Body() dto: CreateMiniGameResultDto,
  ) {
    return this.miniGameService.create(user.id, dto);
  }
}
