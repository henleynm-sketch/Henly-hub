import { createApp } from "./app";
import { env } from "@repo/env";

const app = createApp();

app.listen(env.API_PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[api] henley-hub v1 listening on http://localhost:${env.API_PORT}`);
});
