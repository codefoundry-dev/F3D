import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface PlacePrediction {
  placePrediction?: {
    structuredFormat?: {
      mainText?: { text: string };
      secondaryText?: { text: string };
    };
  };
  queryPrediction?: {
    text?: { text: string };
  };
}

interface PlacesResponse {
  suggestions: PlacePrediction[];
}

@Injectable()
export class GoogleService {
  private readonly apiKey: string;
  private readonly placesUrl = 'https://places.googleapis.com/v1/places:autocomplete';

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('GOOGLE_PLACES_API_KEY', '');
  }

  async addressAutocomplete(
    input: string,
    country?: string,
    types?: string[],
    context?: string,
  ): Promise<string[]> {
    if (!this.apiKey || !input || input.trim().length < 2) {
      return [];
    }

    const defaultTypes = ['street_address', 'locality', 'route', 'sublocality'];
    const parts = [input, context, country].filter(Boolean);
    const body: Record<string, unknown> = {
      input: parts.join(', '),
      includedPrimaryTypes: types?.length ? types : defaultTypes,
    };

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(this.placesUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': this.apiKey,
          'X-Goog-FieldMask': [
            'suggestions.placePrediction.structuredFormat.mainText.text',
            'suggestions.placePrediction.structuredFormat.secondaryText.text',
            'suggestions.queryPrediction.text',
          ].join(','),
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) return [];

      const data = (await response.json()) as PlacesResponse;
      const items = Array.isArray(data.suggestions) ? data.suggestions : [];

      const results = items
        .map((s) => {
          const main = s.placePrediction?.structuredFormat?.mainText?.text;
          const secondary = s.placePrediction?.structuredFormat?.secondaryText?.text;
          if (!main) return s.queryPrediction?.text?.text;
          return secondary ? `${main}, ${secondary}` : main;
        })
        .filter((v): v is string => typeof v === 'string' && v.length > 0);

      return [...new Set(results)].slice(0, 10);
    } catch {
      return [];
    }
  }
}
