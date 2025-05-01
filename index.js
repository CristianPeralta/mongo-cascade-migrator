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

  async migrate() {
    await this.config.validate();
    return main(this.config);
  }
}

module.exports = MongoCascadeMigrator;
