import { Module, Global } from '@nestjs/common';
import { PlatformDatabaseService } from './platform.service';
import { TenantDatabaseService } from './tenant.service';

@Global()
@Module({
    providers: [PlatformDatabaseService, TenantDatabaseService],
    exports: [PlatformDatabaseService, TenantDatabaseService],
})
export class DatabaseModule { }
