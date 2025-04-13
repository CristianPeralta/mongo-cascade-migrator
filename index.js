require('dotenv').config();
const { connectToMongo } = require('./db/connect');
const { registerModels } = require('./models');

const SOURCE_URI = process.env.SOURCE_URI || 'mongodb://localhost:27017/source_db';
const TARGET_URI = process.env.TARGET_URI || 'mongodb://localhost:27017/target_db';

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
  if (rootId) {
    console.log('This is the root Id:', rootId);
  } else if (query) {
    console.log('This is the query:', query);
  }

  await sourceConnection.close();
  await targetConnection.close();
}

main();
