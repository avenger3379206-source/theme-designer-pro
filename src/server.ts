import {
  createStartHandler,
  defaultStreamHandler,
} from "@tanstack/react-start/server";
import type { Register } from "@tanstack/react-router";
import type { RequestHandler } from "@tanstack/react-start/server";

// Standard TanStack Start server entry. vite.config.ts points
// `tanstackStart.server.entry` at this file ("server"), and the dev-server
// plugin does `(await import("./server.ts")).default.fetch(request)` on
// every request — so this file must have a default export shaped like
// `{ fetch(request): Promise<Response> }`, wrapping the router's own
// request handling (which already goes through the errorMiddleware
// registered in `src/start.ts`).
const fetch = createStartHandler(defaultStreamHandler);

export type ServerEntry = { fetch: RequestHandler<Register> };

export function createServerEntry(entry: ServerEntry): ServerEntry {
  return {
    async fetch(...args) {
      return await entry.fetch(...args);
    },
  };
}

export default createServerEntry({ fetch });
