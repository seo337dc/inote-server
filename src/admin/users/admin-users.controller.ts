import { Controller, Get, Query, UseGuards } from '@nestjs/common';
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
}
