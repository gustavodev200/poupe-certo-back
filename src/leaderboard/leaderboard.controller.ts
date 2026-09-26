import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { LeaderboardEntryDto } from './dto/leaderboard-entry.dto';
import {
  leaderboardQuerySchema,
  type LeaderboardQuery,
} from './dto/leaderboard-query.schema';
import { LeaderboardService } from './leaderboard.service';

@ApiTags('leaderboard')
@Controller('leaderboard')
export class LeaderboardController {
  constructor(private readonly leaderboard: LeaderboardService) {}

  @Get()
  @ApiOperation({ summary: 'Ranking público dos principais contribuidores' })
  @ApiQuery({ name: 'limit', required: false })
  @ApiOkResponse({ type: LeaderboardEntryDto, isArray: true })
  getTop(
    @Query(new ZodValidationPipe(leaderboardQuerySchema))
    query: LeaderboardQuery,
  ): Promise<LeaderboardEntryDto[]> {
    return this.leaderboard.getTop(query.limit);
  }
}
