const { main } = require('./main');
const Config = require('./config');

// CLI usage
if (require.main === module) {
  main().catch((error) => {
    console.error('Error in main function:', error);
    process.exit(1);
  });
}

// Programmatic usage
class MongoCascadeMigrator {
  constructor(options) {
    const config = new Config(options);
    this.config = config;
  }
  /**
   * @param {string} modelName - The name of the model to migrate
   * @param {string|Object} query - The query to find documents to migrate. Can be a JSON string or query object
   * @returns {Promise<Map>} A map of original document IDs to their new IDs in the target database
   */
  async migrate(modelName, query) {
    await this.config.validate();
    await this.validateParams(modelName, query);
    if (typeof query === 'string') {
      return main(modelName, query, null, this.config);
    } else {
      return main(modelName, null, query, this.config);
    }
  }

  async validateParams(modelName, query) {
    if (!modelName) {
      throw new Error('Model name is required');
    }
    if (!['string', 'object'].includes(typeof query)) {
      throw new Error('Query must be a string or object');
    }
    return true;
  }
}

module.exports = MongoCascadeMigrator;
