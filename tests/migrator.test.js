const { migrateDocumentCascade, migrateDocumentsByQuery } = require('../migrator/migrate');

describe('migrator logic', () => {
  it('should export migrateDocumentCascade and migrateDocumentsByQuery as functions', () => {
    expect(typeof migrateDocumentCascade).toBe('function');
    expect(typeof migrateDocumentsByQuery).toBe('function');
  });

  it('migrateDocumentCascade should return null if document not found', async () => {
    // Mock dependencies
    const mockConnection = {
      model: () => ({ findById: () => ({ lean: () => null }) }),
    };
    jest
      .spyOn(require('../db/connect').connectionManager, 'getSourceConnection')
      .mockReturnValue(mockConnection);
    jest
      .spyOn(require('../db/connect').connectionManager, 'getTargetConnection')
      .mockReturnValue(mockConnection);
    const result = await migrateDocumentCascade('Example', 'nonexistentId', new Map());
    expect(result).toBeNull();
  });
});
