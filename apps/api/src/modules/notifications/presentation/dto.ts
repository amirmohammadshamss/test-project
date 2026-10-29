import { Type } from 'class-transformer';
import {
  IsInt,
  Min,
  Max,
  IsOptional,
  IsIn,
  IsBoolean,
  IsArray,
  ArrayMaxSize,
  ArrayUnique,
  IsString,
  Length,
  ValidateNested,
  Matches,
} from 'class-validator';
import {
  notificationTypes,
  NoticeType,
} from '../../../../../../packages/notifications/src/domain';
export class InboxDto {
  @Type(() => Number) @IsInt() @Min(1) page = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 20;
  @IsOptional() @IsIn(['true', 'false']) unread?: string;
}
export class PreferencesDto {
  @IsBoolean() pushEnabled!: boolean;
  @IsBoolean() soundEnabled!: boolean;
  @IsBoolean() includeLow!: boolean;
  @IsArray()
  @ArrayMaxSize(8)
  @ArrayUnique()
  @IsIn(notificationTypes, { each: true })
  categories!: NoticeType[];
}
export class PushKeysDto {
  @IsString() @Length(20, 100) @Matches(/^[a-zA-Z0-9_-]+$/) p256dh!: string;
  @IsString() @Length(20, 32) @Matches(/^[a-zA-Z0-9_-]+$/) auth!: string;
}
export class PushDto {
  @IsString() @Length(1, 2048) endpoint!: string;
  @ValidateNested() @Type(() => PushKeysDto) keys!: PushKeysDto;
  @IsString() @Length(1, 80) deviceLabel!: string;
}
