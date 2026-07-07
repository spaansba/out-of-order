import { bench, describe } from "vitest";
import { audit, formatViolations, type AuditOptions } from "./index.js";
import { ALL_RULES, type RuleId } from "./rules/index.js";

const RULE_IDS = Object.keys(ALL_RULES) as RuleId[];

let injectedStyle: HTMLStyleElement | null = null;

/** A realistic-ish page: many tab stops, nested containers, a stylesheet with
    focus-reveal rules, and a spread of the defects the rules look for. `cssRules`
    pads the stylesheet with unrelated rules to probe per-audit CSS scanning. */
function buildPage(rows: number, cssRules = 0): void {
  injectedStyle?.remove();
  const style = document.createElement("style");
  let css = `
    .sr-only { position:absolute; width:1px; height:1px; clip:rect(0 0 0 0); overflow:hidden; }
    .skip:focus { position:static; width:auto; height:auto; clip:auto; }
    .card:focus-within .reveal { opacity:1; }
    .reveal { opacity:0; }
    .off { position:absolute; left:-9999px; }
    .clipped { overflow:clip; width:40px; height:40px; }
  `;
  for (let i = 0; i < cssRules; i++) {
    css += `.pad-${i}:hover .x-${i} { color: rgb(${i % 255},0,0); transform: translateX(1px); }\n`;
  }
  style.textContent = css;
  document.head.appendChild(style);
  injectedStyle = style;

  const parts: string[] = [`<a href="#main" class="skip sr-only">Skip to content</a>`];
  for (let i = 0; i < rows; i++) {
    parts.push(`
      <div class="card" style="display:flex; gap:8px; padding:4px">
        <button>Action ${i}</button>
        <a href="#r${i}">Link ${i}</a>
        <input aria-label="Field ${i}" />
        <span tabindex="0" role="button">Custom ${i}</span>
        <button tabindex="0">Redundant ${i}</button>
        <div class="clipped"><a href="#c${i}">Clipped ${i}</a></div>
        <a href="#o${i}" class="off">Offscreen ${i}</a>
        <div class="reveal"><button>Reveal ${i}</button></div>
        ${i % 5 === 0 ? `<button tabindex="3">Positive ${i}</button>` : ""}
        ${i % 7 === 0 ? `<div onclick="void 0">Clickable ${i}</div>` : ""}
      </div>`);
  }
  document.body.innerHTML = parts.join("");
}

const ALL_OFF: AuditOptions = {
  rules: Object.fromEntries(RULE_IDS.map((r) => [r, "off"] as const)),
};

function onlyRule(id: RuleId): AuditOptions {
  return { rules: Object.fromEntries(RULE_IDS.filter((r) => r !== id).map((r) => [r, "off"])) };
}

describe("audit throughput (150-row page)", () => {
  buildPage(150);
  const body = document.body;

  bench("baseline (all rules off)", () => {
    audit(body, ALL_OFF);
  });
  bench("full (all rules on)", () => {
    audit(body);
  });
  bench("full + format by-element", () => {
    formatViolations(audit(body), "by-element");
  });
});

describe("per-rule marginal (150-row page, subtract baseline)", () => {
  buildPage(150);
  const body = document.body;

  bench("baseline (all off)", () => {
    audit(body, ALL_OFF);
  });
  for (const id of RULE_IDS) {
    const opts = onlyRule(id);
    bench(id, () => {
      audit(body, opts);
    });
  }
});

describe("hidden-while-focusable vs stylesheet size (150 rows)", () => {
  const only = onlyRule("hidden-while-focusable");
  for (const cssRules of [0, 500, 2000]) {
    bench(
      `${cssRules} extra CSS rules`,
      () => {
        audit(document.body, only);
      },
      {
        setup() {
          buildPage(150, cssRules);
        },
      },
    );
  }
});

describe("scaling (rows): setup-only vs full", () => {
  for (const rows of [50, 150, 500]) {
    bench(
      `${rows} rows - baseline`,
      () => {
        audit(document.body, ALL_OFF);
      },
      {
        setup() {
          buildPage(rows);
        },
      },
    );
    bench(
      `${rows} rows - full`,
      () => {
        audit(document.body);
      },
      {
        setup() {
          buildPage(rows);
        },
      },
    );
  }
});
