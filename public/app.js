const dismiss = document.querySelector("[data-dismiss-notice]");
dismiss?.addEventListener("click", () => dismiss.closest(".notice").remove());

const editor = document.querySelector("[data-editor-form]");
if (editor) {
  const content = document.getElementById("content");
  const count = document.getElementById("word-count");
  let dirty = false;
  const updateCount = () => {
    const words = content.value.trim()
      ? content.value.trim().split(/\s+/u).length
      : 0;
    count.textContent = `${words.toLocaleString()} ${words === 1 ? "word" : "words"} · ${Math.max(1, Math.ceil(words / 220))} min read`;
  };
  editor.addEventListener("input", () => {
    dirty = true;
    updateCount();
  });
  editor.addEventListener("change", () => {
    dirty = true;
  });
  editor.addEventListener("submit", () => {
    dirty = false;
  });
  window.addEventListener("beforeunload", (event) => {
    if (dirty) {
      event.preventDefault();
      event.returnValue = "";
    }
  });
  for (const button of document.querySelectorAll("[data-format]")) {
    button.addEventListener("click", () => {
      const start = content.selectionStart;
      const end = content.selectionEnd;
      const selected = content.value.slice(start, end) || "Your text";
      const blockPrefix =
        start > 0 && content.value[start - 1] !== "\n" ? "\n" : "";
      const formats = {
        heading: [`${blockPrefix}## `, ""],
        bold: ["**", "**"],
        italic: ["*", "*"],
        list: [`${blockPrefix}- `, ""],
        quote: [`${blockPrefix}> `, ""],
      };
      const [before, after] = formats[button.dataset.format];
      const replacement = before + selected + after;
      if (
        content.value.length - (end - start) + replacement.length >
        content.maxLength
      )
        return;
      content.setRangeText(replacement, start, end, "select");
      content.focus();
      content.setSelectionRange(
        start + before.length,
        start + before.length + selected.length,
      );
      content.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }
  updateCount();
}
document.querySelector("[data-error-summary]")?.focus();
