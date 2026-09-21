import {
  Controller,
  Delete,
  Get,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../../auth/auth.guard';
import { AdminGuard } from '../../auth/admin.guard';
import { AdminUsersService } from './admin-users.service';
import { ListAdminUsersQueryDto } from './dto/list-admin-users-query.dto';

@ApiTags('Admin')
@ApiBearerAuth()
@UseGuards(AuthGuard, AdminGuard)
@Controller('admin/users')
export class AdminUsersController {
  constructor(private readonly adminUsersService: AdminUsersService) {}

  @Get()
  @ApiOperation({ summary: '회원 목록 조회 (관리자 전용, 페이지네이션)' })
  list(@Query() query: ListAdminUsersQueryDto) {
    return this.adminUsersService.list(query);
  }

  @Get(':id')
  @ApiOperation({ summary: '회원 상세 조회 (관리자 전용)' })
  getById(@Param('id') id: string) {
    return this.adminUsersService.getById(id);
  }

  @Delete(':id')
  @ApiOperation({ summary: '회원 삭제 (관리자 전용, 작성 글 포함 완전 삭제)' })
  delete(@Param('id') id: string) {
    return this.adminUsersService.delete(id);
  }
}
