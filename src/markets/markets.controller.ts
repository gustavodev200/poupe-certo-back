import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
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
  marketsQuerySchema,
  type CreateMarketInput,
  type MarketsQuery,
} from './dto/market.schema';
import { MarketsService } from './markets.service';

@ApiTags('markets')
@Controller('markets')
export class MarketsController {
  constructor(private readonly markets: MarketsService) {}

  @Get()
  @ApiOperation({
    summary: 'Lista mercados (público); filtra por cidade/UF quando informados',
  })
  @ApiQuery({ name: 'city', required: false })
  @ApiQuery({ name: 'uf', required: false })
  @ApiOkResponse({ type: MarketDto, isArray: true })
  list(
    @Query(new ZodValidationPipe(marketsQuerySchema)) query: MarketsQuery,
  ): Promise<MarketDto[]> {
    return this.markets.list(query);
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
