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
  // Check if document has already been migrated
  if (idMap.has(rootId)) {
    console.log(`Document ${rootId} already migrated to ${idMap.get(rootId)}`);
    return idMap.get(rootId);
  }

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
    } else if (
      typeof value === 'object' &&
      value !== null &&
      !Array.isArray(value) &&
      !isDate(value)
    ) {
      // Handle nested objects - they might contain references
      clonedDoc[key] = await processNestedObject(value, SourceModel, key, idMap);
    } else if (Array.isArray(value)) {
      // Handle arrays - they might contain objects or references
      clonedDoc[key] = await processArray(value, SourceModel, key, idMap);
    } else {
      // Simple value (string, number, boolean, etc.)
      clonedDoc[key] = value;
    }
  }

  console.log(`Attempting to save document with model: ${modelName}`);
  const { document, isSuccess } = await saveDocument(
    TargetModel,
    clonedDoc,
    originalDoc,
    rootId,
    idMap
  );

  return isSuccess ? document._id : null;
};

async function saveDocument(model, doc, originalDoc, rootId, idMap) {
  const modelName = model.modelName;
  try {
    // Try to create the document
    const newDoc = await model.create(doc);
    console.log(`Successfully created new document with ID: ${newDoc._id}`);
    return { document: newDoc, isSuccess: true };
  } catch (error) {
    // If error is due to duplicate key (unique index violation)
    if (error.name === 'MongoError' || error.name === 'MongoServerError') {
      if (error.code === 11000 || error.code === 11001) {
        console.log(`Duplicate key error detected for model ${modelName}:`, error.keyValue);

        // Find the existing document using the unique fields from the error
        const uniqueFields = error.keyValue;
        const existingDoc = await model.findOne(uniqueFields).lean();

        if (existingDoc) {
          console.log(`Found existing document with ID: ${existingDoc._id}`);

          // Update the idMap to point to the existing document instead
          idMap.set(rootId, existingDoc._id);

          // Return the existing document's ID
          return { document: existingDoc, isSuccess: true };
        } else {
          // This is an edge case - we got a duplicate key error but couldn't find the document
          // Try to find a more flexible approach to identify the document
          console.log(
            'Could not find existing document with the exact unique fields. Trying alternative approach...'
          );

          // Create a query based on available unique fields from the original document
          // This is a more flexible approach that might help find the document
          const uniqueQuery = {};

          // Get the schema to identify unique fields
          const schemaIndexes = model.schema.indexes();
          const uniqueIndexFields = schemaIndexes
            .filter((index) => index[1] && index[1].unique)
            .map((index) => Object.keys(index[0]));

          // Flatten the array of arrays
          const allUniqueFields = [].concat(...uniqueIndexFields);

          // Build a query with all available unique fields from the original document
          allUniqueFields.forEach((field) => {
            if (originalDoc[field] !== undefined) {
              uniqueQuery[field] = originalDoc[field];
            }
          });

          if (Object.keys(uniqueQuery).length > 0) {
            const alternativeDoc = await model.findOne(uniqueQuery).lean();

            if (alternativeDoc) {
              console.log(`Found document using alternative query with ID: ${alternativeDoc._id}`);
              idMap.set(rootId, alternativeDoc._id);
              return { document: alternativeDoc, isSuccess: true };
            }
          }

          // If we still can't find it, log the error and return null
          console.error(
            'Could not resolve the duplicate key conflict. Migration for this document failed.'
          );
          return { document: null, isSuccess: false };
        }
      }
    }

    // For other errors, log and return null
    console.error(`Error saving document for model ${modelName}:`, error);
    return { document: null, isSuccess: false };
  }
}

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
  return (
    value instanceof Date ||
    (typeof value === 'object' &&
      value !== null &&
      Object.prototype.toString.call(value) === '[object Date]')
  );
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

/**
 * Process a nested object to handle any references it might contain
 */
async function processNestedObject(obj, parentModel, parentPath, idMap) {
  const result = {};

  for (const [key, value] of Object.entries(obj)) {
    const fullPath = `${parentPath}.${key}`;

    if (isSingleReference(value)) {
      // Handle reference in nested object
      const refModel = detectModelByPath(parentModel, fullPath);
      if (refModel) {
        const newRefId = await migrateDocumentCascade(refModel, value.toString(), idMap);
        if (newRefId) {
          result[key] = newRefId;
        }
      } else {
        // If not a reference or reference model not found, keep original value
        result[key] = value;
      }
    } else if (isArrayOfReferences(value)) {
      // Handle array of references in nested object
      const refModel = detectModelByPath(parentModel, fullPath);
      if (refModel) {
        const newRefs = [];
        for (const refId of value) {
          const newRefId = await migrateDocumentCascade(refModel, refId.toString(), idMap);
          if (newRefId) {
            newRefs.push(newRefId);
          }
        }
        result[key] = newRefs;
      } else {
        result[key] = value;
      }
    } else if (
      typeof value === 'object' &&
      value !== null &&
      !Array.isArray(value) &&
      !isDate(value)
    ) {
      // Recursively process nested objects
      result[key] = await processNestedObject(value, parentModel, fullPath, idMap);
    } else if (Array.isArray(value)) {
      // Process arrays in nested objects
      result[key] = await processArray(value, parentModel, fullPath, idMap);
    } else {
      // Simple value
      result[key] = value;
    }
  }

  return result;
}

/**
 * Process an array to handle any objects or references it might contain
 */
async function processArray(arr, parentModel, parentPath, idMap) {
  const result = [];

  for (let i = 0; i < arr.length; i++) {
    const value = arr[i];
    const itemPath = `${parentPath}.${i}`;

    if (isSingleReference(value)) {
      // Handle reference in array
      const refModel = detectModelByPath(parentModel, parentPath);
      if (refModel) {
        const newRefId = await migrateDocumentCascade(refModel, value.toString(), idMap);
        if (newRefId) {
          result.push(newRefId);
        }
      } else {
        result.push(value);
      }
    } else if (typeof value === 'object' && value !== null && !isDate(value)) {
      if (Array.isArray(value)) {
        // Handle nested arrays
        result.push(await processArray(value, parentModel, itemPath, idMap));
      } else {
        // Handle objects in arrays
        result.push(await processNestedObject(value, parentModel, itemPath, idMap));
      }
    } else {
      // Simple value
      result.push(value);
    }
  }

  return result;
}

main().catch((error) => {
  console.error('Error in main function:', error);
  process.exit(1);
});
