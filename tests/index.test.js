const { main } = require('../main');

jest.mock('dotenv');
jest.mock('../db/connect', () => ({
  connectionManager: {
    setSourceConnection: jest.fn(() => ({ model: jest.fn() })),
    setTargetConnection: jest.fn(() => ({ model: jest.fn() })),
    closeConnections: jest.fn(),
  },
}));
jest.mock('../models', () => ({ registerModels: jest.fn() }));
jest.mock('../migrator/migrate', () => ({
  migrateDocumentCascade: jest.fn(async () => 'newId'),
  migrateDocumentsByQuery: jest.fn(async () => ['id1', 'id2']),
}));

describe('main.js (main logic)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should exit with error if no args are provided', async () => {
    const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('exit');
    });
    const mockConsole = jest.spyOn(console, 'error').mockImplementation(() => {});
    process.argv = ['node', 'index.js'];
    try {
      await main();
    } catch (e) {
      expect(e.message).toBe('exit');
    }
    expect(mockConsole).toHaveBeenCalledWith(expect.stringContaining('Usage: node index.js'));
    mockExit.mockRestore();
    mockConsole.mockRestore();
  });

  it('should call migrateDocumentCascade if --model and --id are provided', async () => {
    process.argv = ['node', 'index.js', '--model=Example', '--id=123'];
    const mockLog = jest.spyOn(console, 'log').mockImplementation(() => {});
    const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('exit');
    });
    try {
      await main();
    } catch (e) {}
    const { migrateDocumentCascade } = require('../migrator/migrate');
    expect(migrateDocumentCascade).toHaveBeenCalledWith('Example', '123', expect.any(Map));
    mockLog.mockRestore();
    mockExit.mockRestore();
  });

  it('should call migrateDocumentsByQuery if --model and --query are provided', async () => {
    process.argv = ['node', 'index.js', '--model=Example', '--query="{\"name\":\"test\"}"'];
    const mockLog = jest.spyOn(console, 'log').mockImplementation(() => {});
    const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('exit');
    });
    try {
      await main();
    } catch (e) {}
    const { migrateDocumentsByQuery } = require('../migrator/migrate');
    expect(migrateDocumentsByQuery).toHaveBeenCalledWith(
      'Example',
      { name: 'test' },
      expect.any(Map)
    );
    mockLog.mockRestore();
    mockExit.mockRestore();
  });
});
