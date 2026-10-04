import "dotenv/config";
import { resolve } from "node:path";
import { randomBytes } from "node:crypto";
import { createApp } from "./app.js";
import { createMongoRepository } from "./repositories/mongo.js";
import { createFileRepository } from "./repositories/file.js";
import { samplePosts } from "./data/sample-posts.js";

const demo = process.argv.includes("--demo");
const production = process.env.NODE_ENV === "production";
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || "127.0.0.1";

try {
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error("PORT must be an integer from 1 to 65535.");
  if (production && demo)
    throw new Error(
      "Demo mode is for local development. Use MongoDB in production.",
    );
  if (
    production &&
    (!process.env.COOKIE_SECRET ||
      process.env.COOKIE_SECRET.length < 32 ||
      process.env.COOKIE_SECRET.startsWith("replace-"))
  )
    throw new Error(
      "Set COOKIE_SECRET to a random value of at least 32 characters.",
    );
  if (!demo && !process.env.MONGODB_URI)
    throw new Error(
      "Set MONGODB_URI in .env to use MongoDB, or run npm run demo to try the app locally.",
    );
  const repository = demo
    ? await createFileRepository(resolve(".data/posts.json"), samplePosts)
    : await createMongoRepository(process.env.MONGODB_URI);
  const app = createApp({
    repository,
    production,
    secret: process.env.COOKIE_SECRET || randomBytes(32).toString("hex"),
  });
  const server = app.listen(port, host, () => {
    console.log(
      `Margin is ready at http://${host === "0.0.0.0" ? "localhost" : host}:${port}`,
    );
    console.log(
      demo
        ? "Local demo: posts persist in .data/posts.json (not MongoDB)."
        : "Connected to MongoDB.",
    );
  });
  server.on("error", async (error) => {
    console.error(
      `Server could not start (${error.code || "unknown error"}). Check HOST and PORT.`,
    );
    await repository.close();
    process.exitCode = 1;
  });
  let stopping = false;
  const shutdown = () => {
    if (stopping) return;
    stopping = true;
    const timeout = setTimeout(() => process.exit(1), 10000).unref();
    server.close(async () => {
      await repository.close();
      clearTimeout(timeout);
      process.exitCode = 0;
    });
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
} catch (error) {
  // Driver errors may contain a connection URI, so never print them verbatim.
  const safeMessage = [
    "MongooseServerSelectionError",
    "MongoServerError",
    "MongoParseError",
    "MongoAPIError",
  ].includes(error.name)
    ? "Could not connect to MongoDB. Check the URI, database user, network access list, and whether the database is running."
    : /mongodb(?:\+srv)?:\/\//i.test(error.message)
      ? "Could not connect to MongoDB. Check your connection settings."
      : error.message;
  console.error(safeMessage);
  process.exitCode = 1;
}
