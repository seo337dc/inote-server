import { Test } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { TodosService } from './todos.service';
import { PrismaService } from '../prisma/prisma.service';

describe('TodosService', () => {
  let service: TodosService;

  const mockPrisma = {
    todo: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module = await Test.createTestingModule({
      providers: [
        TodosService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get(TodosService);
  });

  describe('findAll', () => {
    it('그 유저의 할 일을 미완료 우선·최신순으로 조회한다', async () => {
      mockPrisma.todo.findMany.mockResolvedValue([]);

      await service.findAll('u1');

      expect(mockPrisma.todo.findMany).toHaveBeenCalledWith({
        where: { userId: 'u1' },
        orderBy: [{ done: 'asc' }, { createdAt: 'desc' }],
      });
    });
  });

  describe('create', () => {
    it('마감일 없이 생성한다', async () => {
      mockPrisma.todo.create.mockResolvedValue({ id: 't1' });

      await service.create('u1', { title: '장보기' });

      expect(mockPrisma.todo.create).toHaveBeenCalledWith({
        data: { userId: 'u1', title: '장보기' },
      });
    });

    it('마감일이 있으면 Date로 변환해서 저장한다', async () => {
      mockPrisma.todo.create.mockResolvedValue({ id: 't1' });

      await service.create('u1', { title: '장보기', dueDate: '2026-09-30' });

      const call = mockPrisma.todo.create.mock.calls[0][0];
      expect(call.data.dueDate).toBeInstanceOf(Date);
    });
  });

  describe('update', () => {
    it('존재하지 않으면 NotFoundException', async () => {
      mockPrisma.todo.findUnique.mockResolvedValue(null);

      await expect(service.update('u1', 't1', { done: true })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('본인 것이 아니면 ForbiddenException', async () => {
      mockPrisma.todo.findUnique.mockResolvedValue({
        id: 't1',
        userId: 'owner',
      });

      await expect(
        service.update('other', 't1', { done: true }),
      ).rejects.toThrow(ForbiddenException);
      expect(mockPrisma.todo.update).not.toHaveBeenCalled();
    });

    it('done만 토글할 수 있다', async () => {
      mockPrisma.todo.findUnique.mockResolvedValue({ id: 't1', userId: 'u1' });
      mockPrisma.todo.update.mockResolvedValue({ id: 't1', done: true });

      await service.update('u1', 't1', { done: true });

      expect(mockPrisma.todo.update).toHaveBeenCalledWith({
        where: { id: 't1' },
        data: { done: true },
      });
    });

    it('마감일을 문자열에서 Date로 변환해서 저장한다', async () => {
      mockPrisma.todo.findUnique.mockResolvedValue({ id: 't1', userId: 'u1' });
      mockPrisma.todo.update.mockResolvedValue({ id: 't1' });

      await service.update('u1', 't1', { dueDate: '2026-10-01' });

      const call = mockPrisma.todo.update.mock.calls[0][0];
      expect(call.data.dueDate).toBeInstanceOf(Date);
    });
  });

  describe('remove', () => {
    it('본인 것이 아니면 ForbiddenException', async () => {
      mockPrisma.todo.findUnique.mockResolvedValue({
        id: 't1',
        userId: 'owner',
      });

      await expect(service.remove('other', 't1')).rejects.toThrow(
        ForbiddenException,
      );
      expect(mockPrisma.todo.delete).not.toHaveBeenCalled();
    });

    it('본인 것이면 삭제한다', async () => {
      mockPrisma.todo.findUnique.mockResolvedValue({ id: 't1', userId: 'u1' });
      mockPrisma.todo.delete.mockResolvedValue({ id: 't1' });

      const result = await service.remove('u1', 't1');

      expect(mockPrisma.todo.delete).toHaveBeenCalledWith({
        where: { id: 't1' },
      });
      expect(result).toEqual({ id: 't1' });
    });
  });
});
