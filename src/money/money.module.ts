import { Module } from '@nestjs/common';
import { ExpensesController } from './expenses/expenses.controller';
import { ExpensesService } from './expenses/expenses.service';
import { MiniGameController } from './mini-game/mini-game.controller';
import { MiniGameService } from './mini-game/mini-game.service';
import { ReviewsController } from './reviews/reviews.controller';
import { ReviewsService } from './reviews/reviews.service';
import { SettingsController } from './settings/settings.controller';
import { SettingsService } from './settings/settings.service';
import { StocksController } from './stocks/stocks.controller';
import { StocksService } from './stocks/stocks.service';

@Module({
  controllers: [
    ExpensesController,
    StocksController,
    SettingsController,
    ReviewsController,
    MiniGameController,
  ],
  providers: [ExpensesService, StocksService, SettingsService, ReviewsService, MiniGameService],
})
export class MoneyModule {}
