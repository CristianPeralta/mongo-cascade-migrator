const path = require('path');

class Config {
  constructor(options = {}) {
    this.originUrl = options.originUrl;
    this.destinationUrl = options.destinationUrl;
    this.schemasPath = options.schemasPath || path.join(process.cwd(), 'models/schemas');
    this.schemas = options.schemas || [];
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
    if (this.schemas.length === 0) {
      throw new Error('At least one schema must be provided');
    }
  }
}

module.exports = Config;
