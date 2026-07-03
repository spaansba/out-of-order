import { execFile } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const CLI = fileURLToPath(new URL("../dist/cli.js", import.meta.url));
const FIXTURES = fileURLToPath(new URL("./fixtures", import.meta.url));

const fixture = (name: string): string => `${FIXTURES}/${name}`;

function run(
  args: string[],
  options: { cwd?: string; env?: Record<string, string> } = {},
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((done) => {
    const env = options.env ? { ...process.env, ...options.env } : undefined;
    execFile("node", [CLI, ...args], { cwd: options.cwd, env }, (error, stdout, stderr) => {
      const code = error ? (typeof error.code === "number" ? error.code : 1) : 0;
      done({ code, stdout, stderr });
    });
  });
}

function storageState(host: string): string {
  return JSON.stringify({
    cookies: [
      {
        name: "session",
        value: "secret",
        domain: host,
        path: "/",
        expires: -1,
        httpOnly: false,
        secure: false,
        sameSite: "Lax",
      },
    ],
    origins: [],
  });
}

async function withServer(
  handler: (req: IncomingMessage, res: ServerResponse) => void,
  body: (origin: string) => Promise<void>,
): Promise<void> {
  const server = createServer(handler);
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("no server port");
  }
  try {
    await body(`http://127.0.0.1:${address.port}`);
  } finally {
    server.close();
  }
}

function withCookieServer(body: (origin: string) => Promise<void>): Promise<void> {
  return withServer((req, res) => {
    const loggedIn = req.headers.cookie?.includes("session=secret");
    res.setHeader("content-type", "text/html");
    res.end(loggedIn ? "<button>in</button>" : '<button tabindex="3">out</button>');
  }, body);
}

describe("argument handling", () => {
  test("no url prints usage and exits 2", async () => {
    const { code, stderr } = await run([]);
    expect(code).toBe(2);
    expect(stderr).toContain("out-of-order <url>");
  });

  test("unknown flag exits 2 with usage, not a stack trace", async () => {
    const { code, stderr } = await run(["--oops", fixture("clean.html")]);
    expect(code).toBe(2);
    expect(stderr).toContain("--oops");
    expect(stderr).toContain("out-of-order <url>");
    expect(stderr).not.toContain("ERR_PARSE_ARGS");
    expect(stderr).not.toContain("node:internal");
  });

  test("unknown format exits 2", async () => {
    const { code, stderr } = await run([fixture("clean.html"), "--format", "yaml"]);
    expect(code).toBe(2);
    expect(stderr).toContain('Unknown --format "yaml"');
  });

  test("more than one url exits 2", async () => {
    const { code, stderr } = await run([fixture("clean.html"), fixture("errors.html")]);
    expect(code).toBe(2);
    expect(stderr).toContain("single <url>");
  });

  test("unknown rule id exits 2 and lists known rules", async () => {
    const { code, stderr } = await run([fixture("clean.html"), "--rule", "nope=off"]);
    expect(code).toBe(2);
    expect(stderr).toContain('Unknown rule "nope"');
    expect(stderr).toContain("no-positive-tabindex");
  });

  test("malformed rule exits 2", async () => {
    const { code, stderr } = await run([fixture("clean.html"), "--rule", "no-positive-tabindex"]);
    expect(code).toBe(2);
    expect(stderr).toContain("Invalid --rule");
  });

  test("invalid tries exits 2", async () => {
    const { code, stderr } = await run([fixture("clean.html"), "--tries", "0"]);
    expect(code).toBe(2);
    expect(stderr).toContain('Invalid --tries "0"');
  });

  test("invalid timeout exits 2", async () => {
    const { code, stderr } = await run([fixture("clean.html"), "--timeout", "soon"]);
    expect(code).toBe(2);
    expect(stderr).toContain('Invalid --timeout "soon"');
  });

  test("invalid viewport exits 2", async () => {
    const { code, stderr } = await run([fixture("clean.html"), "--viewport", "wide"]);
    expect(code).toBe(2);
    expect(stderr).toContain('Invalid --viewport "wide"');
  });

  test("--format with --overlay exits 2", async () => {
    const { code, stderr } = await run([fixture("clean.html"), "--overlay", "--format", "text"]);
    expect(code).toBe(2);
    expect(stderr).toContain("--format cannot be combined with --overlay");
  });

  test("--version prints a semver", async () => {
    const { code, stdout } = await run(["--version"]);
    expect(code).toBe(0);
    expect(stdout.trim()).toMatch(/^\d+\.\d+\.\d+/);
  });

  test("login without a url exits 2", async () => {
    const { code, stderr } = await run(["login"]);
    expect(code).toBe(2);
    expect(stderr).toContain("login expects a <url>");
  });

  test("login with an audit flag exits 2", async () => {
    const { code, stderr } = await run(["login", "https://example.com", "--format", "json"]);
    expect(code).toBe(2);
    expect(stderr).toContain("login only accepts");
  });

  test("login with a local file exits 2", async () => {
    const { code, stderr } = await run(["login", fixture("clean.html")]);
    expect(code).toBe(2);
    expect(stderr).toContain("login needs an http(s) <url>");
  });

  test("--auth pointing to a missing file exits 2", async () => {
    const { code, stderr } = await run([fixture("clean.html"), "--auth", "/nope/state.json"]);
    expect(code).toBe(2);
    expect(stderr).toContain("--auth file not found");
  });
});

describe("auth", () => {
  test("--auth storage state sends its cookies", async () => {
    await withCookieServer(async (origin) => {
      const dir = mkdtempSync(join(tmpdir(), "ooo-auth-"));
      const authFile = join(dir, "state.json");
      writeFileSync(authFile, storageState("127.0.0.1"));
      try {
        const { code, stdout } = await run([origin, "--auth", authFile]);
        expect(code).toBe(0);
        expect(stdout).toContain("No tab-order issues.");
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });
  });

  test("a saved per-host session is picked up automatically", async () => {
    await withCookieServer(async (origin) => {
      const configDir = mkdtempSync(join(tmpdir(), "ooo-config-"));
      const host = new URL(origin).host.replace(":", "_");
      const authDir = join(configDir, "out-of-order", "auth");
      mkdirSync(authDir, { recursive: true });
      writeFileSync(join(authDir, `${host}.json`), storageState("127.0.0.1"));
      try {
        const { code, stdout } = await run([origin], { env: { XDG_CONFIG_HOME: configDir } });
        expect(code).toBe(0);
        expect(stdout).toContain("No tab-order issues.");
      } finally {
        rmSync(configDir, { recursive: true, force: true });
      }
    });
  });

  test("without a session the same page fails", async () => {
    await withCookieServer(async (origin) => {
      const configDir = mkdtempSync(join(tmpdir(), "ooo-config-"));
      try {
        const { code, stdout } = await run([origin], { env: { XDG_CONFIG_HOME: configDir } });
        expect(code).toBe(1);
        expect(stdout).toContain("no-positive-tabindex");
      } finally {
        rmSync(configDir, { recursive: true, force: true });
      }
    });
  });
});

describe("user agent", () => {
  test("headless audits do not advertise HeadlessChrome", async () => {
    await withServer(
      (req, res) => {
        const headless = req.headers["user-agent"]?.includes("HeadlessChrome");
        res.setHeader("content-type", "text/html");
        res.end(headless ? '<button tabindex="3">blocked</button>' : "<button>in</button>");
      },
      async (origin) => {
        const { code, stdout } = await run([origin]);
        expect(code).toBe(0);
        expect(stdout).toContain("No tab-order issues.");
      },
    );
  });
});

describe("login page detection", () => {
  const serveLogin = (_req: IncomingMessage, res: ServerResponse) => {
    res.setHeader("content-type", "text/html");
    res.end(
      '<form><input aria-label="Email" type="email" />' +
        '<input aria-label="Password" type="password" />' +
        "<button>Sign in</button></form>",
    );
  };

  test("a password field prints a login hint on stderr", async () => {
    await withServer(serveLogin, async (origin) => {
      const configDir = mkdtempSync(join(tmpdir(), "ooo-config-"));
      try {
        const { code, stderr } = await run([origin], { env: { XDG_CONFIG_HOME: configDir } });
        expect(code).toBe(0);
        expect(stderr).toContain("WARNING: This looks like a login page");
        expect(stderr).toContain(`out-of-order login ${origin}`);
      } finally {
        rmSync(configDir, { recursive: true, force: true });
      }
    });
  });

  test("a login-looking URL without a password field prints the hint", async () => {
    await withServer(
      (_req, res) => {
        res.setHeader("content-type", "text/html");
        res.end("<button>Continue</button>");
      },
      async (origin) => {
        const configDir = mkdtempSync(join(tmpdir(), "ooo-config-"));
        try {
          const { stderr } = await run([`${origin}/login`], {
            env: { XDG_CONFIG_HOME: configDir },
          });
          expect(stderr).toContain("looks like a login page");
        } finally {
          rmSync(configDir, { recursive: true, force: true });
        }
      },
    );
  });

  test("the hint mentions expiry when a session was loaded", async () => {
    await withServer(serveLogin, async (origin) => {
      const dir = mkdtempSync(join(tmpdir(), "ooo-auth-"));
      const authFile = join(dir, "state.json");
      writeFileSync(authFile, storageState("127.0.0.1"));
      try {
        const { stderr } = await run([origin, "--auth", authFile]);
        expect(stderr).toContain("may have expired");
        expect(stderr).toContain(`out-of-order login ${origin}`);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });
  });

  test("an ordinary page prints no hint", async () => {
    await withServer(
      (_req, res) => {
        res.setHeader("content-type", "text/html");
        res.end("<button>First</button>");
      },
      async (origin) => {
        const configDir = mkdtempSync(join(tmpdir(), "ooo-config-"));
        try {
          const { code, stderr } = await run([origin], { env: { XDG_CONFIG_HOME: configDir } });
          expect(code).toBe(0);
          expect(stderr).not.toContain("login");
        } finally {
          rmSync(configDir, { recursive: true, force: true });
        }
      },
    );
  });

  test("a local file with a password field prints no hint", async () => {
    const { code, stderr } = await run([fixture("login.html")]);
    expect(code).toBe(0);
    expect(stderr).not.toContain("login page");
  });
});

describe("auditing", () => {
  test("clean page exits 0 with the no-issues message and the stop count", async () => {
    const { code, stdout, stderr } = await run([fixture("clean.html")]);
    expect(code).toBe(0);
    expect(stdout).toContain("No tab-order issues.");
    expect(stderr).toContain("Found 3 tabbable elements.");
  });

  test("page without tabbable elements retries, exits 2, and suggests --wait", async () => {
    const { code, stdout, stderr } = await run([fixture("empty.html")]);
    expect(code).toBe(2);
    expect(stdout).toContain("No tab-order issues.");
    expect(stderr).toContain("Try 1/5: found 0 tabbable elements.");
    expect(stderr).toContain("Try 5/5: found 0 tabbable elements.");
    expect(stderr).toContain("No tabbable elements found");
    expect(stderr).toContain("--wait");
  }, 20000);

  test("--tries overrides the retry count", async () => {
    const { code, stderr } = await run([fixture("empty.html"), "--tries", "2"]);
    expect(code).toBe(2);
    expect(stderr).toContain("Try 2/2: found 0 tabbable elements.");
    expect(stderr).not.toContain("Try 3");
  }, 20000);

  test("a page that renders late is caught by a retry", async () => {
    const { code, stdout, stderr } = await run([fixture("late.html")]);
    expect(code).toBe(0);
    expect(stdout).toContain("No tab-order issues.");
    expect(stderr).toContain("Try 1/5: found 0 tabbable elements.");
    expect(stderr).toContain("Found 1 tabbable element.");
    expect(stderr).not.toContain("Try 5/5");
  }, 20000);

  test("page with errors exits 1 and names the rule", async () => {
    const { code, stdout } = await run([fixture("errors.html")]);
    expect(code).toBe(1);
    expect(stdout).toContain("no-positive-tabindex");
  });

  test("a relative local path is resolved to a file URL", async () => {
    const { code, stdout } = await run(["clean.html"], { cwd: FIXTURES });
    expect(code).toBe(0);
    expect(stdout).toContain("No tab-order issues.");
  });

  test("--format by-element prints parseable JSON", async () => {
    const { code, stdout } = await run([fixture("errors.html"), "--format", "by-element"]);
    expect(code).toBe(1);
    const parsed = JSON.parse(stdout) as { issues: { rule: string }[] }[];
    expect(parsed[0]!.issues[0]!.rule).toBe("no-positive-tabindex");
  });

  test("--format json prints the full result", async () => {
    const { code, stdout } = await run([fixture("errors.html"), "--format", "json"]);
    expect(code).toBe(1);
    const parsed = JSON.parse(stdout) as {
      valid: boolean;
      sequence: { selector: string; tabIndex: number; rect: { width: number } }[];
      violations: unknown[];
    };
    expect(parsed.valid).toBe(false);
    expect(parsed.sequence).toHaveLength(1);
    expect(parsed.sequence[0]!.tabIndex).toBe(1);
    expect(parsed.sequence[0]!.rect.width).toBeGreaterThan(0);
    expect(parsed.violations).toHaveLength(1);
  });

  test("--rule can disable the failing rule", async () => {
    const { code, stdout } = await run([
      fixture("errors.html"),
      "--rule",
      "no-positive-tabindex=off",
    ]);
    expect(code).toBe(0);
    expect(stdout).toContain("No tab-order issues.");
  });

  test("--rule can regrade an error to a warning", async () => {
    const { code, stdout } = await run([
      fixture("errors.html"),
      "--rule",
      "no-positive-tabindex=warning",
    ]);
    expect(code).toBe(0);
    expect(stdout).toContain("WARNING [no-positive-tabindex]");
  });

  test("warnings are reported but do not fail the audit", async () => {
    const { code, stdout } = await run([fixture("warnings.html")]);
    expect(code).toBe(0);
    expect(stdout).toContain("WARNING [visual-order-mismatch]");
  });

  test("unreachable host exits 2 with the error on stderr", async () => {
    const { code, stderr, stdout } = await run(["https://not-a-real-host.invalid"]);
    expect(code).toBe(2);
    expect(stdout).toBe("");
    expect(stderr.length).toBeGreaterThan(0);
  });
});
