const { Schema, model } = require('mongoose');

const PostSchema = new Schema({
  author: { type: String, required: true },
  content: { type: String, required: true },
  likes: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
});

module.exports = model('Post', PostSchema);
