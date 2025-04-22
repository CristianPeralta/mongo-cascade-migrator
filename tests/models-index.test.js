const { registerModels } = require('../models');

describe('registerModels', () => {
  it('should be a function', () => {
    expect(typeof registerModels).toBe('function');
  });

  it('should not throw when called with a mock connection', () => {
    const mockConnection = { model: jest.fn() };
    // Mock fs and path to simulate schema files
    jest.mock('fs', () => ({ readdirSync: () => ['Example.js'] }));
    jest.mock('path', () => ({
      join: jest.fn(() => '../models/schemas/Example.js'),
      basename: jest.fn(() => 'Example'),
    }));
    jest.mock('../models/schemas/Example', () => ({}), { virtual: true });
    expect(() => registerModels(mockConnection)).not.toThrow();
  });
});
