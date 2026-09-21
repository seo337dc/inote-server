import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { IncomingHttpHeaders } from 'http';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { SetPasswordDto } from './dto/set-password.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: '내 프로필 조회' })
  getMe(@CurrentUser() user: { id: string }) {
    return this.usersService.getMe(user.id);
  }

  @Patch('me')
  @ApiOperation({ summary: '내 프로필 수정' })
  updateMe(@CurrentUser() user: { id: string }, @Body() dto: UpdateUserDto) {
    return this.usersService.updateMe(user.id, dto);
  }

  @Post('set-password')
  @ApiOperation({ summary: '비밀번호 생성 (소셜 로그인 전용 계정에 비밀번호 추가)' })
  setPassword(
    @Headers() headers: IncomingHttpHeaders,
    @Body() dto: SetPasswordDto,
  ) {
    return this.usersService.setPassword(headers, dto);
  }

  @Delete('me')
  @ApiOperation({ summary: '회원 탈퇴' })
  deleteMe(@CurrentUser() user: { id: string }) {
    return this.usersService.deleteMe(user.id);
  }
}
