import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { validateEnv } from './common/config/env.schema';
import { HealthController } from './health/health.controller';
import { LeaderboardModule } from './leaderboard/leaderboard.module';
import { MarketsModule } from './markets/markets.module';
import { ModerationModule } from './moderation/moderation.module';
import { PriceReportsModule } from './price-reports/price-reports.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProductsModule } from './products/products.module';
import { ShoppingListModule } from './shopping-list/shopping-list.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }]),
    PrismaModule,
    UsersModule,
    MarketsModule,
    ProductsModule,
    PriceReportsModule,
    ModerationModule,
    LeaderboardModule,
    ShoppingListModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
