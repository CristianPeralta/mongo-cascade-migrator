const path = require('path');
const fs = require('fs');
class Config {
  constructor(options = {}) {
    this.originUrl = options.originUrl;
    this.destinationUrl = options.destinationUrl;
    if (options.schemasPath) {
      this.schemasPath = options.schemasPath;
      this.schemas = null;
    }
    if (options.schemas) {
      this.schemas = options.schemas;
      this.schemasPath = null;
    }
  }

  validate() {
    if (!this.originUrl) {
      throw new Error(
        'Origin MongoDB URL is required, for example: mongodb://127.0.0.1:27017/source_db'
      );
    }
    if (!this.destinationUrl) {
      throw new Error(
        'Destination MongoDB URL is required, for example: mongodb://127.0.0.1:27018/destination_db'
      );
    }
    if (!this.schemasPath && !this.schemas) {
      throw new Error('Schemas path or schemas are required');
    }
    if (this.schemasPath) {
      if (!fs.existsSync(this.schemasPath)) {
        throw new Error(`Schemas path ${this.schemasPath} does not exist`);
      }
      const schemas = fs.readdirSync(this.schemasPath);
      if (schemas.length === 0) {
        throw new Error('No schemas found in the provided path');
      }
    }
    if (this.schemas) {
      if (this.schemas.length === 0) {
        throw new Error('At least one schema must be provided');
      }
    }
  }
}

module.exports = Config;
