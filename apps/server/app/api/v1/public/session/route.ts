import { runPrintUser } from "@/src/modules/print-user/print-user-http";
import { loadGuestSession, toPublicSession } from "@/src/modules/print-user/print-user-session.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return runPrintUser(request, async (guest) => ({ session: toPublicSession(await loadGuestSession(guest)) }));
}
