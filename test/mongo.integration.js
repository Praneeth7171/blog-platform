import { test } from "node:test";
import assert from "node:assert/strict";
import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";
import { createMongoRepository } from "../src/repositories/mongo.js";
import { createApp } from "../src/app.js";

// No Atlas credentials needed: this starts a real isolated mongod process.
test(
  "MongoDB persists CRUD changes across connections and safely queries user input",
  { timeout: 180000 },
  async () => {
    const mongod = process.env.TEST_MONGODB_URI
      ? null
      : await MongoMemoryServer.create();
    const uri =
      process.env.TEST_MONGODB_URI || mongod.getUri("margin-integration");
    let repository;
    const ids = [];
    try {
      repository = await createMongoRepository(uri);
      const app = createApp({ repository });
      const agent = request.agent(app);
      const form = await agent.get("/posts/new").expect(200);
      const token = /name="_csrf" value="([a-f\d]+)"/.exec(form.text)[1];
      const values = {
        title: "A MongoDB [integration] story",
        excerpt: "This story verifies persistent MongoDB data.",
        author: "Integration Test",
        content: "A real database stores this text across connections.",
        category: "Development",
        cover: "cobalt",
      };
      const response = await agent
        .post("/posts")
        .type("form")
        .send({ ...values, _csrf: token })
        .expect(303);
      const id = response.headers.location.split("/").at(-1).split("?")[0];
      ids.push(id);
      assert.equal((await repository.get(id)).title, values.title);
      await agent.get(`/posts/${id}`).expect(200);
      const results = await repository.list({
        q: "[integration]",
        category: "Development",
      });
      assert.ok(results.posts.some((post) => post._id.toString() === id));
      await agent
        .post(`/posts/${id}`)
        .type("form")
        .send({
          ...values,
          title: "MongoDB saved update",
          _csrf: token,
          _method: "PUT",
        })
        .expect(303);
      await repository.close();
      repository = await createMongoRepository(uri);
      assert.equal((await repository.get(id)).title, "MongoDB saved update");
      await assert.rejects(
        repository.create({ ...values, category: "Invalid category" }),
        { name: "ValidationError" },
      );
      const nextAgent = request.agent(createApp({ repository }));
      const nextForm = await nextAgent.get(`/posts/${id}/edit`).expect(200);
      const nextToken = /name="_csrf" value="([a-f\d]+)"/.exec(
        nextForm.text,
      )[1];
      await nextAgent
        .post(`/posts/${id}`)
        .type("form")
        .send({ _csrf: nextToken, _method: "DELETE" })
        .expect(303);
      assert.equal(await repository.get(id), null);
      await nextAgent.get(`/posts/${id}`).expect(404);
    } finally {
      if (repository) {
        for (const id of ids) await repository.remove(id).catch(() => {});
        await repository.close();
      }
      await mongod?.stop();
    }
  },
);
