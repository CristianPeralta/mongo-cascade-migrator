require('dotenv').config();
const { connectionManager } = require('./db/connect');
const { registerModels } = require('./models');
const { migrateDocumentCascade, migrateDocumentsByQuery } = require('./migrator/migrate');

const SOURCE_URI = process.env.SOURCE_URI || 'mongodb://localhost:27017/source_db';
const TARGET_URI = process.env.TARGET_URI || 'mongodb://localhost:27018/target_db';

async function main() {
  const args = process.argv.slice(2);
  const modelArg = args.find((arg) => arg.startsWith('--model='));
  const idArg = args.find((arg) => arg.startsWith('--id='));
  const queryArg = args.find((arg) => arg.startsWith('--query='));

  if (!modelArg || (!idArg && !queryArg)) {
    console.error(
      '❌ Usage: node index.js --model=ModelName --id=ObjectId [--query=\'{"key": "value"}\']'
    );
    process.exit(1);
  }

  const modelName = modelArg.split('=')[1];
  const rootId = idArg ? idArg.split('=')[1] : null;
  const query = queryArg ? JSON.parse(queryArg.split('=')[1]) : null;

  // Use the singleton for connections
  const sourceConnection = connectionManager.setSourceConnection(SOURCE_URI);
  const targetConnection = connectionManager.setTargetConnection(TARGET_URI);

  registerModels(sourceConnection);
  registerModels(targetConnection);

  console.log('This is the model name:', modelName);
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
}

main().catch((error) => {
  console.error('Error in main function:', error);
  process.exit(1);
});
