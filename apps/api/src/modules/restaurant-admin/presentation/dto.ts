import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';
export class PageDto {
  @Type(() => Number) @IsInt() @Min(1) page = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 20;
  @IsOptional() @IsString() @Length(0, 100) q?: string;
}
export class OrderPageDto extends PageDto {
  @IsOptional() @IsIn(['OPEN', 'COMPLETED', 'CANCELLED']) status?: string;
}
export class CategoryDto {
  @IsString() @Length(1, 80) name!: string;
  @IsBoolean() active!: boolean;
  @IsInt() @Min(0) @Max(10000) displayOrder!: number;
  @IsOptional() @IsInt() @Min(1) version?: number;
}
export class TableDto {
  @IsInt() @Min(1) @Max(9999) number!: number;
  @IsInt() @Min(1) @Max(100) seats!: number;
  @IsBoolean() active!: boolean;
  @IsOptional() @IsInt() @Min(1) version?: number;
}
export class SettingsDto {
  @IsString() @Length(1, 100) name!: string;
  @IsString() @Length(1, 100) branchName!: string;
  @IsString() @Length(0, 100) primaryContact!: string;
  @IsString() @Length(0, 150) contactEmail!: string;
  @IsString() @Length(0, 30) phone!: string;
  @IsString() @Length(0, 500) address!: string;
  @IsIn(['Asia/Tehran']) timezone!: string;
  @IsIn(['TOMAN']) currencyPresentation!: string;
  @IsInt() @Min(1) version!: number;
}
