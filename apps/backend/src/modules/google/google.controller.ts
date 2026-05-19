import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

import { GoogleService } from './google.service';
import { PlacesAutocompleteDto } from './places-autocomplete.dto';

@ApiTags('google')
@ApiBearerAuth()
@Controller('google')
export class GoogleController {
  constructor(private readonly googleService: GoogleService) {}

  @Post('places/addresses')
  @ApiOperation({ summary: 'Get address autocomplete suggestions' })
  async addressAutocomplete(@Body() body: PlacesAutocompleteDto) {
    return this.googleService.addressAutocomplete(
      body.input,
      body.country,
      body.types,
      body.context,
    );
  }
}
