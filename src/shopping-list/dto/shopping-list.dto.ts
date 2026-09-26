import { ApiProperty } from '@nestjs/swagger';
import { MarketRefDto } from '../../products/dto/product.dto';

// Classe de documentação Swagger, espelhando shopping-list.schema.ts — nunca
// usada para validar em runtime (mesmo padrão de MarketDto).
export class AddToListDto {
  @ApiProperty({ example: '7891234567890' })
  productEan!: string;
}

export class ToggleListItemDto {
  @ApiProperty({ example: true })
  purchased!: boolean;
}

export class ProductRefDto {
  @ApiProperty({ example: '7891234567890' })
  ean!: string;

  @ApiProperty({ example: 'Arroz Camil Tipo 1' })
  name!: string;

  @ApiProperty({ example: 'Camil' })
  brand!: string;

  @ApiProperty({ example: '5kg' })
  qty!: string;
}

export class ShoppingListItemDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ type: ProductRefDto })
  product!: ProductRefDto;

  @ApiProperty({ type: MarketRefDto })
  market!: MarketRefDto;

  @ApiProperty({ example: 24.9 })
  price!: number;

  @ApiProperty({ example: false })
  purchased!: boolean;

  @ApiProperty({ example: '2026-09-26T00:00:00.000Z' })
  createdAt!: string;
}
