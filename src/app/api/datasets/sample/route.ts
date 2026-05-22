import { getCurrentUser } from "@/lib/session";
import { sampleCsv } from "@/lib/sample";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }
  return new Response(sampleCsv(), {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": 'attachment; filename="ofac-alerts-template.csv"',
    },
  });
}
