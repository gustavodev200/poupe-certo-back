import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// Classe de documentação Swagger, espelhando market.schema.ts — nunca usada
// para validar em runtime (ver research.md#5).
export class MarketDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Mercado X' })
  name!: string;

  @ApiPropertyOptional({ example: 'Av. Central, 900' })
  address!: string | null;

  @ApiPropertyOptional({ example: 'Goiânia' })
  city!: string | null;

  @ApiPropertyOptional({ example: 'GO' })
  uf!: string | null;
}

export class CreateMarketDto {
  @ApiProperty({ example: 'Mercado X' })
  name!: string;

  @ApiPropertyOptional({ example: 'Av. Central, 900' })
  address?: string;

  @ApiProperty({ example: 'Goiânia' })
  city!: string;

  @ApiProperty({ example: 'GO' })
  uf!: string;
}
