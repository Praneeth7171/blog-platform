import mongoose from "mongoose";
import { createPostModel } from "../models/Post.js";
import { escapeRegExp } from "../lib/posts.js";

export async function createMongoRepository(uri) {
  const connection = await mongoose
    .createConnection(uri, { serverSelectionTimeoutMS: 10000 })
    .asPromise();
  const Post = createPostModel(connection);
  await Post.init();
  return {
    mode: "mongo",
    async list({ q = "", category = "", page = 1, pageSize = 6 } = {}) {
      const filter = {};
      if (category) filter.category = category;
      if (q) {
        const search = new RegExp(escapeRegExp(q), "i");
        filter.$or = [
          { title: search },
          { excerpt: search },
          { author: search },
        ];
      }
      const total = await Post.countDocuments(filter);
      const pages = Math.max(1, Math.ceil(total / pageSize));
      const currentPage = Math.min(page, pages);
      const posts = await Post.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip((currentPage - 1) * pageSize)
        .limit(pageSize)
        .lean();
      return { posts, total, page: currentPage, pages };
    },
    get: (id) => Post.findById(id).lean(),
    async create(values) {
      return (await Post.create(values)).toObject();
    },
    update: (id, values) =>
      Post.findByIdAndUpdate(
        id,
        { $set: values },
        { returnDocument: "after", runValidators: true },
      ).lean(),
    remove: (id) => Post.findByIdAndDelete(id).lean(),
    count: () => Post.countDocuments(),
    async seed(posts) {
      if (await Post.exists({})) return false;
      await Post.insertMany(posts);
      return true;
    },
    close: () => connection.close(),
  };
}
