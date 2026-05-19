import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

export class ChangeLineItemDto {
  @IsOptional()
  @IsUUID()
  lineItemId?: string;

  @IsString()
  action!: 'update' | 'add' | 'remove';

  @IsOptional()
  unitPrice?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  quantity?: number;

  @IsOptional()
  @IsString()
  uom?: string;

  @IsOptional()
  @IsString()
  itemReference?: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class CreateBulkOrderChangeRequestDto {
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChangeLineItemDto)
  lineItems?: ChangeLineItemDto[];

  @IsOptional()
  @IsString()
  message?: string;
}

export class RejectChangeRequestDto {
  @IsOptional()
  @IsString()
  reason?: string;
}
