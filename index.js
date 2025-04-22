const { main } = require('./main');

if (require.main === module) {
  main();
}

main().catch((error) => {
  console.error('Error in main function:', error);
  process.exit(1);
});
