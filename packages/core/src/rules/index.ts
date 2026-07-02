import type { RuleDef, Severity } from "./rule.js";
import { ariaHiddenFocusable } from "./aria-hidden-focusable.js";
import { autofocusNotFocusable } from "./autofocus-not-focusable.js";
import { clickableNotFocusable } from "./clickable-not-focusable.js";
import { compositeRovingTabindex } from "./composite-roving-tabindex.js";
import { duplicateAutofocus } from "./duplicate-autofocus.js";
import { focusEscapesModal } from "./focus-escapes-modal.js";
import { hiddenWhileFocusable } from "./hidden-while-focusable.js";
import { missingAccessibleName } from "./missing-accessible-name.js";
import { nestedInteractive } from "./nested-interactive.js";
import { noPositiveTabindex } from "./no-positive-tabindex.js";
import { preferNativeElement } from "./prefer-native-element.js";
import { redundantTabindex } from "./redundant-tabindex.js";
import { tabindexOnNoninteractive } from "./tabindex-on-noninteractive.js";
import { visualOrderMismatch } from "./visual-order-mismatch.js";

export type {
  Finding,
  Rule,
  RuleContext,
  RuleDef,
  RuleRun,
  SequenceEntry,
  Severity,
} from "./rule.js";

export const ALL_RULES = {
  "no-positive-tabindex": noPositiveTabindex,
  "visual-order-mismatch": visualOrderMismatch,
  "missing-accessible-name": missingAccessibleName,
  "aria-hidden-focusable": ariaHiddenFocusable,
  "hidden-while-focusable": hiddenWhileFocusable,
  "clickable-not-focusable": clickableNotFocusable,
  "composite-roving-tabindex": compositeRovingTabindex,
  "focus-escapes-modal": focusEscapesModal,
  "tabindex-on-noninteractive": tabindexOnNoninteractive,
  "prefer-native-element": preferNativeElement,
  "duplicate-autofocus": duplicateAutofocus,
  "autofocus-not-focusable": autofocusNotFocusable,
  "nested-interactive": nestedInteractive,
  "redundant-tabindex": redundantTabindex,
} satisfies Record<string, RuleDef>;

export type RuleId = keyof typeof ALL_RULES;

export const DEFAULT_SEVERITY = Object.fromEntries(
  Object.entries(ALL_RULES).map(([id, rule]) => [id, rule.severity]),
) as Record<RuleId, Severity>;
