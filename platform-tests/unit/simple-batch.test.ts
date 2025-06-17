// Simple test to verify Jest setup works
describe('Simple Jest Setup Test', () => {
  test('should run basic assertions', () => {
    expect(2 + 2).toBe(4);
    expect('hello').toBe('hello');
    expect([1, 2, 3]).toHaveLength(3);
  });

  test('should handle async operations', async () => {
    const result = await Promise.resolve('async result');
    expect(result).toBe('async result');
  });

  test('should work with mocks', () => {
    const mockFn = jest.fn();
    mockFn('test');
    expect(mockFn).toHaveBeenCalledWith('test');
  });
});