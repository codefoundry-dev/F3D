import { IsEmail } from 'class-validator';

export class RequestNewInvitationDto {
  @IsEmail()
  email!: string;
}
