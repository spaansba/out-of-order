import { trace } from "@out-of-order/trace";

const overlay = trace();
const teardown = [() => overlay.destroy()];

if (import.meta.hot) {
  import.meta.hot.accept();
  import.meta.hot.dispose(() => teardown.forEach((fn) => fn()));
}
