import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { MandalartService } from './mandalart.service';
import { CreateMandalartItemDto } from './dto/create-mandalart-item.dto';
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

  @Post()
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: '만다르트 항목 추가 (관리자만)' })
  create(
    @CurrentUser() user: { role?: string },
    @Body() dto: CreateMandalartItemDto,
  ) {
    return this.mandalartService.create(user.role, dto);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: '만다르트 항목 수정 (관리자만)' })
  update(
    @CurrentUser() user: { role?: string },
    @Param('id') id: string,
    @Body() dto: UpdateMandalartItemDto,
  ) {
    return this.mandalartService.update(user.role, id, dto);
  }
}
