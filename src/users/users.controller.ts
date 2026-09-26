import { Body, Controller, Get, Patch, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { SupabaseJwtGuard } from '../auth/supabase-jwt.guard';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../auth/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import {
  ContributionsResultDto,
  ProfileStatsDto,
} from './dto/profile-stats.dto';
import {
  contributionsQuerySchema,
  type ContributionsQuery,
} from './dto/contributions-query.schema';
import { LocationDto, UpdateLocationDto } from './dto/location.dto';
import {
  updateLocationSchema,
  type UpdateLocationInput,
} from './dto/location.schema';
import { UsersService, type ProfileResponse } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
@UseGuards(SupabaseJwtGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  @ApiOperation({
    summary: 'Confirma a sessão atual e devolve o próprio perfil',
  })
  me(@CurrentUser() user: AuthenticatedUser): Promise<ProfileResponse> {
    return this.users.findMe(user.id);
  }

  @Get('me/stats')
  @ApiOperation({
    summary: 'Estatísticas, nível e posição no ranking da própria pessoa',
  })
  @ApiOkResponse({ type: ProfileStatsDto })
  stats(@CurrentUser() user: AuthenticatedUser) {
    return this.users.getStats(user.id);
  }

  @Get('me/contributions')
  @ApiOperation({
    summary: 'Feed das próprias contribuições recentes (preços + produtos)',
  })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  @ApiOkResponse({ type: ContributionsResultDto })
  contributions(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(contributionsQuerySchema))
    query: ContributionsQuery,
  ) {
    return this.users.getContributions(user.id, query);
  }

  @Patch('me/location')
  @ApiOperation({
    summary: 'Salva a cidade/UF escolhida no onboarding no próprio perfil',
  })
  @ApiBody({ type: UpdateLocationDto })
  @ApiOkResponse({ type: LocationDto })
  setLocation(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(updateLocationSchema))
    dto: UpdateLocationInput,
  ) {
    return this.users.setLocation(user.id, dto);
  }
}
