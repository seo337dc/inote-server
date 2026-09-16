import { Module } from '@nestjs/common';
import { MandalartController } from './mandalart.controller';
import { MandalartService } from './mandalart.service';

@Module({
  controllers: [MandalartController],
  providers: [MandalartService],
})
export class MandalartModule {}
