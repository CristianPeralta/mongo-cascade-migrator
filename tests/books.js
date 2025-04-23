// Books Jest test for a model (adjust as needed)
const mongoose = require('mongoose');
const BookSchema = require('../models/schemas/Books');

describe('Book Schema', () => {
  it('should be a Mongoose schema', () => {
    expect(BookSchema).toBeInstanceOf(mongoose.Schema);
  });
});
