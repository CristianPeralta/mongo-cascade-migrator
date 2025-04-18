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
  console.log('This is the id map:', idMap);

  // Close connections using the singleton
  connectionManager.closeConnections();
}

const migrateDocumentCascade = async (modelName, rootId, idMap) => {
  console.log('---------------------------------------------------------');
  // Get connections from the singleton
  const sourceConnection = connectionManager.getSourceConnection();
  const targetConnection = connectionManager.getTargetConnection();

  const SourceModel = sourceConnection.model(modelName);
  const TargetModel = targetConnection.model(modelName);

  const originalDoc = await SourceModel.findById(rootId).lean();
  if (!originalDoc) {
    console.error('Original document not found');
    return null;
  }
  const newId = new mongoose.Types.ObjectId();
  idMap.set(rootId, newId);
  const clonedDoc = { ...originalDoc, _id: newId };

  for (const [key, value] of Object.entries(originalDoc)) {
    // ignore _id
    if (key === '_id') continue;
    if (isSingleReference(value)) {
      const refModel = detectModelByPath(SourceModel, key);
      if (refModel) {
        // TO DO: Migrate the reference document
        const newRefId = await migrateDocumentCascade(refModel, value.toString(), idMap);
        if (newRefId) {
          clonedDoc[key] = newRefId;
        } else {
          delete clonedDoc[key]; // delete orphan reference
        }
      }
    } else if (isArrayOfReferences(value)) {
      const refModel = detectModelByPath(SourceModel, key);
      if (refModel) {
        const newRefs = [];
        for (const refId of value) {
          const newRefId = await migrateDocumentCascade(refModel, refId.toString(), idMap);
          if (newRefId) {
            newRefs.push(newRefId);
          } else {
            console.error(`Failed to migrate reference ${refId} for model ${refModel}`);
          }
        }
        clonedDoc[key] = newRefs;
      }
    }
    // TO DO: Consider other kind of fields like objects and array of objects
    // Date fields are not migrated
    else if (
      typeof value === 'object' &&
      value !== null &&
      !Array.isArray(value) &&
      !isDate(value)
    ) {
      // This could contain references, so we need to migrate them
      console.log('This is a object:', value);
      clonedDoc[key] = value;
    } else if (Array.isArray(value)) {
      console.log('This is an array:', value);
      clonedDoc[key] = value;
    } else {
      clonedDoc[key] = value;
    }
  }
  console.log(`This is the cloned document with model: ${modelName}`, clonedDoc);
  // TO DO: Save the cloned document
  // await TargetModel.create(clonedDoc);
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

function isDate(value) {
  return value instanceof Date;
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
