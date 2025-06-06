const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const { connectionManager } = require('../../db/connect');
const { migrateDocumentCascade, migrateDocumentsByQuery } = require('../../migrator/migrate');

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

  it('should migrate a single Books document with a nested author', async () => {
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

  it('should migrate multiple Author documents', async () => {
    const AuthorSrc = sourceConn.model('Authors');
    const AuthorDst = targetConn.model('Authors');
    // Insert into source
    await AuthorSrc.create({ name: 'foo', email: 'bar@example.com' });
    await AuthorSrc.create({ name: 'baz', email: 'qux@example.com' });
    const idMap = new Map();
    // Run migration
    const newIds = await migrateDocumentsByQuery('Authors', {}, idMap);
    // Should have migrated
    expect(newIds).toBeDefined();
    expect(newIds.length).toBe(2);
    const migratedDoc1 = await AuthorDst.findById(newIds[0]).lean();
    expect(migratedDoc1).toMatchObject({ name: 'foo', email: 'bar@example.com' });
    const migratedDoc2 = await AuthorDst.findById(newIds[1]).lean();
    expect(migratedDoc2).toMatchObject({ name: 'baz', email: 'qux@example.com' });
  });

  it('should migrate multiple Books documents', async () => {
    const BookSrc = sourceConn.model('Books');
    const BookDst = targetConn.model('Books');
    const AuthorSrc = sourceConn.model('Authors');
    // Insert into source
    const authorSrc1Doc = await AuthorSrc.create({ name: 'foo', email: 'bar@example.com' });
    const authorSrc2Doc = await AuthorSrc.create({ name: 'baz', email: 'qux@example.com' });
    await BookSrc.create({ title: 'foo', author: authorSrc1Doc._id });
    await BookSrc.create({ title: 'baz', author: authorSrc2Doc._id });
    const idMap = new Map();
    // Run migration
    const newIds = await migrateDocumentsByQuery('Books', {}, idMap);
    // Should have migrated
    expect(newIds).toBeDefined();
    expect(newIds.length).toBe(2);
    const migratedDoc1 = await BookDst.findById(newIds[0]).lean();
    expect(migratedDoc1).toMatchObject({ title: 'foo' });
    const migratedDoc2 = await BookDst.findById(newIds[1]).lean();
    expect(migratedDoc2).toMatchObject({ title: 'baz' });
    // Check author was migrated and has correct ID mapping
    const migratedAuthorId1 = idMap.get(authorSrc1Doc._id.toString());
    expect(migratedAuthorId1).toBeDefined();
    expect(migratedDoc1.author.toString()).toBe(migratedAuthorId1.toString());
    const migratedAuthorId2 = idMap.get(authorSrc2Doc._id.toString());
    expect(migratedAuthorId2).toBeDefined();
    expect(migratedDoc2.author.toString()).toBe(migratedAuthorId2.toString());
  });
});
