// Assemble a reviewed, static-only public preview from the SHAH CAT site.
// This build NEVER packages the Node server, wallet/dashboard, Treasury or config.
import assert from "node:assert/strict";
import { copyFile, lstat, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const defaultSource = join(root, "site");
const defaultOutput = join(root, "dist", "public-site");

export const PUBLIC_FILES = Object.freeze(["index.html", "site.css", "site.js", "logo.png"]);
const BLOCKS = Object.freeze({
  html: [
    ["<!-- LOCAL_WORKSPACE_NAV_START -->", "<!-- LOCAL_WORKSPACE_NAV_END -->"],
    ["<!-- LOCAL_WORKSPACE_PANEL_START -->", "<!-- LOCAL_WORKSPACE_PANEL_END -->"],
  ],
  js: [
    ["// LOCAL_WORKSPACE_JS_START", "// LOCAL_WORKSPACE_JS_END"],
  ],
});

function stripExactlyOne(input, start, end) {
  const first = input.indexOf(start);
  assert.ok(first >= 0, "Missing public-site boundary: " + start);
  assert.equal(input.indexOf(start, first + start.length), -1, "Duplicate boundary: " + start);
  const last = input.indexOf(end, first + start.length);
  assert.ok(last >= 0, "Missing public-site boundary: " + end);
  assert.equal(input.indexOf(end, last + end.length), -1, "Duplicate boundary: " + end);
  return input.slice(0, first) + input.slice(last + end.length);
}

function validateHtml(html) {
  assert.match(html, /Solana Devnet/, "Devnet disclosure required");
  assert.match(html, /v0\.6/, "Documentation version required");
  assert.match(html, /v0\.5/, "Runtime version disclosure required");
  assert.match(html, /Mainnet/, "Mainnet status disclaimer required");
  const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]));
  assert.equal(ids.size, [...html.matchAll(/\bid="([^"]+)"/g)].length, "Duplicate DOM IDs");

  const assets = new Set(PUBLIC_FILES);
  for (const match of html.matchAll(/\b(?:href|src)\s*=\s*"([^"]+)"/g)) {
    const url = match[1];
    if (url.startsWith("#")) {
      assert.ok(ids.has(url.slice(1)), "Unresolved in-page link: " + url);
    } else if (url === "./") {
      continue;
    } else if (url.startsWith("./")) {
      assert.ok(assets.has(url.slice(2)), "Unapproved relative asset: " + url);
    } else if (url.startsWith("https://")) {
      const host = new URL(url).hostname;
      assert.ok(["github.com", "explorer.solana.com"].includes(host), "Unapproved outbound link: " + host);
    } else {
      assert.fail("Forbidden public-site reference: " + url);
    }
  }
}

function assertPublicOnly(html, js, css) {
  for (const [label, input] of [["HTML", html], ["JavaScript", js], ["CSS", css]]) {
    assert.doesNotMatch(input, /(?:\/api\/|\/treasury\.html|127\.0\.0\.1|localhost|TREASURY_CONFIG|PRIVATE_KEY|seedPhrase)/i,
      label + " includes local/admin information");
    assert.doesNotMatch(input, /LOCAL_WORKSPACE_(?:NAV|PANEL|JS)_(?:START|END)|data-local-only/i,
      label + " still includes local-only markup");
  }
}

export async function buildPublicSite({ sourceDir = defaultSource, outputDir = defaultOutput } = {}) {
  const source = resolve(sourceDir);
  const output = resolve(outputDir);
  assert.notEqual(source, output, "Source and output must be different directories");
  assert.equal(basename(output), "public-site", "Output directory must be named public-site");
  assert.ok(!source.startsWith(output + sep) && !output.startsWith(source + sep), "Do not nest source and output");

  const entries = await readdir(source, { withFileTypes: true });
  assert.deepEqual(
    entries.map(entry => entry.name).sort(),
    [...PUBLIC_FILES].sort(),
    "Public site source must contain only the four reviewed files"
  );
  for (const entry of entries) {
    assert.ok(entry.isFile() && !entry.isSymbolicLink(), "Non-regular public-site asset: " + entry.name);
    const stat = await lstat(join(source, entry.name));
    assert.ok(stat.size > 0 && stat.size < 5 * 1024 * 1024, "Public-site file size outside limit: " + entry.name);
  }

  let html = await readFile(join(source, "index.html"), "utf8");
  let js = await readFile(join(source, "site.js"), "utf8");
  const css = await readFile(join(source, "site.css"), "utf8");
  const png = await readFile(join(source, "logo.png"));
  assert.equal(png.subarray(0, 8).toString("hex"), "89504e470d0a1a0a", "Invalid PNG logo");

  for (const [start, end] of BLOCKS.html) html = stripExactlyOne(html, start, end);
  for (const [start, end] of BLOCKS.js) js = stripExactlyOne(js, start, end);
  validateHtml(html);
  assertPublicOnly(html, js, css);

  // Keep the generated output independent of the local Node server.
  await rm(output, { recursive: true, force: true });
  await mkdir(output, { recursive: true });
  await Promise.all([
    writeFile(join(output, "index.html"), html, "utf8"),
    writeFile(join(output, "site.js"), js, "utf8"),
    copyFile(join(source, "site.css"), join(output, "site.css")),
    copyFile(join(source, "logo.png"), join(output, "logo.png")),
  ]);
  const results = (await readdir(output)).sort();
  assert.deepEqual(results, [...PUBLIC_FILES].sort(), "Public-site output must contain only approved files");
  return { outputDir: output, files: results };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  buildPublicSite().then(result => {
    console.log("SHAH CAT static preview ready: " + result.outputDir);
    console.log("Files: " + result.files.join(", "));
    console.log("Not deployed. Local Treasury/server code is not included.");
  }).catch(error => {
    console.error("Public-site preview build rejected: " + error.message);
    process.exitCode = 1;
  });
}
