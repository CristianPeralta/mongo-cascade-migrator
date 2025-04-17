require('dotenv').config();
const { connectToMongo } = require('./db/connect');
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

  const sourceConnection = await connectToMongo(SOURCE_URI);
  const targetConnection = await connectToMongo(TARGET_URI);

  registerModels(sourceConnection);
  registerModels(targetConnection);

  console.log('This is the model name:', modelName);
  const idMap = new Map();
  if (rootId) {
    const newId = await migrateDocumentCascade(
      sourceConnection,
      targetConnection,
      modelName,
      rootId
    );
    if (newId) {
      console.log(`Document migrated. New ID: ${newId}`);
    } else {
      console.log(`No document found with ID: ${rootId}`);
    }
  } else if (query) {
    console.log('This is the query:', query);
  }

  await sourceConnection.close();
  await targetConnection.close();
}

const migrateDocumentCascade = async (sourceConnection, targetConnection, modelName, rootId) => {
  const idMap = new Map();
  console.log('This is the root Id:', rootId);
  const SourceModel = sourceConnection.model(modelName);
  const originalDoc = await SourceModel.findById(rootId).lean();
  if (!originalDoc) {
    console.error('Original document not found');
    process.exit(1);
  }
  const newId = new mongoose.Types.ObjectId();
  idMap.set(rootId, newId);
  const clonedDoc = { ...originalDoc, _id: newId };

  for (const [key, value] of Object.entries(originalDoc)) {
    if (isSingleReference(value)) {
      console.log('This is the single reference:', key, value);
    } else if (isArrayOfReferences(value)) {
      console.log('This is the array of references:', key, value);
    }
  }
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

main().catch((error) => {
  console.error('Error in main function:', error);
  process.exit(1);
});
