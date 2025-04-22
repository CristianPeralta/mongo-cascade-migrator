// Example Jest test for a model (adjust as needed)
const mongoose = require('mongoose');
const exampleSchema = require('../models/schemas/Example');

describe('Example Schema', () => {
  it('should be a Mongoose schema', () => {
    expect(exampleSchema).toBeInstanceOf(mongoose.Schema);
  });
});
