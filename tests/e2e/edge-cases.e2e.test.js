const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const { connectionManager } = require('../../db/connect');
const { migrateDocumentCascade } = require('../../migrator/migrate');

const { Schema } = require('mongoose');

const PersonsSchema = new Schema(
  {
    name: String,
    email: { type: String, unique: true },
    partner: { type: Schema.Types.ObjectId, ref: 'Persons' },
  },
  { timestamps: true }
);

describe('E2E Migration - Edge Cases', () => {
  let sourceServer, targetServer, sourceUri, targetUri, sourceConn, targetConn;

  beforeAll(async () => {
    sourceServer = await MongoMemoryServer.create();
    targetServer = await MongoMemoryServer.create();
    sourceUri = sourceServer.getUri();
    targetUri = targetServer.getUri();

    sourceConn = await mongoose.createConnection(sourceUri);
    targetConn = await mongoose.createConnection(targetUri);

    // Register Persons model in both
    sourceConn.model('Persons', PersonsSchema);
    targetConn.model('Persons', PersonsSchema);

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
    // Clean DBs and recreate indexes before each test
    await sourceConn.dropDatabase();
    await targetConn.dropDatabase();
    await sourceConn.model('Persons').syncIndexes();
    await targetConn.model('Persons').syncIndexes();
  });

  it('should migrate a self-referencing document without a partner', async () => {
    const PersonSrc = sourceConn.model('Persons');
    const PersonDst = targetConn.model('Persons');
    const alice = await PersonSrc.create({ name: 'alice', email: 'alice@example.com' });
    const idMap = new Map();
    const newId = await migrateDocumentCascade('Persons', alice._id, idMap);
    expect(newId).toBeDefined();
    const migratedAlice = await PersonDst.findById(newId).lean();
    expect(migratedAlice).toMatchObject({ name: 'alice', email: 'alice@example.com' });
  });

  it('should cascade-migrate a self-referencing document with a unidirectional partner reference', async () => {
    const PersonSrc = sourceConn.model('Persons');
    const PersonDst = targetConn.model('Persons');
    const bob = await PersonSrc.create({ name: 'bob', email: 'bob@example.com' });
    const alice = await PersonSrc.create({ name: 'alice', email: 'alice@example.com', partner: bob._id });
    const idMap = new Map();
    const newId = await migrateDocumentCascade('Persons', alice._id, idMap);
    expect(newId).toBeDefined();
    const migratedAlice = await PersonDst.findById(newId).lean();
    expect(migratedAlice).toMatchObject({ name: 'alice', email: 'alice@example.com' });
    // Check bob was cascade-migrated with correct ID mapping
    const migratedBobId = idMap.get(bob._id.toString());
    expect(migratedBobId).toBeDefined();
    expect(migratedAlice.partner.toString()).toBe(migratedBobId.toString());
    const migratedBob = await PersonDst.findById(migratedBobId).lean();
    expect(migratedBob).toMatchObject({ name: 'bob', email: 'bob@example.com' });
  });

  it('should handle circular references without infinite recursion (A → B → A)', async () => {
    const PersonSrc = sourceConn.model('Persons');
    const PersonDst = targetConn.model('Persons');
    // Set up cycle: alice.partner = bob, bob.partner = alice
    const bob = await PersonSrc.create({ name: 'bob', email: 'bob@example.com' });
    const alice = await PersonSrc.create({ name: 'alice', email: 'alice@example.com', partner: bob._id });
    await PersonSrc.findByIdAndUpdate(bob._id, { partner: alice._id });
    const idMap = new Map();
    const newId = await migrateDocumentCascade('Persons', alice._id, idMap);
    expect(newId).toBeDefined();
    const migratedAlice = await PersonDst.findById(newId).lean();
    expect(migratedAlice).toMatchObject({ name: 'alice', email: 'alice@example.com' });
    // Check bob was migrated with correct ID mapping
    const migratedBobId = idMap.get(bob._id.toString());
    expect(migratedBobId).toBeDefined();
    expect(migratedAlice.partner.toString()).toBe(migratedBobId.toString());
    const migratedBob = await PersonDst.findById(migratedBobId).lean();
    expect(migratedBob).toMatchObject({ name: 'bob', email: 'bob@example.com' });
    // Check the cycle is preserved: bob.partner → alice, alice.partner → bob
    expect(migratedBob.partner.toString()).toBe(newId.toString());
    expect(migratedAlice.partner.toString()).toBe(migratedBobId.toString());
  });

  it('should reuse existing target document when unique field conflict is detected (error 11000)', async () => {
    const PersonSrc = sourceConn.model('Persons');
    const PersonDst = targetConn.model('Persons');
    // Pre-insert in target to trigger duplicate key conflict during migration
    await PersonDst.create({ name: 'alice', email: 'alice@example.com' });
    const alice = await PersonSrc.create({ name: 'alice', email: 'alice@example.com' });
    const idMap = new Map();
    const newId = await migrateDocumentCascade('Persons', alice._id, idMap);
    expect(newId).toBeDefined();
    // Should reuse the existing target doc, not create a duplicate
    const count = await PersonDst.countDocuments({ email: 'alice@example.com' });
    expect(count).toBe(1);
    const existingDoc = await PersonDst.findOne({ email: 'alice@example.com' }).lean();
    expect(existingDoc._id.toString()).toBe(newId.toString());
  });
});
