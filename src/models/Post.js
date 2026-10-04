import mongoose from "mongoose";
import { categories, covers, limits } from "../lib/posts.js";

const postSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: limits.title,
    },
    excerpt: {
      type: String,
      required: true,
      trim: true,
      minlength: 10,
      maxlength: limits.excerpt,
    },
    author: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: limits.author,
    },
    content: {
      type: String,
      required: true,
      trim: true,
      minlength: 20,
      maxlength: limits.content,
    },
    category: { type: String, required: true, enum: categories },
    cover: { type: String, required: true, enum: covers },
  },
  { timestamps: true, versionKey: false },
);

postSchema.index({ createdAt: -1, _id: -1 });
postSchema.index({ category: 1, createdAt: -1 });

export function createPostModel(connection) {
  return connection.models.Post || connection.model("Post", postSchema);
}
