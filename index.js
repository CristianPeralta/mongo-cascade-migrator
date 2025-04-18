require('dotenv').config();
const { connectionManager } = require('./db/connect');
const { registerModels } = require('./models');
const mongoose = require('mongoose');

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
  }

  // Close connections using the singleton
  connectionManager.closeConnections();
}

const migrateDocumentCascade = async (modelName, rootId, idMap) => {
  console.log('---------------------------------------------------------');
  console.log('This is the model name:', modelName);
  console.log('This is the root Id:', rootId);
  console.log('This is the id map:', idMap);

  // Get connections from the singleton
  const sourceConnection = connectionManager.getSourceConnection();
  const targetConnection = connectionManager.getTargetConnection();

  const SourceModel = sourceConnection.model(modelName);
  const originalDoc = await SourceModel.findById(rootId).lean();
  if (!originalDoc) {
    console.error('Original document not found');
    return null;
  }
  const newId = new mongoose.Types.ObjectId();
  idMap.set(rootId, newId);
  const clonedDoc = { ...originalDoc, _id: newId };

  for (const [key, value] of Object.entries(originalDoc)) {
    if (isSingleReference(value)) {
      console.log('This is the single reference:', key, value);
      const refModel = detectModelByPath(SourceModel, key);
      if (refModel) {
        console.log('This is the reference model:', refModel);
      }
    } else if (isArrayOfReferences(value)) {
      console.log('This is the array of references:', key, value);
      const refModel = detectModelByPath(SourceModel, key);
      if (refModel) {
        console.log('This is the array reference model:', refModel);
        const newRefs = [];
        for (const refId of value) {
          console.log('This is the migrate props:', {
            modelName: refModel,
            rootId: refId.toString(),
            idMap: new Map(idMap),
          });
          const newRefId = await migrateDocumentCascade(refModel, refId.toString(), new Map(idMap));
          newRefs.push(newRefId);
        }
        clonedDoc[key] = newRefs;
      }
    }
  }
  console.log(`This is the cloned document with model: ${modelName}`, clonedDoc);
  return newId;
};

function isSingleReference(value) {
  if (value instanceof mongoose.Types.ObjectId) {
    return true;
  }

  return (
    typeof value === 'string' &&
    mongoose.Types.ObjectId.isValid(value) &&
    new mongoose.Types.ObjectId(value).toString() === value
  );
}

function isArrayOfReferences(value) {
  return Array.isArray(value) && value.every((v) => isSingleReference(v));
}

/**
 * Detects the model referenced by the path in the model's schema.
 */
function detectModelByPath(model, path) {
  const schemaPath = model.schema.path(path);
  if (!schemaPath) return null;

  const options = schemaPath.options;

  if (options && options.ref) {
    return options.ref;
  }

  if (Array.isArray(options.type) && options.type[0] && options.type[0].ref) {
    return options.type[0].ref;
  }

  return null;
}

main().catch((error) => {
  console.error('Error in main function:', error);
  process.exit(1);
});
