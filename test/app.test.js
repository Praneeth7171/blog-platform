import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import request from "supertest";
import { createApp } from "../src/app.js";
import { createFileRepository } from "../src/repositories/file.js";

export const validPost = {
  title: "A useful first story",
  excerpt: "A short introduction to this useful story.",
  author: "Test Author",
  category: "Development",
  cover: "cobalt",
  content: "## A fresh start\n\nHere is a story with enough detail to publish.",
};
let directory, filename, repository, app, agent, token;
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "margin-test-"));
  filename = join(directory, "posts.json");
  repository = await createFileRepository(filename);
  app = createApp({
    repository,
    secret: "test-only-cookie-secret",
    logger: { error() {} },
  });
  agent = request.agent(app);
  const form = await agent.get("/posts/new").expect(200);
  token = /name="_csrf" value="([a-f\d]+)"/.exec(form.text)[1];
});
afterEach(async () => {
  await repository.close();
  await rm(directory, { recursive: true, force: true });
});

test("complete create, read, edit, confirm delete, and delete journey", async () => {
  const created = await agent
    .post("/posts")
    .type("form")
    .send({ ...validPost, _csrf: token })
    .expect(303);
  const url = created.headers.location.split("?")[0];
  const shown = await agent.get(created.headers.location).expect(200);
  assert.match(shown.text, /Your story is published/);
  assert.match(shown.text, /<h2>A fresh start<\/h2>/);
  assert.equal(await repository.count(), 1);
  await agent.get(`${url}/edit`).expect(200);
  await agent
    .post(url)
    .type("form")
    .send({
      ...validPost,
      title: "An improved story",
      _csrf: token,
      _method: "PUT",
    })
    .expect(303);
  const updated = await agent.get(url).expect(200);
  assert.match(updated.text, /An improved story/);
  const confirmation = await agent.get(`${url}/delete`).expect(200);
  assert.match(confirmation.text, /Keep story/);
  assert.equal(await repository.count(), 1, "GET confirmation does not delete");
  await agent
    .post(url)
    .type("form")
    .send({ _csrf: token, _method: "DELETE" })
    .expect(303);
  await agent.get(url).expect(404);
  assert.equal(await repository.count(), 0);
});

test("invalid create and edit preserve values without changing saved data", async () => {
  const invalid = await agent
    .post("/posts")
    .type("form")
    .send({ ...validPost, title: "x", _csrf: token })
    .expect(422);
  assert.match(invalid.text, /at least 3 characters/);
  assert.match(invalid.text, /value="Test Author"/);
  assert.equal(await repository.count(), 0);
  const post = await repository.create(validPost);
  await agent
    .post(`/posts/${post._id}`)
    .type("form")
    .send({
      ...validPost,
      category: "$where",
      author: "",
      _csrf: token,
      _method: "PUT",
    })
    .expect(422);
  assert.equal((await repository.get(post._id)).author, validPost.author);
});

test("cross-site submissions, missing tokens, and malformed Unicode tokens are rejected", async () => {
  await agent.post("/posts").type("form").send(validPost).expect(403);
  await agent
    .post("/posts")
    .type("form")
    .send({ ...validPost, _csrf: "a".repeat(64) })
    .expect(403);
  await agent
    .post("/posts")
    .type("form")
    .send({ ...validPost, _csrf: "é".repeat(64) })
    .expect(403);
  await request(app)
    .post("/posts")
    .type("form")
    .send({ ...validPost, _csrf: token })
    .expect(403);
  const post = await repository.create(validPost);
  await agent.delete(`/posts/${post._id}`).expect(403);
  assert.equal(await repository.count(), 1);
});

test("HTML is escaped in titles and dangerous Markdown is sanitized", async () => {
  const post = await repository.create({
    ...validPost,
    title: "<script>alert(1)</script>",
    content:
      "A safe paragraph with enough text.\n\n<script>alert(1)</script>\n\n[bad](javascript:alert%281%29)\n\n<img src=x onerror=alert(1)>",
  });
  const shown = await agent.get(`/posts/${post._id}`).expect(200);
  assert.match(shown.text, /&lt;script&gt;/);
  assert.doesNotMatch(shown.text, /<script>alert|href="javascript:|<img src=x/);
  assert.ok(shown.headers["content-security-policy"]);
  assert.equal(shown.headers["x-powered-by"], undefined);
});

test("search is literal, category filters combine with search, and pagination is bounded", async () => {
  for (let index = 0; index < 8; index++)
    await repository.create({
      ...validPost,
      title: `Story ${index}`,
      category: index % 2 ? "Design" : "Development",
    });
  await repository.create({ ...validPost, title: "Literal [brackets]" });
  const literal = await agent.get("/posts?q=%5B").expect(200);
  assert.match(literal.text, /Literal \[brackets\]/);
  assert.doesNotMatch(literal.text, /<h3><a[^>]*>Story 1/);
  const filtered = await agent
    .get("/posts?q=Story&category=Design")
    .expect(200);
  assert.match(filtered.text, /Story 1/);
  assert.doesNotMatch(filtered.text, /<h3><a[^>]*>Story 0/);
  const second = await agent.get("/posts?page=999999").expect(200);
  assert.match(second.text, /Page 2 of 2/);
  await agent.get("/posts?q[bad]=x&category[bad]=y&page=NaN").expect(200);
});

test("demo writes persist when the repository reopens, including deletes", async () => {
  const post = await repository.create(validPost);
  await repository.update(post._id, {
    ...validPost,
    title: "Persisted update",
  });
  const reopened = await createFileRepository(filename);
  assert.equal((await reopened.get(post._id)).title, "Persisted update");
  await reopened.remove(post._id);
  await reopened.close();
  const again = await createFileRepository(filename, [validPost]);
  assert.equal(await again.count(), 0, "empty saved demo must not reseed");
  await again.close();
});

test("bad ids, missing posts, and unknown pages return friendly 404 pages", async () => {
  for (const url of [
    "/posts/not-an-id",
    "/posts/aaaaaaaaaaaaaaaaaaaaaaaa",
    "/missing-page",
  ]) {
    const response = await agent.get(url).expect(404);
    assert.match(response.text, /A page out of place/);
  }
});

test("request limits and database errors produce safe error pages", async () => {
  await agent
    .post("/posts")
    .type("form")
    .send({ _csrf: token, content: "a".repeat(300000) })
    .expect(413);
  const failing = createApp({
    repository: {
      mode: "test",
      list() {
        throw new Error("private database details");
      },
    },
    logger: { error() {} },
  });
  const error = await request(failing).get("/posts").expect(500);
  assert.match(error.text, /Something went wrong/);
  assert.doesNotMatch(error.text, /private database details/);
});

test("real PUT and DELETE verbs work with valid CSRF form bodies", async () => {
  const post = await repository.create(validPost);
  await agent
    .put(`/posts/${post._id}`)
    .type("form")
    .send({ ...validPost, title: "REST method update", _csrf: token })
    .expect(303);
  assert.equal((await repository.get(post._id)).title, "REST method update");
  await agent
    .delete(`/posts/${post._id}`)
    .type("form")
    .send({ _csrf: token })
    .expect(303);
});
