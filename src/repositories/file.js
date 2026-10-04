import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { dirname } from "node:path";
import { randomBytes } from "node:crypto";

// An explicit, single-process demo store. Normal startup always uses MongoDB.
export async function createFileRepository(filename, initialPosts = []) {
  await mkdir(dirname(filename), { recursive: true });
  let posts;
  try {
    posts = JSON.parse(await readFile(filename, "utf8"));
    if (!Array.isArray(posts)) throw new Error("Demo data must be an array.");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    posts = initialPosts.map((post, i) => ({
      ...post,
      _id: randomBytes(12).toString("hex"),
      createdAt:
        post.createdAt || new Date(Date.now() - i * 86400000).toISOString(),
      updatedAt: post.updatedAt || post.createdAt || new Date().toISOString(),
    }));
    await writeFile(filename, JSON.stringify(posts, null, 2), { flag: "wx" });
  }
  let queue = Promise.resolve();
  function mutate(operation) {
    const result = queue.then(async () => {
      const next = structuredClone(posts);
      const value = operation(next);
      await writeFile(`${filename}.tmp`, JSON.stringify(next, null, 2));
      await rename(`${filename}.tmp`, filename);
      posts = next;
      return structuredClone(value);
    });
    queue = result.catch(() => {});
    return result;
  }
  return {
    mode: "demo",
    async list({ q = "", category = "", page = 1, pageSize = 6 } = {}) {
      await queue;
      const filtered = posts
        .filter(
          (post) =>
            (!category || post.category === category) &&
            (!q ||
              [post.title, post.excerpt, post.author].some((value) =>
                value.toLowerCase().includes(q.toLowerCase()),
              )),
        )
        .sort(
          (a, b) =>
            new Date(b.createdAt) - new Date(a.createdAt) ||
            b._id.localeCompare(a._id),
        );
      const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
      const currentPage = Math.min(page, pages);
      return {
        posts: structuredClone(
          filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize),
        ),
        total: filtered.length,
        page: currentPage,
        pages,
      };
    },
    async get(id) {
      await queue;
      return structuredClone(posts.find((post) => post._id === id) || null);
    },
    create(values) {
      return mutate((next) => {
        const post = {
          ...values,
          _id: randomBytes(12).toString("hex"),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        next.push(post);
        return post;
      });
    },
    update(id, values) {
      return mutate((next) => {
        const index = next.findIndex((post) => post._id === id);
        if (index < 0) return null;
        next[index] = {
          ...next[index],
          ...values,
          updatedAt: new Date().toISOString(),
        };
        return next[index];
      });
    },
    remove(id) {
      return mutate((next) => {
        const index = next.findIndex((post) => post._id === id);
        return index < 0 ? null : next.splice(index, 1)[0];
      });
    },
    async count() {
      await queue;
      return posts.length;
    },
    close: () => queue,
  };
}
