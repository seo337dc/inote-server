import { Body, Controller, Get, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../../auth/auth.guard';
import { CurrentUser } from '../../auth/current-user.decorator';
import { CreateSettingHistoryDto } from './dto/create-setting-history.dto';
import { UpsertSettingsDto } from './dto/upsert-settings.dto';
import { SettingsService } from './settings.service';

@ApiTags('Money - Settings')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('money/settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @ApiOperation({ summary: '내 자산 설정 조회' })
  get(@CurrentUser() user: { id: string }) {
    return this.settingsService.get(user.id);
  }

  @Put()
  @ApiOperation({ summary: '내 자산 설정 저장 (없으면 생성, 있으면 수정)' })
  upsert(@CurrentUser() user: { id: string }, @Body() dto: UpsertSettingsDto) {
    return this.settingsService.upsert(user.id, dto);
  }

  @Post('history')
  @ApiOperation({ summary: '현재 자산 설정을 히스토리로 기록' })
  createHistory(
    @CurrentUser() user: { id: string },
    @Body() dto: CreateSettingHistoryDto,
  ) {
    return this.settingsService.createHistory(user.id, dto.month);
  }

  @Get('history')
  @ApiOperation({ summary: '자산 설정 히스토리 목록 조회' })
  getHistory(@CurrentUser() user: { id: string }) {
    return this.settingsService.getHistory(user.id);
  }
}
