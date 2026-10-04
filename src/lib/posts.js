import { marked } from "marked";
import sanitizeHtml from "sanitize-html";

export const categories = ["Development", "Design", "Ideas", "Life"];
export const covers = ["cobalt", "ink", "citrus", "rose"];
export const limits = { title: 140, excerpt: 280, author: 60, content: 60000 };

export function validatePost(input = {}) {
  const values = {};
  for (const field of [
    "title",
    "excerpt",
    "author",
    "content",
    "category",
    "cover",
  ]) {
    values[field] = typeof input[field] === "string" ? input[field].trim() : "";
  }
  const errors = {};
  for (const [field, minimum] of Object.entries({
    title: 3,
    excerpt: 10,
    author: 2,
    content: 20,
  })) {
    if (values[field].length < minimum)
      errors[field] = `Please enter at least ${minimum} characters.`;
    else if (values[field].length > limits[field])
      errors[field] =
        `Keep this under ${limits[field].toLocaleString()} characters.`;
  }
  if (!categories.includes(values.category))
    errors.category = "Choose a category.";
  if (!covers.includes(values.cover)) errors.cover = "Choose a cover color.";
  return { values, errors, valid: Object.keys(errors).length === 0 };
}

export function renderMarkdown(content) {
  return sanitizeHtml(marked.parse(content, { gfm: true, breaks: false }), {
    allowedTags: [
      "p",
      "br",
      "h2",
      "h3",
      "h4",
      "strong",
      "em",
      "del",
      "ul",
      "ol",
      "li",
      "blockquote",
      "pre",
      "code",
      "a",
      "hr",
      "table",
      "thead",
      "tbody",
      "tr",
      "th",
      "td",
    ],
    allowedAttributes: { a: ["href", "title"] },
    allowedSchemes: ["http", "https", "mailto"],
    allowProtocolRelative: false,
    transformTags: { h1: "h2" },
  });
}

export const readTime = (content) =>
  Math.max(1, Math.ceil(content.trim().split(/\s+/u).length / 220));
export const formatDate = (date) =>
  new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(date));
export const initials = (name) =>
  name
    .split(/\s+/u)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
export const isPostId = (id) => /^[a-f\d]{24}$/i.test(id);
export const escapeRegExp = (value) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
