// src/models/schemas/Authors.js
const { Schema } = require('mongoose');

const AuthorSchema = new Schema({
  name: String,
  email: String,
}, { timestamps: true });

module.exports = AuthorSchema;
