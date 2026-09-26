import { Body, Controller, Get, Post, Res, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../auth/current-user.decorator';
import { SupabaseJwtGuard } from '../auth/supabase-jwt.guard';
import { WriteThrottle } from '../common/throttle/write-throttle.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { CreateMarketDto, MarketDto } from './dto/market.dto';
import {
  createMarketSchema,
  type CreateMarketInput,
} from './dto/market.schema';
import { MarketsService } from './markets.service';

@ApiTags('markets')
@Controller('markets')
export class MarketsController {
  constructor(private readonly markets: MarketsService) {}

  @Get()
  @ApiOperation({ summary: 'Lista todos os mercados (público)' })
  @ApiOkResponse({ type: MarketDto, isArray: true })
  list(): Promise<MarketDto[]> {
    return this.markets.list();
  }

  @Post()
  @UseGuards(SupabaseJwtGuard)
  @WriteThrottle()
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Cria um mercado novo ou devolve o existente (upsert por nome)',
  })
  @ApiBody({ type: CreateMarketDto })
  @ApiOkResponse({ type: MarketDto })
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createMarketSchema)) dto: CreateMarketInput,
    @Res({ passthrough: true }) res: Response,
  ): Promise<MarketDto> {
    const { market, created } = await this.markets.createOrReuse(user.id, dto);
    res.status(created ? 201 : 200);
    return market;
  }
}
