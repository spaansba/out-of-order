#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { chromium } from "playwright";
import type { AuditResult, Violation } from "@out-of-order/core";

type OooGlobal = {
  audit: (root: Document) => AuditResult;
  formatViolations: (violations: Violation[]) => string;
};

const USAGE = `out-of-order <url> [options]

  --json               Emit findings as JSON (grouped by rule) instead of text.
  --wait <selector>    Wait for a selector before auditing (JS-heavy pages).
  --help               Show this message.`;

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    json: { type: "boolean", default: false },
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

const here = dirname(fileURLToPath(import.meta.url));
const injectSource = readFileSync(join(here, "inject.global.js"), "utf8");

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const response = await page.goto(url, { waitUntil: "networkidle" });
  if (response && !response.ok()) {
    throw new Error(`${url} returned HTTP ${response.status()}`);
  }
  if (values.wait) {
    await page.waitForSelector(values.wait);
  }
  await page.addScriptTag({ content: injectSource });

  const out = await page.evaluate(() => {
    const ooo = (window as unknown as { __ooo: OooGlobal }).__ooo;
    const result = ooo.audit(document);
    // Group by element identity here, where it still exists: selectors aren't
    // unique (repeated structures share one), so an array keyed by identity is
    // the only faithful "one entry per element" shape once it crosses to JSON.
    const byElement = new Map<
      Element,
      {
        selector: string;
        orderIndex?: number;
        findings: {
          rule: string;
          severity: string;
          message: string;
          docs?: string;
        }[];
      }
    >();
    for (const v of result.violations) {
      let entry = byElement.get(v.element);
      if (!entry) {
        entry = { selector: v.selector, orderIndex: v.orderIndex, findings: [] };
        byElement.set(v.element, entry);
      }
      entry.findings.push({
        rule: v.rule,
        severity: v.severity,
        message: v.message,
        docs: v.docs,
      });
    }
    return {
      report: ooo.formatViolations(result.violations),
      hasError: result.violations.some((v) => v.severity === "error"),
      elements: [...byElement.values()],
    };
  });

  process.stdout.write(
    (values.json ? JSON.stringify(out.elements, null, 2) : out.report) + "\n",
  );
  process.exitCode = out.hasError ? 1 : 0;
} catch (err) {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
  process.exitCode = 2;
} finally {
  await browser.close();
}
