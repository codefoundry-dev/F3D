import { PaginatedResponseDto, PaginationMeta, paginatedResponse } from './api-response.dto';

describe('paginatedResponse', () => {
  it('should create a paginated response with correct structure', () => {
    const data = [{ id: 1 }, { id: 2 }];

    const result = paginatedResponse(data, 1, 25, 50);

    expect(result).toBeInstanceOf(PaginatedResponseDto);
    expect(result.success).toBe(true);
    expect(result.data).toEqual(data);
    expect(result.meta).toEqual({
      page: 1,
      limit: 25,
      total: 50,
      totalPages: 2,
    });
  });

  it('should calculate totalPages correctly (rounding up)', () => {
    const result = paginatedResponse([], 1, 10, 25);

    expect(result.meta.totalPages).toBe(3); // ceil(25/10) = 3
  });

  it('should handle zero total items', () => {
    const result = paginatedResponse([], 1, 10, 0);

    expect(result.meta.totalPages).toBe(0);
    expect(result.data).toEqual([]);
  });

  it('should handle total equal to limit', () => {
    const result = paginatedResponse([1, 2, 3], 1, 3, 3);

    expect(result.meta.totalPages).toBe(1);
  });

  it('should handle single item with limit of 1', () => {
    const result = paginatedResponse(['item'], 1, 1, 5);

    expect(result.meta.totalPages).toBe(5);
    expect(result.meta.page).toBe(1);
    expect(result.meta.limit).toBe(1);
    expect(result.meta.total).toBe(5);
  });

  it('should preserve the original data array reference', () => {
    const data = [{ id: 1 }, { id: 2 }];
    const result = paginatedResponse(data, 1, 10, 2);

    expect(result.data).toBe(data);
  });

  it('should handle large page numbers', () => {
    const result = paginatedResponse([], 100, 25, 142);

    expect(result.meta.page).toBe(100);
    expect(result.meta.totalPages).toBe(6); // ceil(142/25) = 6
  });
});

describe('PaginationMeta', () => {
  it('should be instantiable', () => {
    const meta = new PaginationMeta();
    meta.page = 1;
    meta.limit = 25;
    meta.total = 100;
    meta.totalPages = 4;

    expect(meta.page).toBe(1);
    expect(meta.limit).toBe(25);
    expect(meta.total).toBe(100);
    expect(meta.totalPages).toBe(4);
  });

  it('should support optional unreadCount', () => {
    const meta = new PaginationMeta();
    meta.page = 1;
    meta.limit = 10;
    meta.total = 50;
    meta.totalPages = 5;
    meta.unreadCount = 3;

    expect(meta.unreadCount).toBe(3);
  });
});
