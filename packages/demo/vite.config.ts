import { basename, resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";

const FONTS = `<link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Newsreader:opsz,wght@6..72,400;6..72,500&display=swap" />`;

// null renders a visual separator, splitting the docs links from the tool links.
const NAV = [
  ["getting-started.html", "start"],
  ["concepts.html", "concepts"],
  ["rules.html", "rules"],
  ["api.html", "api"],
  ["recipes.html", "recipes"],
  null,
  ["playground.html", "playground"],
  ["tabbable.html", "tabbable"],
] as const;

function topbar(current: string): string {
  const links = NAV.map((item) => {
    if (!item) {
      return `<span class="nav-sep" aria-hidden="true"></span>`;
    }
    const [href, label] = item;
    const active = href === current ? ' aria-current="page"' : "";
    return `<a href="./${href}"${active}>${label}</a>`;
  }).join("\n        ");
  return `    <header class="topbar">
      <h1><a href="./index.html">Out of Order</a></h1>
      <nav aria-label="Site">
        ${links}
      </nav>
      <span class="spacer"></span>
      <a class="btn" href="https://github.com/spaansba/out-of-order" target="_blank" rel="noopener">GitHub</a>
    </header>`;
}

function chrome(): Plugin {
  return {
    name: "demo-chrome",
    transformIndexHtml(html, ctx) {
      const current = basename(ctx.filename);
      return html
        .replace("</head>", `${FONTS}\n  </head>`)
        .replace("<body>", `<body>\n${topbar(current)}\n`);
    },
  };
}

// Alias the workspace packages to their TypeScript source so the demo runs with
// `vite dev` without building them first.
export default defineConfig({
  // Served from a GitHub Pages project subpath (spaansba.github.io/out-of-order/),
  // so assets must resolve under /out-of-order/, not /. Override with a build-time
  // BASE_PATH (e.g. "/" for a custom domain or local `vite preview`).
  base: process.env.BASE_PATH ?? "/out-of-order/",
  plugins: [chrome()],
  resolve: {
    alias: [
      {
        find: "@out-of-order/trace",
        replacement: resolve(__dirname, "../trace/src/index.ts"),
      },
      {
        find: "@out-of-order/core",
        replacement: resolve(__dirname, "../core/src/index.ts"),
      },
    ],
  },
  // Never pre-bundle the workspace package; keep it as live source so edits to
  // ../core/src hot-update instead of being cached in node_modules/.vite.
  optimizeDeps: {
    exclude: ["@out-of-order/core", "@out-of-order/trace"],
  },
  server: {
    fs: {
      // Allow serving files from the monorepo root (the sibling core package).
      allow: [resolve(__dirname, "../..")],
    },
  },
  build: {
    rollupOptions: {
      input: {
        home: resolve(__dirname, "index.html"),
        playground: resolve(__dirname, "playground.html"),
        tabbable: resolve(__dirname, "tabbable.html"),
        start: resolve(__dirname, "getting-started.html"),
        concepts: resolve(__dirname, "concepts.html"),
        rules: resolve(__dirname, "rules.html"),
        api: resolve(__dirname, "api.html"),
        recipes: resolve(__dirname, "recipes.html"),
      },
    },
  },
});
