import express from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { csrfProtection } from "./middleware/csrf.js";
import {
  categories,
  covers,
  limits,
  validatePost,
  renderMarkdown,
  readTime,
  formatDate,
  initials,
  isPostId,
} from "./lib/posts.js";

const noticeMessages = {
  created: "Your story is published.",
  updated: "Your changes are saved.",
  deleted: "The story has been deleted.",
};
const getNotice = (value) =>
  typeof value === "string" && Object.hasOwn(noticeMessages, value)
    ? noticeMessages[value]
    : null;

export function createApp({
  repository,
  secret = randomBytes(32).toString("hex"),
  production = false,
  logger = console,
}) {
  const app = express();
  app.disable("x-powered-by");
  app.set("view engine", "ejs");
  app.set("views", fileURLToPath(new URL("../views", import.meta.url)));
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: { "upgrade-insecure-requests": production ? [] : null },
      },
      strictTransportSecurity: production ? undefined : false,
    }),
  );
  app.use(
    "/assets",
    express.static(fileURLToPath(new URL("../public", import.meta.url)), {
      maxAge: production ? "1h" : 0,
      dotfiles: "deny",
    }),
  );
  app.use((req, res, next) => {
    Object.assign(res.locals, {
      categories,
      covers,
      limits,
      readTime,
      formatDate,
      initials,
      currentPath: req.path,
      notice: null,
      description:
        "Thoughtful stories on building, designing, and finding your own perspective.",
      csrfToken: "",
      title: "Margin",
      q: "",
      category: "",
    });
    res.set("Cache-Control", "no-store");
    next();
  });
  app.use(
    express.urlencoded({ extended: false, limit: "256kb", parameterLimit: 20 }),
  );
  app.use(cookieParser(secret));
  app.use(csrfProtection({ production }));
  // HTML forms use POST; only validated forms may override it to PUT or DELETE.
  app.use((req, res, next) => {
    if (req.method === "POST" && ["PUT", "DELETE"].includes(req.body?._method))
      req.method = req.body._method;
    next();
  });
  app.get("/health", (_req, res) =>
    res.json({ status: "ok", storage: repository.mode }),
  );
  app.get("/", (_req, res) => res.redirect("/posts"));
  app.get("/posts", async (req, res) => {
    const q =
      typeof req.query.q === "string" ? req.query.q.trim().slice(0, 100) : "";
    const category = categories.includes(req.query.category)
      ? req.query.category
      : "";
    const rawPage =
      typeof req.query.page === "string" && /^\d{1,6}$/.test(req.query.page)
        ? Number(req.query.page)
        : 1;
    const result = await repository.list({
      q,
      category,
      page: Math.max(1, rawPage),
    });
    const listUrl = (overrides = {}) => {
      const params = new URLSearchParams({
        ...(q ? { q } : {}),
        ...(category ? { category } : {}),
        ...overrides,
      });
      for (const [key, value] of [...params]) if (!value) params.delete(key);
      return `/posts${params.size ? `?${params}` : ""}`;
    };
    res.render("posts/index", {
      title: "The journal",
      ...result,
      q,
      category,
      listUrl,
      notice: getNotice(req.query.notice),
    });
  });
  app.get("/posts/new", (_req, res) =>
    res.render("posts/form", {
      title: "Write a story",
      editing: false,
      post: {
        title: "",
        excerpt: "",
        author: "",
        content: "",
        category: "Development",
        cover: "cobalt",
      },
      errors: {},
    }),
  );
  app.post("/posts", async (req, res) => {
    const { values, errors, valid } = validatePost(req.body);
    if (!valid)
      return res
        .status(422)
        .render("posts/form", {
          title: "Write a story",
          editing: false,
          post: values,
          errors,
        });
    const post = await repository.create(values);
    res.redirect(303, `/posts/${post._id}?notice=created`);
  });
  app.param("id", async (req, res, next, id) => {
    if (!isPostId(id)) return notFound(res);
    const post = await repository.get(id);
    if (!post) return notFound(res);
    req.post = post;
    next();
  });
  app.get("/posts/:id", (req, res) =>
    res.render("posts/show", {
      title: req.post.title,
      description: req.post.excerpt,
      post: req.post,
      contentHtml: renderMarkdown(req.post.content),
      notice: getNotice(req.query.notice),
    }),
  );
  app.get("/posts/:id/edit", (req, res) =>
    res.render("posts/form", {
      title: "Edit your story",
      editing: true,
      post: req.post,
      errors: {},
    }),
  );
  app.put("/posts/:id", async (req, res) => {
    const { values, errors, valid } = validatePost(req.body);
    if (!valid)
      return res
        .status(422)
        .render("posts/form", {
          title: "Edit your story",
          editing: true,
          post: { ...values, _id: req.post._id },
          errors,
        });
    const updated = await repository.update(req.post._id.toString(), values);
    if (!updated) return notFound(res);
    res.redirect(303, `/posts/${updated._id}?notice=updated`);
  });
  app.get("/posts/:id/delete", (req, res) =>
    res.render("posts/delete", { title: "Delete story", post: req.post }),
  );
  app.delete("/posts/:id", async (req, res) => {
    if (!(await repository.remove(req.post._id.toString())))
      return notFound(res);
    res.redirect(303, "/posts?notice=deleted");
  });
  app.use((_req, res) => notFound(res));
  app.use((error, _req, res, _next) => {
    logger.error(error.name || "Error");
    const status =
      error.type === "entity.too.large"
        ? 413
        : error.status === 400
          ? 400
          : 500;
    res
      .status(status)
      .render("error", {
        title:
          status === 413
            ? "This story is too large"
            : status === 400
              ? "Invalid request"
              : "Something went wrong",
        status,
        message:
          status === 413
            ? "Shorten your story and try again. Posts can contain up to 60,000 characters."
            : status === 400
              ? "The request could not be read. Please go back and try again."
              : "We could not finish that request. Please try again in a moment.",
      });
  });
  return app;
}

function notFound(res) {
  return res
    .status(404)
    .render("error", {
      title: "A page out of place",
      status: 404,
      message:
        "This story may have moved or been deleted. There are more ideas waiting in the journal.",
    });
}
