import { Module } from '@nestjs/common';
import { ReadingLogsController } from './reading-logs.controller';
import { ReadingLogsService } from './reading-logs.service';

@Module({
  controllers: [ReadingLogsController],
  providers: [ReadingLogsService],
})
export class ReadingLogsModule {}
