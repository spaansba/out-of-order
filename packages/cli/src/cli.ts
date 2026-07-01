#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { chromium, type Page } from "playwright";
import type { AuditFormat, AuditResult, Formatted } from "@out-of-order/core";

type OooGlobal = {
  audit: <F extends AuditFormat>(
    root: Document,
    options: { format: F },
  ) => AuditResult<Formatted<F>>;
};

const FORMATS = [
  "by-element",
  "text",
] as const satisfies readonly AuditFormat[];

const USAGE = `out-of-order <url> [options]

  --format <name>      Output shape: ${FORMATS.join(" | ")} (default: text).
  --overlay            Open a headed browser with the visual overlay; Ctrl-C to quit.
  --wait <selector>    Wait for a selector before auditing (JS-heavy pages).
  --help               Show this message.`;

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    format: { type: "string", default: "text" },
    overlay: { type: "boolean", default: false },
    wait: { type: "string" },
    help: { type: "boolean", default: false },
  },
});

if (values.help) {
  process.stdout.write(USAGE + "\n");
  process.exit(0);
}

const url = positionals[0];
if (!url) {
  process.stderr.write(USAGE + "\n");
  process.exit(2);
}

const format = values.format as AuditFormat;
if (!FORMATS.includes(format)) {
  process.stderr.write(`Unknown --format "${format}".\n${USAGE}\n`);
  process.exit(2);
}

const here = dirname(fileURLToPath(import.meta.url));

async function open(page: Page, targetUrl: string) {
  const response = await page.goto(targetUrl, { waitUntil: "networkidle" });
  if (response && !response.ok()) {
    return response;
  }
  if (values.wait) {
    await page.waitForSelector(values.wait);
  }
  return response;
}

if (values.overlay) {
  const overlaySource = readFileSync(
    join(here, "inject-overlay.global.js"),
    "utf8",
  );
  const browser = await chromium.launch({ headless: false });
  // viewport:null uses the real window size; bypassCSP lets the overlay's <style>
  // and script through on strict sites.
  const context = await browser.newContext({
    viewport: null,
    bypassCSP: true,
  });
  const page = await context.newPage();
  await page.addInitScript({ content: overlaySource });
  const response = await open(page, url);
  if (response && !response.ok()) {
    process.stderr.write(`${url} returned HTTP ${response.status()}\n`);
    await browser.close();
    process.exit(2);
  }
  process.stderr.write("Overlay mounted. Ctrl-C to quit.\n");
  await new Promise<void>((resolve) => {
    browser.on("disconnected", () => resolve());
    process.on("SIGINT", () => resolve());
  });
  await browser.close().catch(() => {});
  process.exit(0);
}

const injectSource = readFileSync(join(here, "inject.global.js"), "utf8");

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.addInitScript({ content: injectSource });
  const response = await open(page, url);
  if (response && !response.ok()) {
    throw new Error(`${url} returned HTTP ${response.status()}`);
  }
  const out = await page.evaluate((fmt) => {
    const ooo = (window as unknown as { __ooo: OooGlobal }).__ooo;
    const result = ooo.audit(document, { format: fmt });
    const violations = result.violations;
    const output =
      typeof violations === "string"
        ? violations
        : JSON.stringify(violations, null, 2);
    return { output, valid: result.valid };
  }, format);

  process.stdout.write(out.output + "\n");
  process.exitCode = out.valid ? 0 : 1;
} catch (err) {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
  process.exitCode = 2;
} finally {
  await browser.close();
}
