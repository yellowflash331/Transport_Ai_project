/**
 * GET /api/ml/training-data?format=csv|json
 * Exports the feature/target rows for training the travel-time model in Python.
 * Read-only, contains no personal data (transit records only).
 */
import { createFileRoute } from "@tanstack/react-router";
import { getDataSource } from "@/lib/transit/data-source";
import { buildTrainingRows, trainingRowsToCsv } from "@/lib/ai/training-data";

export const Route = createFileRoute("/api/ml/training-data")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const format = new URL(request.url).searchParams.get("format") ?? "csv";
        const network = await getDataSource().loadNetwork();
        const rows = buildTrainingRows(network);
        if (format === "json") {
          return Response.json({ source: network.source, count: rows.length, rows });
        }
        return new Response(trainingRowsToCsv(rows), {
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="transitai-training-data${network.source.isDemo ? "-DEMO" : ""}.csv"`,
          },
        });
      },
    },
  },
});
