import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../../auth/auth.guard';
import { CurrentUser } from '../../auth/current-user.decorator';
import { UpsertSettingsDto } from './dto/upsert-settings.dto';
import { SettingsService } from './settings.service';

@ApiTags('Money - Settings')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('money/settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @ApiOperation({ summary: '내 정보 설정 조회' })
  get(@CurrentUser() user: { id: string }) {
    return this.settingsService.get(user.id);
  }

  @Put()
  @ApiOperation({ summary: '내 정보 설정 저장 (없으면 생성, 있으면 수정)' })
  upsert(@CurrentUser() user: { id: string }, @Body() dto: UpsertSettingsDto) {
    return this.settingsService.upsert(user.id, dto);
  }
}
