const mongoose = require('mongoose');

function connectToMongo(uri) {
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

module.exports = {
  connectToMongo,
};
