import { Body, Controller, Param, Post, Res, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../auth/current-user.decorator';
import { SupabaseJwtGuard } from '../auth/supabase-jwt.guard';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { uuidParamSchema } from '../common/schemas/uuid.schema';
import { WriteThrottle } from '../common/throttle/write-throttle.decorator';
import { eanSchema } from '../products/dto/product.schema';
import {
  ConfirmationResultDto,
  CreatePriceReportDto,
  PriceReportResultDto,
} from './dto/price-report.dto';
import {
  createPriceReportSchema,
  type CreatePriceReportInput,
} from './dto/price-report.schema';
import { PriceReportsService } from './price-reports.service';

@ApiTags('price-reports')
@Controller()
export class PriceReportsController {
  constructor(private readonly priceReports: PriceReportsService) {}

  @Post('products/:ean/price-reports')
  @UseGuards(SupabaseJwtGuard)
  @WriteThrottle()
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Reporta um preço para um produto existente num mercado',
  })
  @ApiParam({ name: 'ean' })
  @ApiBody({ type: CreatePriceReportDto })
  @ApiOkResponse({
    type: PriceReportResultDto,
    description: '201 aceito direto, 202 pendente de revisão',
  })
  @ApiNotFoundResponse({
    description: 'Produto não encontrado ou não aprovado',
  })
  @ApiBadRequestResponse({ description: 'Mercado inválido ou preço inválido' })
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('ean', new ZodValidationPipe(eanSchema)) ean: string,
    @Body(new ZodValidationPipe(createPriceReportSchema))
    dto: CreatePriceReportInput,
    @Res({ passthrough: true }) res: Response,
  ): Promise<PriceReportResultDto> {
    const result = await this.priceReports.create(ean, user.id, dto);
    res.status(result.status === 'ACTIVE' ? 201 : 202);
    return result;
  }

  @Post('price-reports/:id/confirmations')
  @UseGuards(SupabaseJwtGuard)
  @WriteThrottle()
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Confirma que um preço ativo ainda está correto (idempotente por pessoa)',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: ConfirmationResultDto })
  @ApiNotFoundResponse({
    description: 'Preço não encontrado ou não está ativo',
  })
  confirm(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ZodValidationPipe(uuidParamSchema)) id: string,
  ): Promise<ConfirmationResultDto> {
    return this.priceReports.confirm(id, user.id);
  }
}
