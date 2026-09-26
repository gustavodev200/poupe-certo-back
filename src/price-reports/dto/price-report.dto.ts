import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePriceReportDto {
  @ApiProperty({ format: 'uuid' })
  marketId!: string;

  @ApiProperty({ example: 25.9 })
  price!: number;
}

export class PriceReportResultDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: ['ACTIVE', 'PENDING_REVIEW'], example: 'ACTIVE' })
  status!: 'ACTIVE' | 'PENDING_REVIEW';

  @ApiProperty({ example: 2 })
  pointsAwarded!: number;

  @ApiPropertyOptional({
    example: 'Preço fora do padrão, enviado para revisão',
  })
  message?: string;
}

export class ConfirmationResultDto {
  @ApiProperty({ format: 'uuid' })
  priceReportId!: string;

  @ApiProperty({ example: 9 })
  confirmations!: number;
}
