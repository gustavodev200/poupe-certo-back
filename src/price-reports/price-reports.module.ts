import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PriceReportsController } from './price-reports.controller';
import { PriceReportsService } from './price-reports.service';

@Module({
  imports: [AuthModule],
  controllers: [PriceReportsController],
  providers: [PriceReportsService],
})
export class PriceReportsModule {}
