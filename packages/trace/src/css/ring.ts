// Rings mark page elements rather than overlay nodes, so they key on the
// data-ooo-ring attribute, never a class. This sheet is adopted on its own into
// shadow roots (where document styles don't reach) and is also folded into the
// full overlay sheet.
export const RING_CSS = `
[data-ooo-ring] { outline: 1px dashed rgba(47, 106, 71, 0.5); outline-offset: 2px; }
[data-ooo-ring="warn"] { outline: 1.5px dashed rgba(154, 125, 26, 0.8); outline-offset: 2px; }
[data-ooo-ring="bad"] { outline: 1.5px solid rgba(160, 31, 23, 0.74); outline-offset: 2px; }
[data-ooo-ring]:focus-visible { outline: revert; }
`;
