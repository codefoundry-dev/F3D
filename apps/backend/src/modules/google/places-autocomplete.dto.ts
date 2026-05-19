import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional, IsArray } from 'class-validator';

export class PlacesAutocompleteDto {
  @ApiProperty({ description: 'Search input text', example: 'Sydney' })
  @IsString()
  @IsNotEmpty()
  input!: string;

  @ApiPropertyOptional({
    description: 'Country hint for better results',
    example: 'Australia',
  })
  @IsString()
  @IsOptional()
  country?: string;

  @ApiPropertyOptional({
    description: 'Place types to filter results (e.g. country, locality, street_address)',
    example: ['country'],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  types?: string[];

  @ApiPropertyOptional({
    description: 'Context hint to narrow results (e.g. city name when searching addresses)',
    example: 'Sydney',
  })
  @IsString()
  @IsOptional()
  context?: string;
}
