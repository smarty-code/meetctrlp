import { runPrintUser } from "@/src/modules/print-user/print-user-http";
import { quoteGuestSession } from "@/src/modules/print-user/print-user.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return runPrintUser(request, (session) => quoteGuestSession(session));
}
