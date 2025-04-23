const { registerModels } = require('../models');

describe('registerModels', () => {
  it('should be a function', () => {
    expect(typeof registerModels).toBe('function');
  });

  it('should not throw when called with a mock connection', () => {
    const mockConnection = { model: jest.fn() };
    // Mock fs and path to simulate schema files
    jest.mock('fs', () => ({ readdirSync: () => ['Authors.js', 'Books.js'] }));
    jest.mock('path', () => ({
      join: jest.fn(() => '../models/schemas/Authors.js'),
      basename: jest.fn(() => 'Authors'),
    }));
    jest.mock('../models/schemas/Authors', () => ({}), { virtual: true });
    jest.mock('../models/schemas/Books', () => ({}), { virtual: true });
    expect(() => registerModels(mockConnection)).not.toThrow();
  });
});
