import test from "node:test";
import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Script } from "node:vm";
import { buildPublicSite, PUBLIC_FILES } from "../scripts/build-public-site.mjs";

const siteDir = join(dirname(fileURLToPath(import.meta.url)), "..", "site");
async function tempWorkspace(t) {
  const temp = await mkdtemp(join(tmpdir(), "shah-cat-public-site-"));
  t.after(async () => { await rm(temp, { recursive: true, force: true }); });
  return temp;
}

test("static release includes exactly the four approved files, with no local tools", async t => {
  const tmp = await tempWorkspace(t);
  const { outputDir, files } = await buildPublicSite({ outputDir: join(tmp, "public-site") });
  assert.deepEqual(files, [...PUBLIC_FILES].sort());
  assert.deepEqual((await readdir(outputDir)).sort(), [...PUBLIC_FILES].sort());
  const html = await readFile(join(outputDir, "index.html"), "utf8");
  const js = await readFile(join(outputDir, "site.js"), "utf8");
  const png = await readFile(join(outputDir, "logo.png"));
  assert.equal(png.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  assert.match(html, /SHAH CAT/);
  assert.match(html, /Solana Devnet/);
  assert.match(html, /v0\.6/);
  assert.match(html, /v0\.5/);
  for (const content of [html, js]) {
    assert.doesNotMatch(content, /data-local-only|LOCAL_WORKSPACE|\/treasury\.html|\/api\/|localhost|127\.0\.0\.1|TREASURY_CONFIG/i);
  }
  assert.doesNotThrow(() => new Script(js));
  const srcHTML = await readFile(join(siteDir, "index.html"), "utf8");
  assert.match(srcHTML, /\/treasury\.html/); // Local developer UX remains in the source.
  assert.match(srcHTML, /data-local-only hidden/);
});

test("the public site build fails closed when an unreviewed file exists", async t => {
  const tmp = await tempWorkspace(t);
  const sourceDir = join(tmp, "source");
  await cp(siteDir, sourceDir, { recursive: true });
  await writeFile(join(sourceDir, "treasury.html"), "<h1>SHOULD NEVER SHIP</h1>");
  await assert.rejects(buildPublicSite({ sourceDir, outputDir: join(tmp, "public-site") }),
    /only the four reviewed files/);
});

test("the release build fails closed if local-only markers are edited", async t => {
  const tmp = await tempWorkspace(t);
  const sourceDir = join(tmp, "source");
  await cp(siteDir, sourceDir, { recursive: true });
  const path = join(sourceDir, "index.html");
  const original = await readFile(path, "utf8");
  await writeFile(path, original.replace("<!-- LOCAL_WORKSPACE_PANEL_END -->", ""), "utf8");
  await assert.rejects(buildPublicSite({ sourceDir, outputDir: join(tmp, "public-site") }),
    /Missing public-site boundary/);
});

test("the release build rejects unsafe or broken navigation links", async t => {
  const tmp = await tempWorkspace(t);
  const sourceDir = join(tmp, "source");
  await cp(siteDir, sourceDir, { recursive: true });
  const path = join(sourceDir, "index.html");
  const original = await readFile(path, "utf8");
  await writeFile(path, original.replace('href="#about"', 'href="/treasury.html"'), "utf8");
  await assert.rejects(buildPublicSite({ sourceDir, outputDir: join(tmp, "public-site") }),
    /Forbidden public-site reference/);
  await writeFile(path, original.replace('href="#about"', 'href="#missing-section"'), "utf8");
  await assert.rejects(buildPublicSite({ sourceDir, outputDir: join(tmp, "public-site") }),
    /Unresolved in-page link/);
  await writeFile(path, original.replace('href="#about"', 'href="javascript:alert(1)"'), "utf8");
  await assert.rejects(buildPublicSite({ sourceDir, outputDir: join(tmp, "public-site") }),
    /Forbidden public-site reference/);
});
