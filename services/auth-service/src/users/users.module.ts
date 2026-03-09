import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { AuditLogService } from '../common/audit/audit-log.service';

@Module({
    controllers: [UsersController],
    providers: [UsersService, PermissionsGuard, AuditLogService],
    exports: [UsersService],
})
export class UsersModule { }
