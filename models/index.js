const fs = require('fs');
const path = require('path');

/**
 * Registers all schemas inside the /schemas directory in a connection.
 * @param {mongoose.Connection} connection
 */
function registerModels(connection) {
  const schemasDir = path.join(__dirname, 'schemas');
  const files = fs.readdirSync(schemasDir).filter((file) => file.endsWith('.js'));

  for (const file of files) {
    const modelName = path.basename(file, '.js');
    const schema = require(path.join(schemasDir, file));
    connection.model(modelName, schema);
  }
}

module.exports = {
  registerModels,
};
