import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { TodosService } from './todos.service';
import { CreateTodoDto } from './dto/create-todo.dto';
import { UpdateTodoDto } from './dto/update-todo.dto';

@ApiTags('Todos')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('todos')
export class TodosController {
  constructor(private readonly todosService: TodosService) {}

  @Get()
  @ApiOperation({ summary: '내 할 일 목록 조회 (미완료 우선, 최신순)' })
  findAll(@CurrentUser() user: { id: string }) {
    return this.todosService.findAll(user.id);
  }

  @Post()
  @ApiOperation({ summary: '할 일 추가' })
  create(@CurrentUser() user: { id: string }, @Body() dto: CreateTodoDto) {
    return this.todosService.create(user.id, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: '할 일 수정 (본인 것만) — 제목/마감일/완료여부' })
  update(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: UpdateTodoDto,
  ) {
    return this.todosService.update(user.id, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: '할 일 삭제 (본인 것만)' })
  remove(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.todosService.remove(user.id, id);
  }
}
