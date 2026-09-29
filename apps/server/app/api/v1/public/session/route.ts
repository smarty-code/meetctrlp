import { runPrintUser } from "@/src/modules/print-user/print-user-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return runPrintUser(request, async (session) => ({ session }));
}
