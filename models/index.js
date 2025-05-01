const fs = require('fs');
const path = require('path');

/**
 * Registers all schemas from the specified directory in a connection.
 * @param {mongoose.Connection} connection
 * @param {string} schemasPath - Path to the schemas directory
 */
function registerModels(connection, schemasPath = path.join(__dirname, 'schemas')) {
  if (!fs.existsSync(schemasPath)) {
    throw new Error(`Schemas directory not found at: ${schemasPath}`);
  }

  const files = fs.readdirSync(schemasPath).filter((file) => file.endsWith('.js'));

  for (const file of files) {
    const modelName = path.basename(file, '.js');
    const schema = require(path.join(schemasPath, file));
    connection.model(modelName, schema);
  }
}

module.exports = {
  registerModels,
};
