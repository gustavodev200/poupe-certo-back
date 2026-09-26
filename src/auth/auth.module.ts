import { Module } from '@nestjs/common';
import { OperatorGuard } from './operator.guard';
import { SupabaseJwtGuard } from './supabase-jwt.guard';

@Module({
  providers: [SupabaseJwtGuard, OperatorGuard],
  exports: [SupabaseJwtGuard, OperatorGuard],
})
export class AuthModule {}
