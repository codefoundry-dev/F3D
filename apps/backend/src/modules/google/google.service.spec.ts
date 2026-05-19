import { ConfigService } from '@nestjs/config';

import { GoogleService } from './google.service';

describe('GoogleService', () => {
  let service: GoogleService;
  let configService: jest.Mocked<ConfigService>;
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  function createService(apiKey = 'test-api-key'): GoogleService {
    configService = {
      get: jest.fn((key: string, defaultValue?: string) => {
        if (key === 'GOOGLE_PLACES_API_KEY') return apiKey;
        return defaultValue;
      }),
    } as unknown as jest.Mocked<ConfigService>;

    return new GoogleService(configService);
  }

  describe('when API key is not configured', () => {
    it('should return empty array', async () => {
      service = createService('');

      const result = await service.addressAutocomplete('Sydney');

      expect(result).toEqual([]);
    });
  });

  describe('when input is too short', () => {
    it('should return empty array for empty input', async () => {
      service = createService();

      const result = await service.addressAutocomplete('');

      expect(result).toEqual([]);
    });

    it('should return empty array for single character', async () => {
      service = createService();

      const result = await service.addressAutocomplete('a');

      expect(result).toEqual([]);
    });
  });

  describe('successful API response', () => {
    it('should return formatted addresses from place predictions', async () => {
      service = createService();

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            suggestions: [
              {
                placePrediction: {
                  structuredFormat: {
                    mainText: { text: '123 Main St' },
                    secondaryText: { text: 'Sydney NSW' },
                  },
                },
              },
              {
                placePrediction: {
                  structuredFormat: {
                    mainText: { text: '456 High St' },
                  },
                },
              },
            ],
          }),
      });

      const result = await service.addressAutocomplete('Main St');

      expect(result).toEqual(['123 Main St, Sydney NSW', '456 High St']);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://places.googleapis.com/v1/places:autocomplete',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'X-Goog-Api-Key': 'test-api-key',
          }),
        }),
      );
    });

    it('should fall back to queryPrediction when placePrediction has no mainText', async () => {
      service = createService();

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            suggestions: [
              {
                queryPrediction: { text: { text: 'Sydney, Australia' } },
              },
            ],
          }),
      });

      const result = await service.addressAutocomplete('Sydney');

      expect(result).toEqual(['Sydney, Australia']);
    });

    it('should deduplicate results', async () => {
      service = createService();

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            suggestions: [
              {
                placePrediction: {
                  structuredFormat: {
                    mainText: { text: 'Same St' },
                    secondaryText: { text: 'City' },
                  },
                },
              },
              {
                placePrediction: {
                  structuredFormat: {
                    mainText: { text: 'Same St' },
                    secondaryText: { text: 'City' },
                  },
                },
              },
            ],
          }),
      });

      const result = await service.addressAutocomplete('Same');

      expect(result).toEqual(['Same St, City']);
    });

    it('should limit results to 10', async () => {
      service = createService();

      const suggestions = Array.from({ length: 15 }, (_, i) => ({
        placePrediction: {
          structuredFormat: { mainText: { text: `Address ${i}` } },
        },
      }));

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ suggestions }),
      });

      const result = await service.addressAutocomplete('Address');

      expect(result).toHaveLength(10);
    });

    it('should append country to input when provided', async () => {
      service = createService();

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ suggestions: [] }),
      });

      await service.addressAutocomplete('Sydney', 'Australia');

      const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
      expect(body.input).toBe('Sydney, Australia');
    });

    it('should append context and country to input', async () => {
      service = createService();

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ suggestions: [] }),
      });

      await service.addressAutocomplete('Main St', 'Australia', undefined, 'Sydney');

      const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
      expect(body.input).toBe('Main St, Sydney, Australia');
    });

    it('should append only context when no country', async () => {
      service = createService();

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ suggestions: [] }),
      });

      await service.addressAutocomplete('Main St', undefined, undefined, 'Sydney');

      const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
      expect(body.input).toBe('Main St, Sydney');
    });

    it('should use custom types when provided', async () => {
      service = createService();

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ suggestions: [] }),
      });

      await service.addressAutocomplete('Sydney', undefined, ['geocode', 'establishment']);

      const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
      expect(body.includedPrimaryTypes).toEqual(['geocode', 'establishment']);
    });

    it('should handle non-array suggestions gracefully', async () => {
      service = createService();

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ suggestions: 'not-an-array' }),
      });

      const result = await service.addressAutocomplete('Sydney');

      expect(result).toEqual([]);
    });
  });

  describe('API error handling', () => {
    it('should return empty array when API returns non-ok response', async () => {
      service = createService();

      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
      });

      const result = await service.addressAutocomplete('Sydney');

      expect(result).toEqual([]);
    });

    it('should return empty array when fetch throws (network error)', async () => {
      service = createService();

      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      const result = await service.addressAutocomplete('Sydney');

      expect(result).toEqual([]);
    });

    it('should return empty array on abort/timeout', async () => {
      service = createService();

      const abortError = new DOMException('The operation was aborted.', 'AbortError');
      global.fetch = jest.fn().mockRejectedValue(abortError);

      const result = await service.addressAutocomplete('Sydney');

      expect(result).toEqual([]);
    });
  });
});
