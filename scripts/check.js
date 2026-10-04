import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { parse } from "acorn";
import ejs from "ejs";

async function files(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map((entry) =>
        entry.isDirectory()
          ? files(join(dir, entry.name))
          : join(dir, entry.name),
      ),
    )
  ).flat();
}
let count = 0;
for (const file of (
  await Promise.all(["src", "public", "scripts", "test", "views"].map(files))
).flat()) {
  if (file.endsWith(".js")) {
    parse(await readFile(file, "utf8"), {
      ecmaVersion: "latest",
      sourceType: "module",
    });
    count++;
  } else if (file.endsWith(".ejs")) {
    ejs.compile(await readFile(file, "utf8"), { filename: file });
    count++;
  }
}
console.log(`Checked ${count} JavaScript and EJS files.`);
