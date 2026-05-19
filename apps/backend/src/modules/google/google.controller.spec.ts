import { GoogleController } from './google.controller';
import { GoogleService } from './google.service';

describe('GoogleController', () => {
  let controller: GoogleController;
  let googleService: jest.Mocked<GoogleService>;

  beforeEach(() => {
    googleService = {
      addressAutocomplete: jest.fn(),
    } as unknown as jest.Mocked<GoogleService>;

    controller = new GoogleController(googleService);
  });

  describe('addressAutocomplete', () => {
    it('should delegate to GoogleService with input and country', async () => {
      const suggestions = ['123 Main St, Sydney', '456 High St, Melbourne'];
      googleService.addressAutocomplete.mockResolvedValue(suggestions);

      const result = await controller.addressAutocomplete({
        input: 'Sydney',
        country: 'Australia',
      });

      expect(googleService.addressAutocomplete).toHaveBeenCalledWith(
        'Sydney',
        'Australia',
        undefined,
        undefined,
      );
      expect(result).toEqual(suggestions);
    });

    it('should pass undefined country when not provided', async () => {
      googleService.addressAutocomplete.mockResolvedValue([]);

      await controller.addressAutocomplete({ input: 'test' });

      expect(googleService.addressAutocomplete).toHaveBeenCalledWith(
        'test',
        undefined,
        undefined,
        undefined,
      );
    });

    it('should pass context to service', async () => {
      googleService.addressAutocomplete.mockResolvedValue(['123 Main St, Sydney']);

      await controller.addressAutocomplete({
        input: 'Main',
        types: ['street_address'],
        context: 'Sydney',
      });

      expect(googleService.addressAutocomplete).toHaveBeenCalledWith(
        'Main',
        undefined,
        ['street_address'],
        'Sydney',
      );
    });
  });
});
