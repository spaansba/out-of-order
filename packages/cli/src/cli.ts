#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { chromium, type Browser } from "playwright";
import {
  DEFAULT_SEVERITY,
  type AuditFormat,
  type AuditOptions,
  type RuleId,
  type RuleOverride,
} from "@out-of-order/core";

type OooGlobal = {
  audit: typeof import("@out-of-order/core").audit;
  formatViolations: typeof import("@out-of-order/core").formatViolations;
};

const CORE_FORMATS = [
  "text",
  "by-element",
  "by-violation",
  "flat",
] as const satisfies readonly AuditFormat[];
// "json" is CLI-only: the whole result (valid, sequence, violations), not a
// violations reshape, so core's formatViolations doesn't know it.
const FORMATS = [...CORE_FORMATS, "json"] as const;
type CliFormat = (typeof FORMATS)[number];

const USAGE = `out-of-order <url> [options]
out-of-order login <url> [--auth <file>]

  <url> also accepts a bare domain (https:// is assumed, http:// for
  localhost) or a path to a local HTML file.

  login opens a headed browser; sign in there, then press Ctrl-C to save
  the session. Later audits of that host use it automatically.

  --format <name>      Output shape: ${FORMATS.join(" | ")} (default: text).
                       json is the full result: valid, tab sequence, violations.
  --rule <id>=<level>  Set a rule to off, error, or warning. Repeatable.
  --auth <file>        Storage-state file to save (login) or load (audit).
                       Default: per-host file under ~/.config/out-of-order/auth.
  --wait <selector>    Wait for a selector before auditing (JS-heavy pages).
  --timeout <ms>       Navigation and selector timeout (default: 30000).
  --viewport <WxH>     Viewport size, e.g. 1440x900.
  --overlay            Open a headed browser with the visual overlay; Ctrl-C to quit.
  --version            Print the version.
  --help               Show this message.`;

function fail(message: string): never {
  process.stderr.write(`${message}\n\n${USAGE}\n`);
  process.exit(2);
}

function parseCliArgs() {
  try {
    return parseArgs({
      allowPositionals: true,
      options: {
        format: { type: "string" },
        rule: { type: "string", multiple: true },
        auth: { type: "string" },
        wait: { type: "string" },
        timeout: { type: "string" },
        viewport: { type: "string" },
        overlay: { type: "boolean", default: false },
        version: { type: "boolean", default: false },
        help: { type: "boolean", default: false },
      },
    });
  } catch (err) {
    return fail(err instanceof Error ? err.message : String(err));
  }
}

const { values, positionals } = parseCliArgs();

const here = dirname(fileURLToPath(import.meta.url));

if (values.help) {
  process.stdout.write(USAGE + "\n");
  process.exit(0);
}

if (values.version) {
  const pkg = JSON.parse(readFileSync(join(here, "..", "package.json"), "utf8")) as {
    version: string;
  };
  process.stdout.write(pkg.version + "\n");
  process.exit(0);
}

if (positionals.length === 0) {
  process.stderr.write(USAGE + "\n");
  process.exit(2);
}
const isLogin = positionals[0] === "login";
const urlArgs = isLogin ? positionals.slice(1) : positionals;
if (urlArgs.length === 0) {
  fail("login expects a <url>.");
}
if (urlArgs.length > 1) {
  fail(`Expected a single <url>, got ${urlArgs.length}: ${urlArgs.join(", ")}.`);
}
const url = toUrl(urlArgs[0]!);

if (isLogin && (values.overlay || values.format || values.rule || values.wait)) {
  fail("login only accepts --auth, --timeout, and --viewport.");
}
if (values.overlay && values.format) {
  fail(
    "--format cannot be combined with --overlay; the overlay draws on the page instead of printing.",
  );
}
const format = (values.format ?? "text") as CliFormat;
if (!FORMATS.includes(format)) {
  fail(`Unknown --format "${values.format}". Expected one of: ${FORMATS.join(", ")}.`);
}

const rules = parseRuleOverrides(values.rule);
const timeout = parseTimeout(values.timeout);
const viewport = parseViewport(values.viewport);

function toUrl(input: string): string {
  if (input.includes("://") || input.startsWith("file:")) {
    return input;
  }
  if (existsSync(input)) {
    return pathToFileURL(resolve(input)).href;
  }
  const scheme = /^(localhost|127\.0\.0\.1|\[::1\])([:/?#]|$)/.test(input) ? "http" : "https";
  return `${scheme}://${input}`;
}

function parseRuleOverrides(entries: string[] | undefined): AuditOptions["rules"] {
  if (!entries?.length) {
    return undefined;
  }
  const overrides: Partial<Record<RuleId, RuleOverride>> = {};
  for (const entry of entries) {
    const match = /^(.+)=(off|error|warning)$/.exec(entry);
    if (!match) {
      fail(`Invalid --rule "${entry}". Expected <id>=<off|error|warning>.`);
    }
    const id = match[1]!;
    if (!(id in DEFAULT_SEVERITY)) {
      fail(`Unknown rule "${id}". Known rules:\n  ${Object.keys(DEFAULT_SEVERITY).join("\n  ")}`);
    }
    overrides[id as RuleId] = match[2] as RuleOverride;
  }
  return overrides;
}

function parseTimeout(raw: string | undefined): number | undefined {
  if (raw === undefined) {
    return undefined;
  }
  const ms = Number(raw);
  if (!Number.isInteger(ms) || ms <= 0) {
    fail(`Invalid --timeout "${raw}". Expected a positive number of milliseconds.`);
  }
  return ms;
}

function parseViewport(raw: string | undefined): { width: number; height: number } | undefined {
  if (raw === undefined) {
    return undefined;
  }
  const match = /^([1-9]\d*)x([1-9]\d*)$/.exec(raw);
  if (!match) {
    fail(`Invalid --viewport "${raw}". Expected <width>x<height>, e.g. 1440x900.`);
  }
  return { width: Number(match[1]), height: Number(match[2]) };
}

function defaultAuthPath(target: string): string | undefined {
  const { protocol, host } = new URL(target);
  if (protocol !== "http:" && protocol !== "https:") {
    return undefined;
  }
  const configDir = process.env.XDG_CONFIG_HOME || join(homedir(), ".config");
  return join(configDir, "out-of-order", "auth", `${host.replace(":", "_")}.json`);
}

function resolveAuth(): { save: string | undefined; load: string | undefined } {
  const path = values.auth ?? defaultAuthPath(url);
  if (isLogin) {
    if (!path) {
      fail("login needs an http(s) <url>.");
    }
    return { save: path, load: undefined };
  }
  if (values.auth && !existsSync(values.auth)) {
    fail(`--auth file not found: ${values.auth}. Create one with: out-of-order login <url>`);
  }
  return { save: undefined, load: path && existsSync(path) ? path : undefined };
}

const auth = resolveAuth();

let browser: Browser | undefined;
try {
  const headed = values.overlay || isLogin;
  // Playwright's own SIGINT handler would kill the browser before the
  // session can be saved.
  browser = await chromium.launch({ headless: !headed, handleSIGINT: !isLogin });

  // Headless Chromium advertises "HeadlessChrome" in its UA. Backends that reject
  // it serve the audit a login or block page the headed overlay never sees, so
  // headless runs present the UA a headed run would.
  let userAgent: string | undefined;
  if (!headed) {
    const probe = await browser.newPage();
    userAgent = (await probe.evaluate(() => navigator.userAgent)).replace(
      "HeadlessChrome",
      "Chrome",
    );
    await probe.close();
  }
  // viewport:null uses the real window size; bypassCSP lets the overlay's <style>
  // and script through on strict sites.
  const context = await browser.newContext(
    headed
      ? { viewport: viewport ?? null, bypassCSP: values.overlay, storageState: auth.load }
      : { viewport, storageState: auth.load, userAgent },
  );
  if (timeout !== undefined) {
    context.setDefaultTimeout(timeout);
  }
  const page = await context.newPage();
  if (!isLogin) {
    if (values.overlay && rules) {
      await page.addInitScript({
        content: `globalThis.__oooAuditOptions = { rules: ${JSON.stringify(rules)} };`,
      });
    }
    const bundle = values.overlay ? "inject-overlay.global.js" : "inject.global.js";
    await page.addInitScript({ content: readFileSync(join(here, bundle), "utf8") });
  }

  const response = await page.goto(url, { waitUntil: "load" });
  // login is allowed to land on a 401/403: that is the page you sign in on.
  if (!isLogin && response && !response.ok()) {
    throw new Error(`${url} returned HTTP ${response.status()}`);
  }
  if (values.wait) {
    await page.waitForSelector(values.wait);
  }

  if (isLogin) {
    const savePath = auth.save!;
    process.stderr.write("Log in in the browser, then press Ctrl-C here to save the session.\n");
    const interrupted = await new Promise<boolean>((done) => {
      browser?.on("disconnected", () => done(false));
      process.on("SIGINT", () => done(true));
    });
    if (!interrupted) {
      throw new Error(
        "Browser closed before the session was saved. Run login again and quit with Ctrl-C.",
      );
    }
    mkdirSync(dirname(savePath), { recursive: true });
    await context.storageState({ path: savePath });
    process.stderr.write(
      `Session saved to ${savePath}. Audits of ${new URL(url).host} use it automatically.\n`,
    );
  } else if (values.overlay) {
    process.stderr.write("Overlay mounted. Ctrl-C to quit.\n");
    await new Promise<void>((done) => {
      browser?.on("disconnected", () => done());
      process.on("SIGINT", () => done());
    });
  } else {
    const out = await page.evaluate(
      ({ format, rules }) => {
        const ooo = (window as unknown as { __ooo: OooGlobal }).__ooo;
        const result = ooo.audit(document, { rules });
        let output: string;
        if (format === "json") {
          const sequence = result.sequence.map((entry) => ({
            selector: entry.selector,
            orderIndex: entry.orderIndex,
            tabIndex: entry.tabIndex,
            rect: {
              x: entry.rect.x,
              y: entry.rect.y,
              width: entry.rect.width,
              height: entry.rect.height,
            },
          }));
          output = JSON.stringify(
            {
              valid: result.valid,
              sequence,
              violations: ooo.formatViolations(result, "by-element"),
            },
            null,
            2,
          );
        } else {
          const formatted = ooo.formatViolations(result, format);
          output = typeof formatted === "string" ? formatted : JSON.stringify(formatted, null, 2);
        }
        return { output, valid: result.valid, stops: result.sequence.length };
      },
      { format, rules },
    );

    process.stdout.write(out.output + "\n");
    if (out.stops === 0) {
      process.stderr.write(
        "No tabbable elements found: the audit graded an empty page. " +
          "If the page renders after load (SPA, loading screen), re-run with --wait <selector>.\n",
      );
      process.exitCode = 2;
    } else {
      process.exitCode = out.valid ? 0 : 1;
    }
  }
} catch (err) {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
  process.exitCode = 2;
} finally {
  await browser?.close().catch(() => {});
}
