import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const site = name => readFile(join(here, "..", "site", name), "utf8");

test("official homepage keeps its public information architecture", async () => {
  const html = await site("index.html");
  for (const id of ["main", "about", "progress", "ecosystem", "resources", "disclosure"]) {
    assert.match(html, new RegExp('id="' + id + '"'));
  }
  assert.match(html, /Solana Devnet/);
  assert.match(html, /Mainnet/);
  assert.match(html, /토크노믹스 v0\.6/);
  assert.match(html, /v0\.5/);
  assert.doesNotMatch(html, /type="password"/);
  assert.doesNotMatch(html, /시드 구문 입력|개인키 입력/);
});

test("developer shortcuts remain hidden in public markup and local-only in JavaScript", async () => {
  const [html, js] = await Promise.all([site("index.html"), site("site.js")]);
  assert.equal((html.match(/data-local-only hidden/g) || []).length, 2);
  assert.match(html, /<a href="\/" class="nav-dashboard" data-local-only hidden>/);
  assert.match(html, /<aside class="local-tools shell" data-local-only hidden/);
  assert.match(html, /<details class="local-details">/);
  assert.match(html, /href="\/treasury\.html"/);
  assert.match(js, /document\.querySelectorAll\('\[data-local-only\]'\)/);
  assert.match(js, /127\.0\.0\.1/);
  assert.match(js, /location\.pathname\.startsWith\('\/site\/'\)/);
});

test("layout refinements keep readable typography and mobile support", async () => {
  const css = await site("site.css");
  assert.match(css, /v0\.2 — readability/);
  assert.match(css, /\.feature-card p \{ font-size: 14px/);
  assert.match(css, /\.hero-lead \{ font-size: 16px/);
  assert.match(css, /\.local-details/);
  assert.match(css, /@media \(max-width: 720px\)/);
  assert.match(css, /prefers-reduced-motion/);
});
