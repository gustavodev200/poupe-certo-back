import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// Nunca inclui e-mail nem qualquer dado além de nome de exibição, foto,
// nível e contadores públicos (FR-021) — reforçado pelo grant de coluna
// restrito da migration (profiles_select_public_leaderboard).
export class LeaderboardEntryDto {
  @ApiProperty({ example: 'Marina Alves' })
  displayName!: string | null;

  @ApiPropertyOptional({ example: 'https://...' })
  avatarUrl!: string | null;

  @ApiProperty({ example: 7 })
  level!: number;

  @ApiProperty({ example: 780 })
  points!: number;

  @ApiProperty({ example: 156 })
  pricesReported!: number;
}
