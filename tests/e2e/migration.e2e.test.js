const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const { connectionManager } = require('../../db/connect');
const { migrateDocumentCascade } = require('../../migrator/migrate');

// Use the Authors and Books schemas for E2E testing
const AuthorSchema = require('../../models/schemas/Authors');
const BookSchema = require('../../models/schemas/Books');

describe('E2E Migration', () => {
  let sourceServer, targetServer, sourceUri, targetUri, sourceConn, targetConn;

  beforeAll(async () => {
    // Start two in-memory MongoDB servers
    sourceServer = await MongoMemoryServer.create();
    targetServer = await MongoMemoryServer.create();
    sourceUri = sourceServer.getUri();
    targetUri = targetServer.getUri();

    // Connect to both
    sourceConn = await mongoose.createConnection(sourceUri);
    targetConn = await mongoose.createConnection(targetUri);

    // Register Authors and Books models in both
    sourceConn.model('Authors', AuthorSchema);
    targetConn.model('Authors', AuthorSchema);
    sourceConn.model('Books', BookSchema);
    targetConn.model('Books', BookSchema);

    // Patch connectionManager for the migrator
    jest.spyOn(connectionManager, 'getSourceConnection').mockReturnValue(sourceConn);
    jest.spyOn(connectionManager, 'getTargetConnection').mockReturnValue(targetConn);
    jest.spyOn(connectionManager, 'setSourceConnection').mockReturnValue(sourceConn);
    jest.spyOn(connectionManager, 'setTargetConnection').mockReturnValue(targetConn);
  });

  afterAll(async () => {
    await sourceConn.close();
    await targetConn.close();
    await sourceServer.stop();
    await targetServer.stop();
  });

  beforeEach(async () => {
    // Clean DBs before each test
    await sourceConn.dropDatabase();
    await targetConn.dropDatabase();
  });

  it('should migrate a single Authors document', async () => {
    const AuthorSrc = sourceConn.model('Authors');
    const AuthorDst = targetConn.model('Authors');
    // Insert into source
    const doc = await AuthorSrc.create({ name: 'foo', email: 'bar@example.com' });
    const idMap = new Map();
    // Run migration
    const newId = await migrateDocumentCascade('Authors', doc._id, idMap);
    // Should have migrated
    expect(newId).toBeDefined();
    const migratedDoc = await AuthorDst.findById(newId).lean();
    expect(migratedDoc).toMatchObject({ name: 'foo', email: 'bar@example.com' });
  });

  it('should migrate a single Books document', async () => {
    const BookSrc = sourceConn.model('Books');
    const BookDst = targetConn.model('Books');
    const AuthorSrc = sourceConn.model('Authors');
    const AuthorDst = targetConn.model('Authors');
    // Insert into source
    const author = await AuthorSrc.create({ name: 'foo', email: 'bar@example.com' });
    const doc = await BookSrc.create({ title: 'foo', author: author._id });
    const idMap = new Map();
    // Run migration
    const newId = await migrateDocumentCascade('Books', doc._id, idMap);
    // Should have migrated
    expect(newId).toBeDefined();
    const migratedDoc = await BookDst.findById(newId).lean();
    expect(migratedDoc).toMatchObject({ title: 'foo' });
    // Check author was migrated and has correct ID mapping
    const migratedAuthorId = idMap.get(author._id.toString());
    expect(migratedAuthorId).toBeDefined();
    expect(migratedDoc.author.toString()).toBe(migratedAuthorId.toString());
    // Check author data
    const migratedAuthor = await AuthorDst.findById(migratedAuthorId).lean();
    expect(migratedAuthor).toMatchObject({ name: 'foo', email: 'bar@example.com' });
  });
});
