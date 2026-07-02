import { afterEach, describe, expect, test } from "vitest";
import { audit } from "../index.js";

afterEach(() => {
  document.body.innerHTML = "";
});

// The sequence pierces open shadow roots (tabbable's getShadowRoot), so the rules
// layer must scan and walk the same composed tree: container scans descend into
// shadow roots, ancestor checks hop from shadow content to its host.
describe("shadow DOM", () => {
  const attachShadow = (parent: Element, shadowHtml: string): HTMLElement => {
    const host = document.createElement("div");
    parent.appendChild(host);
    host.attachShadow({ mode: "open" }).innerHTML = shadowHtml;
    return host;
  };
  const firedNow = () =>
    new Set(audit(document.body).violations.flatMap((v) => v.issues.map((i) => i.rule)));

  test("01 a modal's own shadow controls are not leaked (contains() false positive)", () => {
    document.body.innerHTML = '<div role="dialog" aria-modal="true" id="m"></div>';
    attachShadow(document.getElementById("m")!, "<button>Inside</button>");
    expect(firedNow()).not.toContain("focus-escapes-modal");
  });

  test("02 a background control still leaks past a modal holding shadow content", () => {
    document.body.innerHTML =
      '<button>Background</button><div role="dialog" aria-modal="true" id="m"></div>';
    attachShadow(document.getElementById("m")!, "<button>Inside</button>");
    expect(firedNow()).toContain("focus-escapes-modal");
  });

  test("03 a modal inside a shadow root is found, so the background leak is flagged", () => {
    document.body.innerHTML = "<button>Background</button>";
    attachShadow(
      document.body,
      '<div role="dialog" aria-modal="true"><button>Inside</button></div>',
    );
    expect(firedNow()).toContain("focus-escapes-modal");
  });

  test("04 aria-hidden on the host reaches its shadow content", () => {
    document.body.innerHTML = '<div aria-hidden="true" id="h"></div>';
    attachShadow(document.getElementById("h")!, "<button>Ghost</button>");
    expect(firedNow()).toContain("aria-hidden-focusable");
  });

  test("05 a mouse-only control inside a shadow root is flagged", () => {
    document.body.innerHTML = "<button>Real</button>";
    attachShadow(document.body, '<div role="button">Ghost</div>');
    expect(firedNow()).toContain("clickable-not-focusable");
  });

  test("06 a clickable host wrapping a focusable in its shadow passes", () => {
    const host = attachShadow(document.body, "<button>Go</button>");
    host.setAttribute("role", "button");
    expect(firedNow()).not.toContain("clickable-not-focusable");
  });

  test("07 duplicate autofocus across the shadow boundary is flagged", () => {
    document.body.innerHTML = "<input autofocus aria-label='First'>";
    attachShadow(document.body, "<input autofocus aria-label='Second'>");
    expect(firedNow()).toContain("duplicate-autofocus");
  });

  test("08 a focusable inside a focusable host's shadow is nested-interactive", () => {
    const host = attachShadow(document.body, "<button>Inner</button>");
    host.setAttribute("role", "link");
    host.setAttribute("tabindex", "0");
    host.setAttribute("aria-label", "Card");
    expect(firedNow()).toContain("nested-interactive");
  });
});
