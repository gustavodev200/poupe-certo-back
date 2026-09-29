import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CloudinaryService } from './cloudinary.service';
import { OpenFoodFactsService } from './open-food-facts.service';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

@Module({
  imports: [AuthModule],
  controllers: [ProductsController],
  providers: [ProductsService, OpenFoodFactsService, CloudinaryService],
  exports: [ProductsService],
})
export class ProductsModule {}
