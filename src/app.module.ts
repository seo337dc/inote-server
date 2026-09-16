import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { MoneyModule } from './money/money.module';
import { BlogModule } from './blog/blog.module';
import { MandalartModule } from './mandalart/mandalart.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    UsersModule,
    MoneyModule,
    BlogModule,
    MandalartModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
