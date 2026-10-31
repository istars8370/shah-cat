import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";

const code = await readFile(join(dirname(fileURLToPath(import.meta.url)), "..", "site", "site.js"), "utf8");

function environment({ hostname = "shah.example", pathname = "/", clipboardAvailable = true } = {}) {
  const listeners = Object.create(null);
  const classes = new Set();
  const rootClasses = new Set();
  const copied = [];
  const attributes = Object.create(null);
  const localElements = [{ hidden: true }, { hidden: true }];
  const year = { textContent: "" };
  const status = { textContent: "" };
  const mint = { textContent: "82Q5cipk2W2CM3CDizakXuZgrKS6WpK3zaDe7vqi6bh2" };
  const nav = {
    classList: {
      contains: name => classes.has(name),
      remove: name => classes.delete(name),
      toggle: (name, value) => {
        if (value === undefined) value = !classes.has(name);
        if (value) classes.add(name);
        else classes.delete(name);
        return value;
      },
    },
    addEventListener: (name, fn) => { listeners["nav:" + name] = fn; },
  };
  const menu = {
    focused: false,
    setAttribute: (name, value) => { attributes[name] = value; },
    addEventListener: (name, fn) => { listeners["menu:" + name] = fn; },
    focus() { this.focused = true; },
  };
  const copyButton = {
    addEventListener: (name, fn) => { listeners["copy:" + name] = fn; },
  };
  const document = {
    documentElement: { classList: { add(name) { rootClasses.add(name); } } },
    getElementById(name) {
      return ({ siteNav: nav, year, copyStatus: status, mintValue: mint })[name] ?? null;
    },
    querySelector(name) {
      return ({ ".menu-toggle": menu, "[data-copy-mint]": copyButton })[name] ?? null;
    },
    querySelectorAll(name) {
      return name === "[data-local-only]" ? localElements : [];
    },
    addEventListener(name, fn) { listeners["document:" + name] = fn; },
  };
  const navigator = clipboardAvailable ? {
    clipboard: { async writeText(value) { copied.push(value); } },
  } : {};
  runInNewContext(code, { document, navigator, location: { hostname, pathname }, Date });
  return { listeners, classes, rootClasses, nav, menu, year, status, attributes, copied, localElements, mint };
}

test("mobile navigation opens, closes, and Escape returns keyboard focus", () => {
  const x = environment();
  assert.ok(x.rootClasses.has("js-enabled"));
  assert.equal(x.year.textContent.length, 4);
  x.listeners["menu:click"]();
  assert.ok(x.classes.has("is-open"));
  assert.equal(x.attributes["aria-expanded"], "true");
  assert.equal(x.attributes["aria-label"], "메뉴 닫기");

  x.listeners["document:keydown"]({ key: "Escape" });
  assert.ok(!x.classes.has("is-open"));
  assert.equal(x.attributes["aria-expanded"], "false");
  assert.equal(x.menu.focused, true);

  x.listeners["menu:click"]();
  x.listeners["nav:click"]({ target: { closest: selector => selector === "a" ? {} : null } });
  assert.ok(!x.classes.has("is-open"));
  assert.equal(x.attributes["aria-label"], "메뉴 열기");
});

test("local developer links activate only on local /site routes", () => {
  for (const [hostname, pathname, expected] of [
    ["127.0.0.1", "/site/", true],
    ["localhost", "/site/index.html", true],
    ["localhost", "/", false],
    ["localhost", "/other", false],
    ["shah.example", "/site/", false],
  ]) {
    const x = environment({ hostname, pathname });
    assert.deepEqual(x.localElements.map(e => e.hidden), [!expected, !expected], hostname + pathname);
  }
});

test("copy button only copies the Devnet mint address after an explicit click", async () => {
  const x = environment();
  assert.equal(x.copied.length, 0);
  await x.listeners["copy:click"]();
  assert.deepEqual(x.copied, [x.mint.textContent]);
  assert.match(x.status.textContent, /복사했습니다/);
});

test("clipboard absence reports an error instead of claiming success", async () => {
  const x = environment({ clipboardAvailable: false });
  await x.listeners["copy:click"]();
  assert.match(x.status.textContent, /복사 실패/);
});
