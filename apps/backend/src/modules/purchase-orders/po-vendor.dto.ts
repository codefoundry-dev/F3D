import { IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';

export class VendorAcceptPoDto {
  @IsOptional()
  @IsNumber()
  paymentTermsDays?: number;

  @IsOptional()
  @IsUUID()
  warehouseLocationId?: string;
}

export class VendorDeclinePoDto {
  @IsOptional()
  @IsString()
  reason?: string;
}
