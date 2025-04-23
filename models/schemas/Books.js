// src/models/schemas/Books.js
const { Schema } = require('mongoose');

const BookSchema = new Schema({
  title: String,
  author: { type: Schema.Types.ObjectId, ref: 'Authors' },
}, { timestamps: true });

module.exports = BookSchema;
