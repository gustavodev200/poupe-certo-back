import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../auth/current-user.decorator';
import { SupabaseJwtGuard } from '../auth/supabase-jwt.guard';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { WriteThrottle } from '../common/throttle/write-throttle.decorator';
import {
  CreateProductDto,
  CreateProductResponseDto,
  EanLookupDto,
  ProductDetailDto,
  ProductExistsDto,
  SearchProductsResultDto,
} from './dto/product.dto';
import {
  createProductSchema,
  eanSchema,
  productDetailQuerySchema,
  searchProductsQuerySchema,
  type CreateProductInput,
  type ProductDetailQuery,
  type SearchProductsQuery,
} from './dto/product.schema';
import { OpenFoodFactsService } from './open-food-facts.service';
import { ProductsService } from './products.service';

@ApiTags('products')
@Controller('products')
export class ProductsController {
  constructor(
    private readonly products: ProductsService,
    private readonly openFoodFacts: OpenFoodFactsService,
  ) {}

  @Get('search')
  @ApiOperation({
    summary: 'Busca produtos aprovados por nome/marca (público)',
  })
  @ApiQuery({ name: 'q', required: false })
  @ApiQuery({ name: 'category', required: false })
  @ApiQuery({ name: 'sort', required: false, enum: ['preco', 'recente'] })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  @ApiQuery({ name: 'city', required: false })
  @ApiQuery({ name: 'uf', required: false })
  @ApiOkResponse({ type: SearchProductsResultDto })
  search(
    @Query(new ZodValidationPipe(searchProductsQuerySchema))
    query: SearchProductsQuery,
  ) {
    return this.products.search(query);
  }

  @Get('ean/:ean/exists')
  @ApiOperation({
    summary:
      'Verifica se um EAN já existe na base (público, usado pelo fluxo de scan)',
  })
  @ApiParam({ name: 'ean' })
  @ApiOkResponse({ type: ProductExistsDto })
  existsByEan(@Param('ean', new ZodValidationPipe(eanSchema)) ean: string) {
    return this.products.existsByEan(ean);
  }

  @Get('ean/:ean/lookup')
  @UseGuards(SupabaseJwtGuard)
  // Além do cache/dedupe no service, limita quantos EANs *diferentes* uma
  // pessoa consegue forçar contra o Open Food Facts por minuto.
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Sugere nome/marca/quantidade/categoria/foto de um EAN via Open Food Facts (cacheado)',
  })
  @ApiParam({ name: 'ean' })
  @ApiOkResponse({ type: EanLookupDto })
  lookup(@Param('ean', new ZodValidationPipe(eanSchema)) ean: string) {
    return this.openFoodFacts.lookup(ean);
  }

  @Get(':ean')
  @ApiOperation({
    summary:
      'Detalhe de um produto aprovado, com ofertas por mercado (público)',
  })
  @ApiParam({ name: 'ean' })
  @ApiQuery({ name: 'city', required: false })
  @ApiQuery({ name: 'uf', required: false })
  @ApiOkResponse({ type: ProductDetailDto })
  @ApiNotFoundResponse()
  findDetail(
    @Param('ean', new ZodValidationPipe(eanSchema)) ean: string,
    @Query(new ZodValidationPipe(productDetailQuerySchema))
    query: ProductDetailQuery,
  ) {
    return this.products.findDetail(ean, query);
  }

  @Post()
  @UseGuards(SupabaseJwtGuard)
  @WriteThrottle()
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Cadastra um produto novo (fica pendente de aprovação)',
  })
  @ApiBody({ type: CreateProductDto })
  @ApiCreatedResponse({ type: CreateProductResponseDto })
  @ApiConflictResponse({
    description: 'EAN já cadastrado (aprovado ou pendente)',
  })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createProductSchema)) dto: CreateProductInput,
  ) {
    return this.products.create(user.id, dto);
  }
}
