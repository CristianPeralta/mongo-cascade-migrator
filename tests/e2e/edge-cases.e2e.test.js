const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const { connectionManager } = require('../../db/connect');
const { migrateDocumentCascade } = require('../../migrator/migrate');

// New models
const { Schema } = require('mongoose');

const PersonsSchema = new Schema(
  {
    name: String,
    email: String,
    partner: { type: Schema.Types.ObjectId, ref: 'Persons' },
  },
  { timestamps: true }
);

describe('E2E Migration - Edge Cases', () => {
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

    // Register Persons model in both
    sourceConn.model('Persons', PersonsSchema);
    targetConn.model('Persons', PersonsSchema);

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

  it('should migrate a self-referencing document without a partner', async () => {
    const PersonSrc = sourceConn.model('Persons');
    const PersonDst = targetConn.model('Persons');
    // Insert into source
    const doc = await PersonSrc.create({ name: 'foo', email: 'bar@example.com' });
    const idMap = new Map();
    // Run migration
    const newId = await migrateDocumentCascade('Persons', doc._id, idMap);
    // Should have migrated
    expect(newId).toBeDefined();
    const migratedDoc = await PersonDst.findById(newId).lean();
    expect(migratedDoc).toMatchObject({ name: 'foo', email: 'bar@example.com' });
  });

  it('should cascade-migrate a self-referencing document with a unidirectional partner reference', async () => {
    const PersonSrc = sourceConn.model('Persons');
    const PersonDst = targetConn.model('Persons');
    const PartnerSrc = sourceConn.model('Persons');
    const PartnerDst = targetConn.model('Persons');
    // Insert into source
    const partner = await PartnerSrc.create({ name: 'foo', email: 'bar@example.com' });
    const doc = await PersonSrc.create({
      name: 'foo',
      email: 'bar@example.com',
      partner: partner._id,
    });
    const idMap = new Map();
    // Run migration
    const newId = await migrateDocumentCascade('Persons', doc._id, idMap);
    // Should have migrated
    expect(newId).toBeDefined();
    const migratedDoc = await PersonDst.findById(newId).lean();
    expect(migratedDoc).toMatchObject({ name: 'foo', email: 'bar@example.com' });
    // Check partner was migrated and has correct ID mapping
    const migratedPartnerId = idMap.get(partner._id.toString());
    expect(migratedPartnerId).toBeDefined();
    expect(migratedDoc.partner.toString()).toBe(migratedPartnerId.toString());
    // Check partner data
    const migratedPartner = await PartnerDst.findById(migratedPartnerId).lean();
    expect(migratedPartner).toMatchObject({ name: 'foo', email: 'bar@example.com' });
  });

  it('should handle circular references without infinite recursion (A → B → A)', async () => {
    const PersonSrc = sourceConn.model('Persons');
    const PersonDst = targetConn.model('Persons');
    // Insert into source
    const partner = await PersonSrc.create({ name: 'foo', email: 'bar@example.com' });
    const personA = await PersonSrc.create({
      name: 'foo',
      email: 'bar@example.com',
      partner: partner._id,
    });
    // update partner to point to personA
    await PersonSrc.findByIdAndUpdate(partner._id, { partner: personA._id });
    const idMap = new Map();
    // Run migration
    const newId = await migrateDocumentCascade('Persons', personA._id, idMap);
    // Should have migrated
    expect(newId).toBeDefined();
    const migratedDoc = await PersonDst.findById(newId).lean();
    expect(migratedDoc).toMatchObject({ name: 'foo', email: 'bar@example.com' });
    // Check partner was migrated and has correct ID mapping
    const migratedPartnerId = idMap.get(partner._id.toString());
    expect(migratedPartnerId).toBeDefined();
    expect(migratedDoc.partner.toString()).toBe(migratedPartnerId.toString());
    // Check partner data
    const migratedPartner = await PersonDst.findById(migratedPartnerId).lean();
    expect(migratedPartner).toMatchObject({ name: 'foo', email: 'bar@example.com' });
    // Check that partner points to personA
    expect(migratedPartner.partner.toString()).toBe(newId.toString());
    // Check that personA points to partner
    expect(migratedDoc.partner.toString()).toBe(migratedPartnerId.toString());
  });
});
