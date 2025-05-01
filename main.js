require('dotenv').config();
const { connectionManager } = require('./db/connect');
const { registerModels } = require('./models');
const { migrateDocumentCascade, migrateDocumentsByQuery } = require('./migrator/migrate');
const path = require('path');

async function main(modelName, rootId, query, config = null) {
  let sourceUri, targetUri;

  if (config) {
    // Programmatic usage
    sourceUri = config.originUrl;
    targetUri = config.destinationUrl;
  } else {
    // CLI usage
    const args = process.argv.slice(2);
    const modelArg = args.find((arg) => arg.startsWith('--model='));
    const idArg = args.find((arg) => arg.startsWith('--id='));
    const queryArg = args.find((arg) => arg.startsWith('--query='));

    if (!modelArg || (!idArg && !queryArg)) {
      console.error(
        'Usage: node index.js --model=ModelName --id=ObjectId [--query=\'{"key": "value"}\']'
      );
      process.exit(1);
    }

    modelName = modelArg.split('=')[1];
    rootId = idArg ? idArg.split('=')[1] : null;
    if (queryArg) {
      let raw = queryArg.split('=')[1];
      if (raw.startsWith('"') && raw.endsWith('"')) {
        raw = raw.slice(1, -1);
      }
      query = JSON.parse(raw);
    }

    sourceUri = process.env.SOURCE_URI || 'mongodb://localhost:27017/source_db';
    targetUri = process.env.TARGET_URI || 'mongodb://localhost:27018/target_db';
  }

  // Use the singleton for connections
  const sourceConnection = connectionManager.setSourceConnection(sourceUri);
  const targetConnection = connectionManager.setTargetConnection(targetUri);

  // Get the absolute path of the current working directory (client project)
  const clientProjectPath = process.cwd();

  // Register models from the configured path or default path
  const modelsPath = path.join(clientProjectPath, config ? config.schemasPath : 'models/schemas');

  registerModels(sourceConnection, config ? modelsPath : path.join(clientProjectPath, modelsPath));
  registerModels(targetConnection, config ? modelsPath : path.join(clientProjectPath, modelsPath));

  const idMap = new Map();
  if (rootId) {
    const newId = await migrateDocumentCascade(modelName, rootId, idMap);
    if (newId) {
      console.log(`Document migrated. New ID: ${newId}`);
    } else {
      console.log(`No document found with ID: ${rootId}`);
    }
  } else if (query) {
    console.log('This is the query:', query);
    const newIds = await migrateDocumentsByQuery(modelName, query, idMap);
    console.log('This is the new ids:', newIds);
  }
  console.log('This is the id map:', idMap);

  // Close connections using the singleton
  connectionManager.closeConnections();

  return idMap;
}

module.exports = { main };
