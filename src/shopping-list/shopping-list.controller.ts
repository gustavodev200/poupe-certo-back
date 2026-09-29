import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
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
import {
  AddToListDto,
  ShoppingListItemDto,
  ToggleListItemDto,
} from './dto/shopping-list.dto';
import {
  addToListSchema,
  toggleListItemSchema,
  type AddToListInput,
  type ToggleListItemInput,
} from './dto/shopping-list.schema';
import { ShoppingListService } from './shopping-list.service';

@ApiTags('shopping-list')
@ApiBearerAuth()
@Controller('users/me/list')
@UseGuards(SupabaseJwtGuard)
export class ShoppingListController {
  constructor(private readonly shoppingList: ShoppingListService) {}

  @Get()
  @ApiOperation({
    summary: 'Lista os itens da lista de compras da própria conta',
  })
  @ApiOkResponse({ type: ShoppingListItemDto, isArray: true })
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.shoppingList.list(user.id);
  }

  @Post()
  @WriteThrottle()
  @ApiOperation({
    summary:
      'Adiciona um produto à lista, capturando a oferta vigente como snapshot (idempotente por produto)',
  })
  @ApiBody({ type: AddToListDto })
  @ApiOkResponse({ type: ShoppingListItemDto })
  async add(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(addToListSchema)) dto: AddToListInput,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { item, created } = await this.shoppingList.add(user.id, dto);
    res.status(created ? 201 : 200);
    return item;
  }

  @Patch(':id')
  @WriteThrottle()
  @ApiOperation({ summary: 'Marca ou desmarca um item como comprado' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBody({ type: ToggleListItemDto })
  @ApiOkResponse({ type: ShoppingListItemDto })
  setPurchased(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ZodValidationPipe(uuidParamSchema)) id: string,
    @Body(new ZodValidationPipe(toggleListItemSchema)) dto: ToggleListItemInput,
  ) {
    return this.shoppingList.setPurchased(user.id, id, dto.purchased);
  }

  @Delete(':id')
  @HttpCode(204)
  @WriteThrottle()
  @ApiOperation({ summary: 'Remove definitivamente um item da lista' })
  @ApiParam({ name: 'id', format: 'uuid' })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ZodValidationPipe(uuidParamSchema)) id: string,
  ) {
    return this.shoppingList.remove(user.id, id);
  }
}
