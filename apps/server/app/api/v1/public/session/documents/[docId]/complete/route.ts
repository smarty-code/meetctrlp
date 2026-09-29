import { runPrintUser } from "@/src/modules/print-user/print-user-http";
import { completeGuestDocument } from "@/src/modules/print-user/print-user.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ docId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const { docId } = await context.params;
  return runPrintUser(request, (session) => completeGuestDocument(session, docId));
}
