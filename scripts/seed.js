import "dotenv/config";
import { createMongoRepository } from "../src/repositories/mongo.js";
import { samplePosts } from "../src/data/sample-posts.js";

if (!process.env.MONGODB_URI) {
  console.error("Set MONGODB_URI in .env before seeding.");
  process.exitCode = 1;
} else {
  let repository;
  try {
    repository = await createMongoRepository(process.env.MONGODB_URI);
    console.log(
      (await repository.seed(samplePosts))
        ? "Added 4 sample stories."
        : "Skipped: the database already contains stories. Existing posts were kept.",
    );
  } catch {
    console.error(
      "Could not seed MongoDB. Check your connection settings and database access.",
    );
    process.exitCode = 1;
  } finally {
    await repository?.close();
  }
}
