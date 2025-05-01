const { main } = require('./main');
const Config = require('./config');

// Export the main function and Config class for programmatic usage
module.exports = {
  migrate: async (options) => {
    const config = new Config(options);
    config.validate();
    return main(config);
  },
  Config,
};

// CLI usage
if (require.main === module) {
  main().catch((error) => {
    console.error('Error in main function:', error);
    process.exit(1);
  });
}
