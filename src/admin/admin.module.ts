import { Module } from '@nestjs/common';
import { AdminEmbeddingsController } from './embeddings/admin-embeddings.controller';
import { AdminEmbeddingsService } from './embeddings/admin-embeddings.service';
import { AdminUsersController } from './users/admin-users.controller';
import { AdminUsersService } from './users/admin-users.service';

@Module({
  controllers: [AdminUsersController, AdminEmbeddingsController],
  providers: [AdminUsersService, AdminEmbeddingsService],
})
export class AdminModule {}
