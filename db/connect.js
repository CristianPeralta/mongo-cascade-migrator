const mongoose = require('mongoose');

// Singleton for connections
class ConnectionManager {
  constructor() {
    this.sourceConnection = null;
    this.targetConnection = null;
  }

  connectToMongo(uri) {
    const connection = mongoose.createConnection(uri);

    connection.on('error', (err) => {
      console.error('MongoDB connection error:', err);
    });

    connection.once('open', () => {
      console.log('MongoDB connection opened at:', uri);
    });

    connection.on('close', () => {
      console.log('MongoDB connection closed at:', uri);
    });

    return connection;
  }

  setSourceConnection(uri) {
    this.sourceConnection = this.connectToMongo(uri);
    return this.sourceConnection;
  }

  setTargetConnection(uri) {
    this.targetConnection = this.connectToMongo(uri);
    return this.targetConnection;
  }

  getSourceConnection() {
    return this.sourceConnection;
  }

  getTargetConnection() {
    return this.targetConnection;
  }

  closeConnections() {
    if (this.sourceConnection) {
      this.sourceConnection.close();
    }
    if (this.targetConnection) {
      this.targetConnection.close();
    }
  }
}

// Create a unique instance
const connectionManager = new ConnectionManager();

module.exports = {
  connectionManager,
  connectToMongo: (uri) => connectionManager.connectToMongo(uri),
};
