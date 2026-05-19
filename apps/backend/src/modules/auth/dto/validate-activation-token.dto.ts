import { IsNotEmpty, IsString } from 'class-validator';

export class ValidateActivationTokenDto {
  @IsString()
  @IsNotEmpty()
  token!: string;
}
