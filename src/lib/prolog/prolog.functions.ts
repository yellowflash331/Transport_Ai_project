import { createServerFn } from "@tanstack/react-start";
import { runPrologQuery, fetchPrologStats, deduceRoutesWithProlog } from "./prolog-service";

export const executePrologQueryServer = createServerFn({ method: "POST" })
  .validator((d: { query: string }) => d)
  .handler(async ({ data }) => {
    return await runPrologQuery(data.query);
  });

export const getPrologStatsServer = createServerFn({ method: "GET" })
  .handler(async () => {
    return await fetchPrologStats();
  });

export const deducePrologRoutesServer = createServerFn({ method: "POST" })
  .validator((d: { origin: string; destination: string }) => d)
  .handler(async ({ data }) => {
    return await deduceRoutesWithProlog(data.origin, data.destination);
  });

