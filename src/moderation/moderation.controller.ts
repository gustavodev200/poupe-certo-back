import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../auth/current-user.decorator';
import { OperatorGuard } from '../auth/operator.guard';
import { SupabaseJwtGuard } from '../auth/supabase-jwt.guard';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { uuidParamSchema } from '../common/schemas/uuid.schema';
import { eanSchema } from '../products/dto/product.schema';
import {
  ModerationDecisionDto,
  ModerationQueueDto,
  PriceReportDecisionResultDto,
  ProductDecisionResultDto,
} from './dto/moderation.dto';
import {
  moderationDecisionSchema,
  type ModerationDecisionInput,
} from './dto/moderation.schema';
import { ModerationService } from './moderation.service';

@ApiTags('moderation')
@ApiBearerAuth()
@ApiForbiddenResponse({ description: 'Autenticado, mas sem papel de operador' })
@Controller('moderation')
@UseGuards(SupabaseJwtGuard, OperatorGuard)
export class ModerationController {
  constructor(private readonly moderation: ModerationService) {}

  @Get('queue')
  @ApiOperation({
    summary: 'Lista produtos e preços pendentes de revisão (só operador)',
  })
  @ApiOkResponse({ type: ModerationQueueDto })
  queue(@CurrentUser() user: AuthenticatedUser) {
    return this.moderation.listQueue(user.id);
  }

  @Patch('products/:ean')
  @ApiOperation({
    summary: 'Aprova ou rejeita um produto pendente (só operador)',
  })
  @ApiParam({ name: 'ean' })
  @ApiBody({ type: ModerationDecisionDto })
  @ApiOkResponse({ type: ProductDecisionResultDto })
  @ApiConflictResponse({ description: 'Produto já foi decidido antes' })
  decideProduct(
    @CurrentUser() user: AuthenticatedUser,
    @Param('ean', new ZodValidationPipe(eanSchema)) ean: string,
    @Body(new ZodValidationPipe(moderationDecisionSchema))
    dto: ModerationDecisionInput,
  ) {
    return this.moderation.decideProduct(ean, dto.decision, user.id);
  }

  @Patch('price-reports/:id')
  @ApiOperation({
    summary: 'Aprova ou rejeita um preço pendente de revisão (só operador)',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBody({ type: ModerationDecisionDto })
  @ApiOkResponse({ type: PriceReportDecisionResultDto })
  @ApiConflictResponse({ description: 'Preço já foi decidido antes' })
  decidePriceReport(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ZodValidationPipe(uuidParamSchema)) id: string,
    @Body(new ZodValidationPipe(moderationDecisionSchema))
    dto: ModerationDecisionInput,
  ) {
    return this.moderation.decidePriceReport(id, dto.decision, user.id);
  }
}
