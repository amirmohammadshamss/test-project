import {
  IsDateString,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Min,
} from 'class-validator';
import { PageDto } from '../../restaurant-admin/presentation/dto';
export class PlatformPageDto extends PageDto {
  @IsOptional() @IsUUID() actorId?: string;
  @IsOptional() @IsIn(['SUCCESS', 'FAILURE']) outcome?: string;
  @IsOptional() @IsString() @Length(1, 100) resourceType?: string;
  @IsOptional() @IsIn(['ACTIVE', 'SUSPENDED']) status?: string;
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
  @IsOptional() @IsString() @Length(1, 100) action?: string;
  @IsOptional() @IsUUID() tenantId?: string;
}
export class ProvisionDto {
  @IsString() @Length(1, 100) name!: string;
  @IsString()
  @Matches(/^[a-zA-Z0-9][a-zA-Z0-9-]{2,79}$/)
  provisioningKey!: string;
  @IsString() @Length(1, 100) primaryContact!: string;
  @IsEmail() contactEmail!: string;
  @IsString() @Length(1, 30) phone!: string;
  @IsString() @Length(1, 100) branchName!: string;
  @IsString() @Length(1, 100) managerName!: string;
  @IsEmail() managerEmail!: string;
  @IsString() @Length(12, 128) managerPassword!: string;
}
export class LifecycleDto {
  @IsInt() @Min(1) version!: number;
  @IsString() @Length(0, 500) reason!: string;
}
