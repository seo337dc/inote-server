import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { MandalartService } from './mandalart.service';
import { UpdateMandalartItemDto } from './dto/update-mandalart-item.dto';

@ApiTags('Mandalart')
@Controller('mandalart')
export class MandalartController {
  constructor(private readonly mandalartService: MandalartService) {}

  @Get()
  @ApiOperation({ summary: '만다르트 전체 항목 조회 (공개)' })
  findAll() {
    return this.mandalartService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: '만다르트 항목 단건 조회 (공개)' })
  findOne(@Param('id') id: string) {
    return this.mandalartService.findOne(id);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: '만다르트 항목 수정 (소유자만)' })
  update(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: UpdateMandalartItemDto,
  ) {
    return this.mandalartService.update(user.id, id, dto);
  }
}
