import { Transform } from 'class-transformer';
import { IsEnum, IsIn, IsOptional } from 'class-validator';

export enum NotificationFilter {
  ALL = 'all',
  UNREAD = 'unread',
}

export class ListNotificationsQueryDto {
  @IsOptional()
  @Transform(({ value }: { value: string }) => parseInt(value))
  page?: number = 1;

  @IsOptional()
  @Transform(({ value }: { value: string }) => parseInt(value))
  limit?: number = 20;

  @IsOptional()
  @IsIn([NotificationFilter.ALL, NotificationFilter.UNREAD])
  @IsEnum(NotificationFilter)
  filter?: NotificationFilter = NotificationFilter.ALL;
}
