import { ApiProperty } from '@nestjs/swagger';

// Classe de documentação Swagger, espelhando location.schema.ts — nunca usada
// para validar em runtime (mesmo padrão de market.dto.ts).
export class UpdateLocationDto {
  @ApiProperty({ example: 'Goiânia' })
  city!: string;

  @ApiProperty({ example: 'GO' })
  uf!: string;
}

export class LocationDto {
  @ApiProperty({ example: 'Goiânia' })
  city!: string;

  @ApiProperty({ example: 'GO' })
  uf!: string;
}
