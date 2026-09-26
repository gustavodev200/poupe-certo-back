import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CATEGORY_CODES, type CategoryCode } from '../../products/categories';

export class ModerationDecisionDto {
  @ApiProperty({ enum: ['approve', 'reject'] })
  decision!: 'approve' | 'reject';
}

class ProductRefDto {
  @ApiProperty()
  ean!: string;

  @ApiProperty()
  name!: string;
}

class MarketRefDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;
}

export class PendingProductDto {
  @ApiProperty()
  ean!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  brand!: string;

  @ApiProperty()
  qty!: string;

  @ApiProperty({ enum: CATEGORY_CODES })
  category!: CategoryCode;

  @ApiProperty({ format: 'uuid' })
  createdBy!: string;

  @ApiProperty()
  createdAt!: string;
}

export class PendingPriceReportDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ type: ProductRefDto })
  product!: ProductRefDto;

  @ApiProperty({ type: MarketRefDto })
  market!: MarketRefDto;

  @ApiProperty({ example: 99.9 })
  price!: number;

  @ApiProperty({ format: 'uuid' })
  reportedBy!: string;

  @ApiProperty()
  createdAt!: string;
}

export class ModerationQueueDto {
  @ApiProperty({ type: PendingProductDto, isArray: true })
  products!: PendingProductDto[];

  @ApiProperty({ type: PendingPriceReportDto, isArray: true })
  priceReports!: PendingPriceReportDto[];
}

export class ProductDecisionResultDto {
  @ApiProperty()
  ean!: string;

  @ApiProperty({ enum: ['APPROVED', 'REJECTED'] })
  status!: 'APPROVED' | 'REJECTED';

  @ApiPropertyOptional({ example: 5 })
  pointsReverted?: number;
}

export class PriceReportDecisionResultDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: ['ACTIVE', 'REJECTED'] })
  status!: 'ACTIVE' | 'REJECTED';
}
