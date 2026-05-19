import { Transform } from 'class-transformer';
import { IsArray, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export enum MessageContextTypeDto {
  RFQ = 'RFQ',
  PURCHASE_ORDER = 'PURCHASE_ORDER',
  MATERIAL_REQUEST = 'MATERIAL_REQUEST',
  WAREHOUSE_RELEASE_REQUEST = 'WAREHOUSE_RELEASE_REQUEST',
}

export class CreateThreadDto {
  @IsEnum(MessageContextTypeDto)
  contextType!: MessageContextTypeDto;

  @IsUUID()
  contextId!: string;

  @IsArray()
  @IsUUID('4', { each: true })
  participantIds!: string[];
}

export class SendMessageDto {
  @IsString()
  @IsNotEmpty()
  content!: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  attachmentIds?: string[];
}

export class ListThreadsQueryDto {
  @IsOptional()
  @Transform(({ value }: { value: string }) => parseInt(value))
  page?: number = 1;

  @IsOptional()
  @Transform(({ value }: { value: string }) => parseInt(value))
  limit?: number = 25;

  @IsOptional()
  @IsEnum(MessageContextTypeDto)
  contextType?: MessageContextTypeDto;

  @IsOptional()
  @IsUUID()
  contextId?: string;
}

export class ListMessagesQueryDto {
  @IsOptional()
  @Transform(({ value }: { value: string }) => parseInt(value))
  page?: number = 1;

  @IsOptional()
  @Transform(({ value }: { value: string }) => parseInt(value))
  limit?: number = 25;
}
