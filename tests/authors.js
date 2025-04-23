// Authors Jest test for a model (adjust as needed)
const mongoose = require('mongoose');
const AuthorSchema = require('../models/schemas/Authors');

describe('Author Schema', () => {
  it('should be a Mongoose schema', () => {
    expect(AuthorSchema).toBeInstanceOf(mongoose.Schema);
  });
});
