# @out-of-order/vitest

## 0.2.3

### Patch Changes

- Updated dependencies [[`d99c2e1`](https://github.com/spaansba/out-of-order/commit/d99c2e1904886123f12dc16d1a5c3027b0355028)]:
  - @out-of-order/core@0.3.0

## 0.1.2

### Patch Changes

- [#4](https://github.com/spaansba/out-of-order/pull/4) [`7e4250d`](https://github.com/spaansba/out-of-order/commit/7e4250dc40c8e8f23d93519227641ac21851773d) Thanks [@spaansba](https://github.com/spaansba)! - `toHaveValidTabOrder()` now throws a clear error when run under jsdom instead of silently producing misleading results. The matcher reads CSS layout, which jsdom cannot provide, so it needs a real browser (Vitest Browser Mode).

## 0.1.1

### Patch Changes

- Updated dependencies [[`0922308`](https://github.com/spaansba/out-of-order/commit/09223082ff59a6fa82b782195afb92b960730358)]:
  - @out-of-order/core@0.1.1
