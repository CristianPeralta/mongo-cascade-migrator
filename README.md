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
- Programmatic API for integration in your code

## Usage

### CLI Usage

```bash
node index.js --model=ModelName --id=ObjectId [--query='{"key": "value"}']
```

### Programmatic Usage

```javascript
const MongoCascadeMigrator = require('mongo-cascade-migrator');

// Initialize the migrator with your configuration
const migrator = new MongoCascadeMigrator({
  originUrl: 'mongodb://localhost:27017/source_db',
  destinationUrl: 'mongodb://localhost:27018/target_db',
  schemasPath: './path/to/your/schemas', // Optional, defaults to './models/schemas'
  // OR provide schemas directly
  schemas: [require('./path/to/your/schema1'), require('./path/to/your/schema2')],
});

// Migrate a single document by ID
migrator
  .migrate('User', '507f1f77bcf86cd799439011')
  .then((idMap) => {
    console.log('Migration completed successfully');
    console.log('ID Map:', idMap);
  })
  .catch((error) => {
    console.error('Migration failed:', error);
  });

// Migrate multiple documents using a query
migrator
  .migrate('User', { status: 'active' })
  .then((idMap) => {
    console.log('Migration completed successfully');
    console.log('ID Map:', idMap);
  })
  .catch((error) => {
    console.error('Migration failed:', error);
  });
```

### Configuration Options

- `originUrl`: MongoDB connection URL for the source database (required)
- `destinationUrl`: MongoDB connection URL for the target database (required)
- `schemasPath`: Path to the directory containing your Mongoose schemas (optional)
- `schemas`: Array of schema definitions (optional, alternative to schemasPath)

### Schema Configuration

You can provide your schemas in two ways:

1. **Using a directory path**:

```javascript
const migrator = new MongoCascadeMigrator({
  originUrl: 'mongodb://localhost:27017/source_db',
  destinationUrl: 'mongodb://localhost:27018/target_db',
  schemasPath: './path/to/your/schemas',
});
```

2. **Providing schemas directly**:

```javascript
const migrator = new MongoCascadeMigrator({
  originUrl: 'mongodb://localhost:27017/source_db',
  destinationUrl: 'mongodb://localhost:27018/target_db',
  schemas: [require('./path/to/your/schema1'), require('./path/to/your/schema2')],
});
```

### Example Schema

```javascript
// models/schemas/User.js
const { Schema } = require('mongoose');

const UserSchema = new Schema(
  {
    name: String,
    email: String,
    posts: [{ type: Schema.Types.ObjectId, ref: 'Post' }],
    profile: { type: Schema.Types.ObjectId, ref: 'Profile' },
  },
  { timestamps: true }
);

module.exports = UserSchema;
```

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
- Validation of configuration and schemas

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

ISC License © Cristian Peralta Segura

This project is licensed under the ISC License, which is a permissive free software license published by the Internet Systems Consortium (ISC). This license allows you to use, modify, and distribute the software freely, as long as you include the original copyright notice and disclaimer.
