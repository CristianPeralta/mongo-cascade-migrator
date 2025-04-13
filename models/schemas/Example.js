// src/models/schemas/Example.js
const { Schema } = require('mongoose');

const exampleSchema = new Schema({
  name: String,
  alias: String,
});

module.exports = exampleSchema;
