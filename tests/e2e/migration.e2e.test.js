const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const { connectionManager } = require('../../db/connect');
const { registerModels } = require('../../models');
const { migrateDocumentCascade } = require('../../migrator/migrate');

// Use the Example schema for E2E testing
const exampleSchema = require('../../models/schemas/Example');

describe('E2E Migration', () => {
  let sourceServer, targetServer, sourceUri, targetUri, sourceConn, targetConn;

  beforeAll(async () => {
    // Start two in-memory MongoDB servers
    sourceServer = await MongoMemoryServer.create();
    targetServer = await MongoMemoryServer.create();
    sourceUri = sourceServer.getUri();
    targetUri = targetServer.getUri();

    // Connect to both
    sourceConn = await mongoose.createConnection(sourceUri, { useNewUrlParser: true, useUnifiedTopology: true });
    targetConn = await mongoose.createConnection(targetUri, { useNewUrlParser: true, useUnifiedTopology: true });

    // Register Example model in both
    sourceConn.model('Example', exampleSchema);
    targetConn.model('Example', exampleSchema);

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

  it('should migrate a single Example document', async () => {
    const ExampleSrc = sourceConn.model('Example');
    const ExampleDst = targetConn.model('Example');
    // Insert into source
    const doc = await ExampleSrc.create({ name: 'foo', alias: 'bar' });
    const idMap = new Map();
    // Run migration
    const newId = await migrateDocumentCascade('Example', doc._id, idMap);
    // Should have migrated
    expect(newId).toBeDefined();
    const migratedDoc = await ExampleDst.findById(newId).lean();
    expect(migratedDoc).toMatchObject({ name: 'foo', alias: 'bar' });
  });
});
