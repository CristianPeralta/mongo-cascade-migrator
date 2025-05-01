# mongo-cascade-migrator

A MongoDB document migration tool that handles recursive document references and maintains data integrity during migration.

<div align="center">
  <img src="./images/mongo-cascade-migrator.png" width="600" alt="Mongo Cascade Migrator Functionality">
</div>

## Installation

### Using npm

```bash
# Install globally
npm install -g mongo-cascade-migrator

# Or install as a project dependency
npm install mongo-cascade-migrator
```

### Manual Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/cristianperaltasegura/mongo-cascade-migrator.git
cd mongo-cascade-migrator
npm install
```

## Features

- Migrates documents and their references recursively
- Handles nested objects and arrays
- Maintains referential integrity
- Supports single document and bulk migrations
- Handles duplicate key conflicts intelligently
- Preserves timestamps and metadata
- Supports complex reference chains
- Command-line interface for easy usage

## Configuration

Create a `.env` file in your project root with the following variables:

```env
SOURCE_MONGODB_URI=mongodb://source-uri
TARGET_MONGODB_URI=mongodb://target-uri
```

## Schema Configuration

### Adding Your Schemas

The `models/schemas` directory is reserved exclusively for Mongoose schema definitions. No other code or logic should be placed in this directory. The `Authors` and `Books` schemas are provided as examples and can be modified or replaced with your own schemas.

Example schema structure:

```javascript
// models/schemas/YourModel.js
const { Schema } = require('mongoose');

const YourModelSchema = new Schema(
  {
    // Your fields here
    field1: String,
    field2: { type: Schema.Types.ObjectId, ref: 'RelatedModel' },
  },
  { timestamps: true }
);

// Add indexes for better performance
YourModelSchema.index({ field1: 1 });
YourModelSchema.index({ field2: 1 });

module.exports = YourModelSchema;
```

### Important Notes

1. **Schema Location**: All your schemas must be placed in the `models/schemas` directory
2. **Reference Definitions**: Always use the `ref` option for references to other models
3. **Indexes**: Add appropriate indexes for fields you'll query frequently
4. **Timestamps**: Consider using `{ timestamps: true }` to track document creation and updates
5. **Example Schemas**: Feel free to modify or replace the example `Authors` and `Books` schemas

## Usage

### CLI Usage

```bash
node index.js --model=ModelName --id=ObjectId [--query='{"key": "value"}']
```

### Programmatic Usage

```javascript
const { migrate, Config } = require('mongo-cascade-migrator');

// Example configuration
const config = new Config({
  originUrl: 'mongodb://localhost:27017/source_db',
  destinationUrl: 'mongodb://localhost:27018/target_db',
  schemasPath: './path/to/your/schemas', // Optional, defaults to './models/schemas'
  modelName: 'User', // The model to migrate
  rootId: '507f1f77bcf86cd799439011', // Optional, the ID of the document to migrate
  query: { status: 'active' }, // Optional, query to find documents to migrate
});

// Run the migration
migrate(config)
  .then((idMap) => {
    console.log('Migration completed successfully');
    console.log('ID Map:', idMap);
  })
  .catch((error) => {
    console.error('Migration failed:', error);
  });
```

### Configuration Options

- `originUrl`: MongoDB connection URL for the source database
- `destinationUrl`: MongoDB connection URL for the target database
- `schemasPath`: Path to the directory containing your Mongoose schemas (optional)
- `modelName`: Name of the model to migrate
- `rootId`: ID of the document to migrate (optional)
- `query`: Query to find documents to migrate (optional)

## Features in Detail

### Reference Handling

- Single references (ObjectId)
- Array of references
- Nested object references
- Complex reference chains

### Error Handling

- Duplicate key detection
- Orphaned reference handling
- Conflict resolution for existing documents

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

ISC License © Cristian Peralta Segura

This project is licensed under the ISC License, which is a permissive free software license published by the Internet Systems Consortium (ISC). This license allows you to use, modify, and distribute the software freely, as long as you include the original copyright notice and disclaimer.
