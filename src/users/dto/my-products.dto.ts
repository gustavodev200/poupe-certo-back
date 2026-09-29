import { ApiProperty } from '@nestjs/swagger';
import { PRODUCT_STATUSES } from './my-products-query.schema';

class MyProductDto {
  @ApiProperty({ example: '7891000100103' })
  ean!: string;

  @ApiProperty({ example: 'Leite Condensado' })
  name!: string;

  @ApiProperty({ example: 'Moça' })
  brand!: string;

  @ApiProperty({ example: '395 g' })
  qty!: string;

  @ApiProperty({ example: 'merc' })
  category!: string;

  @ApiProperty({ nullable: true, type: String })
  imageUrl!: string | null;

  @ApiProperty({ enum: PRODUCT_STATUSES })
  status!: string;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty({ nullable: true, type: String })
  reviewedAt!: string | null;
}

class MyProductsCountsDto {
  @ApiProperty({ example: 3 })
  PENDING!: number;

  @ApiProperty({ example: 5 })
  APPROVED!: number;

  @ApiProperty({ example: 1 })
  REJECTED!: number;
}

export class MyProductsResultDto {
  @ApiProperty({ type: MyProductDto, isArray: true })
  items!: MyProductDto[];

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  pageSize!: number;

  @ApiProperty({
    example: 3,
    description: 'Total do filtro aplicado (status ou todos)',
  })
  total!: number;

  @ApiProperty({ type: MyProductsCountsDto })
  counts!: MyProductsCountsDto;
}
