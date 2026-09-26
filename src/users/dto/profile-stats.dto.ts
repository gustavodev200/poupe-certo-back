import { ApiProperty } from '@nestjs/swagger';

export class ProfileStatsDto {
  @ApiProperty({ example: 87 })
  pricesReported!: number;

  @ApiProperty({ example: 32 })
  productsCreated!: number;

  @ApiProperty({ example: 24 })
  confirmationsGiven!: number;

  @ApiProperty({ example: 96 })
  confidencePercent!: number;

  @ApiProperty({ example: 132 })
  points!: number;

  @ApiProperty({ example: 2 })
  level!: number;

  @ApiProperty({
    example: 68,
    description: 'Pontos que faltam para o próximo nível',
  })
  pointsToNextLevel!: number;

  @ApiProperty({ example: 32 })
  progressPercent!: number;

  @ApiProperty({ example: 8 })
  rankPosition!: number;
}

class ContributionProductRefDto {
  @ApiProperty()
  ean!: string;

  @ApiProperty()
  name!: string;
}

class ContributionMarketRefDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;
}

export class ContributionItemDto {
  @ApiProperty({ enum: ['price_report', 'product_created'] })
  type!: 'price_report' | 'product_created';

  @ApiProperty({ type: ContributionProductRefDto })
  product!: ContributionProductRefDto;

  @ApiProperty({
    type: ContributionMarketRefDto,
    required: false,
    nullable: true,
  })
  market?: ContributionMarketRefDto | null;

  @ApiProperty({ required: false, example: 25.9 })
  price?: number;

  @ApiProperty()
  createdAt!: string;
}

export class ContributionsResultDto {
  @ApiProperty({ type: ContributionItemDto, isArray: true })
  items!: ContributionItemDto[];

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  pageSize!: number;

  @ApiProperty({ example: 119 })
  total!: number;
}
