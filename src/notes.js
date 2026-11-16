const KEY = "posturelab.interpretation.v1";
const allowed = new Set(["P", "DIV", "BR", "STRONG", "B", "EM", "I", "U", "UL", "OL", "LI"]);

// Rebuild a small text-only vocabulary. No attributes, URLs, media or scripts survive.
export function cleanNotes(html) {
  const source = document.createElement("template");
  source.innerHTML = html;
  const output = document.createElement("div");
  function copy(node, parent) {
    if (node.nodeType === Node.TEXT_NODE) return parent.append(document.createTextNode(node.textContent));
    if (node.nodeType !== Node.ELEMENT_NODE || ["SCRIPT", "STYLE", "IFRAME", "OBJECT", "SVG", "MATH"].includes(node.tagName)) return;
    const target = allowed.has(node.tagName) ? document.createElement(node.tagName.toLowerCase()) : parent;
    if (target !== parent) parent.append(target);
    for (const child of node.childNodes) copy(child, target);
  }
  for (const node of source.content.childNodes) copy(node, output);
  return output.innerHTML;
}

export function noteBlocks(html) {
  const root = document.createElement("div");
  root.innerHTML = cleanNotes(html);
  const blocks = [];
  let runs = [], prefix = "";
  function flush() {
    if (runs.some(r => r.text.trim())) blocks.push({ prefix, runs });
    runs = [];
    prefix = "";
  }
  function walk(node, style = {}) {
    if (node.nodeType === Node.TEXT_NODE) {
      runs.push({ text: node.textContent.replace(/\r?\n/g, " "), ...style });
      return;
    }
    const tag = node.nodeName;
    if (["P", "DIV", "LI", "BR", "UL", "OL"].includes(tag)) flush();
    if (tag === "LI") {
      prefix = node.parentElement.tagName === "OL"
        ? [...node.parentElement.children].indexOf(node) + 1 + ". " : "- ";
    }
    const next = { ...style };
    if (["B", "STRONG"].includes(tag)) next.bold = true;
    if (["I", "EM"].includes(tag)) next.italic = true;
    if (tag === "U") next.underline = true;
    for (const child of node.childNodes) walk(child, next);
    if (["P", "DIV", "LI", "UL", "OL"].includes(tag)) flush();
  }
  for (const node of root.childNodes) walk(node);
  flush();
  return blocks;
}

export function setupNotes(onChange) {
  const editor = document.querySelector("#interpretation");
  const status = document.querySelector("#notes-status");
  const code = document.querySelector("#code");
  let timer, dirty = false, savedAt = null;
  function snapshot() {
    const html = cleanNotes(editor.innerHTML);
    const blocks = noteBlocks(html);
    return { html, blocks, text: blocks.map(b => b.prefix + b.runs.map(r => r.text).join("")).join("\n"), savedAt };
  }
  function save() {
    clearTimeout(timer);
    if (!dirty) return;
    try {
      const notes = snapshot();
      savedAt = new Date().toISOString();
      localStorage.setItem(KEY, JSON.stringify({ version: 1, html: notes.html, studyCode: code.value, savedAt }));
      dirty = false;
      status.textContent = "Saved on this device at " + new Date(savedAt).toLocaleTimeString() + ".";
      status.classList.remove("save-error");
    } catch {
      status.textContent = "Draft could not be saved on this device. Keep this tab open and download PDF or JSON to keep your notes.";
      status.classList.add("save-error");
    }
  }
  function changed() {
    dirty = true;
    status.textContent = "Unsaved changes…";
    clearTimeout(timer);
    timer = setTimeout(save, 1000);
    onChange();
  }
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const draft = JSON.parse(raw);
      if (draft.version !== 1 || typeof draft.html !== "string") throw Error("Invalid draft");
      editor.innerHTML = cleanNotes(draft.html);
      code.value = typeof draft.studyCode === "string" ? draft.studyCode.slice(0, 60) : "";
      savedAt = typeof draft.savedAt === "string" ? draft.savedAt : null;
      status.textContent = "Draft restored on this device. Check the study code before continuing; photographs were not saved.";
    }
  } catch {
    status.textContent = "Local draft storage is unavailable or unreadable. Download PDF or JSON to keep your notes.";
    status.classList.add("save-error");
  }
  editor.addEventListener("input", changed);
  code.addEventListener("input", changed);
  editor.addEventListener("blur", save);
  // Paste as text: pasted web content must never import remote images or hidden markup.
  editor.addEventListener("paste", event => {
    event.preventDefault();
    document.execCommand("insertText", false, event.clipboardData.getData("text/plain"));
    changed();
  });
  editor.addEventListener("drop", event => event.preventDefault());
  document.querySelectorAll("[data-note-command]").forEach(button => {
    button.addEventListener("mousedown", e => e.preventDefault());
    button.onclick = () => {
      editor.focus();
      document.execCommand(button.dataset.noteCommand, false);
      changed();
    };
  });
  setInterval(save, 30000);
  window.addEventListener("pagehide", save);
  document.addEventListener("visibilitychange", () => { if (document.hidden) save(); });
  function clear() {
    clearTimeout(timer);
    editor.innerHTML = "";
    savedAt = null;
    dirty = false;
    try {
      localStorage.removeItem(KEY);
      status.textContent = "Draft cleared from this device.";
      status.classList.remove("save-error");
    } catch {
      status.textContent = "Notes cleared here, but the saved draft could not be removed. Clear this site's browser data before sharing this device.";
      status.classList.add("save-error");
    }
    onChange();
  }
  document.querySelector("#clear-notes").onclick = clear;
  return { snapshot, save, clear };
}
