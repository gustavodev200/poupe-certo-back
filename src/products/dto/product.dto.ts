import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CATEGORY_CODES, type CategoryCode } from '../categories';

export class MarketRefDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Mercado B' })
  name!: string;
}

export class OfferSummaryDto {
  @ApiProperty({ type: MarketRefDto })
  market!: MarketRefDto;

  @ApiProperty({ example: 25.9 })
  price!: number;

  @ApiProperty({ example: '2026-09-25T00:00:00.000Z' })
  reportedAt!: string;

  @ApiProperty({ example: 8 })
  confirmations!: number;
}

export class OfferDetailDto extends OfferSummaryDto {
  @ApiProperty({ format: 'uuid' })
  priceReportId!: string;
}

export class ProductStatsDto {
  @ApiPropertyOptional({ example: 25.9, nullable: true })
  lowest!: number | null;

  @ApiPropertyOptional({ example: 27.65, nullable: true })
  average!: number | null;

  @ApiPropertyOptional({ example: 29.9, nullable: true })
  highest!: number | null;
}

export class HistoryPointDto {
  @ApiProperty({ example: '2026-08-1' })
  period!: string;

  @ApiProperty({ example: 27.9 })
  lowestPrice!: number;
}

export class ProductSummaryDto {
  @ApiProperty({ example: '7891234567890' })
  ean!: string;

  @ApiProperty({ example: 'Arroz Camil Tipo 1' })
  name!: string;

  @ApiProperty({ example: 'Camil' })
  brand!: string;

  @ApiProperty({ example: '5kg' })
  qty!: string;

  @ApiProperty({ enum: CATEGORY_CODES, example: 'merc' })
  category!: CategoryCode;

  @ApiPropertyOptional({ type: OfferSummaryDto, nullable: true })
  lowestOffer!: OfferSummaryDto | null;

  @ApiProperty({ example: 4 })
  offerCount!: number;
}

export class ProductDetailDto {
  @ApiProperty({ example: '7891234567890' })
  ean!: string;

  @ApiProperty({ example: 'Arroz Camil Tipo 1' })
  name!: string;

  @ApiProperty({ example: 'Camil' })
  brand!: string;

  @ApiProperty({ example: '5kg' })
  qty!: string;

  @ApiProperty({ enum: CATEGORY_CODES, example: 'merc' })
  category!: CategoryCode;

  @ApiProperty({ type: OfferDetailDto, isArray: true })
  offers!: OfferDetailDto[];

  @ApiProperty({ type: ProductStatsDto })
  stats!: ProductStatsDto;

  @ApiProperty({ type: HistoryPointDto, isArray: true })
  history!: HistoryPointDto[];
}

export class SearchProductsResultDto {
  @ApiProperty({ type: ProductSummaryDto, isArray: true })
  items!: ProductSummaryDto[];

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  pageSize!: number;

  @ApiProperty({ example: 1 })
  total!: number;
}

export class ProductExistsDto {
  @ApiProperty()
  exists!: boolean;

  @ApiProperty()
  approved!: boolean;
}

export class CreateProductDto {
  @ApiProperty({ example: '7891234567891' })
  ean!: string;

  @ApiProperty({ example: 'Feijão Preto Camil' })
  name!: string;

  @ApiProperty({ example: 'Camil' })
  brand!: string;

  @ApiProperty({ example: '1kg' })
  qty!: string;

  @ApiProperty({ enum: CATEGORY_CODES, example: 'merc' })
  category!: CategoryCode;

  @ApiPropertyOptional({ example: null, nullable: true })
  imageUrl?: string;

  @ApiProperty({ format: 'uuid' })
  marketId!: string;

  @ApiProperty({ example: 5.99 })
  price!: number;
}

export class CreateProductResponseDto {
  @ApiProperty({ example: '7891234567891' })
  ean!: string;

  @ApiProperty({ enum: ['PENDING'], example: 'PENDING' })
  status!: 'PENDING';

  @ApiProperty({ example: 5 })
  pointsAwarded!: number;
}
