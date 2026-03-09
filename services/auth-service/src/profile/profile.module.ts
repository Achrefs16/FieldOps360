import { Module } from '@nestjs/common';
import { ProfileService } from './profile.service';
import { ProfileController } from './profile.controller';
import { AuditLogService } from '../common/audit/audit-log.service';

@Module({
    controllers: [ProfileController],
    providers: [ProfileService, AuditLogService],
})
export class ProfileModule { }
