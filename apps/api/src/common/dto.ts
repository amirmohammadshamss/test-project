import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
} from 'class-validator';
export class LoginDto {
  @IsEmail() email!: string;
  @IsString() @Length(8, 128) password!: string;
}
export class CreateOrderDto {
  @IsUUID() tableId!: string;
}
export class AddItemDto {
  @IsUUID() menuItemId!: string;
  @IsInt() @Min(1) @Max(99) quantity!: number;
}
export class UpdateItemDto {
  @IsInt() @Min(1) version!: number;
  @IsOptional() @IsInt() @Min(1) @Max(99) quantity?: number;
  @IsOptional() @IsIn(['PENDING', 'PREPARING', 'READY', 'SERVED']) status?:
    'PENDING' | 'PREPARING' | 'READY' | 'SERVED';
}
export class CompleteDto {
  @IsInt() @Min(1) version!: number;
}
export class MenuDto {
  @IsString() @Length(1, 100) name!: string;
  @IsString() @Length(0, 1000) description!: string;
  @IsUUID() categoryId!: string;
  @IsInt() @Min(1) @Max(100000000) priceToman!: number;
  @IsBoolean() active!: boolean;
  @IsBoolean() available!: boolean;
}
export class DraftDto {
  @IsString() @Length(5, 2000) input!: string;
}
export class ApproveDto {
  @IsString() @Length(1, 100) name!: string;
  @IsString() @Length(0, 1000) description!: string;
  @IsString() @Length(1, 80) category!: string;
  @IsInt() @Min(1) @Max(100000000) priceToman!: number;
}
