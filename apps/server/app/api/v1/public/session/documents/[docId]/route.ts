import { jsonResponse } from "@/src/lib/http";
import { parseBody } from "@/src/modules/shops/shop-route";
import { authErrorResponse } from "@/src/modules/auth/auth-http";
import { requirePrintUserSession } from "@/src/modules/print-user/print-user-http";
import {
  deleteGuestDocument,
  updateGuestDocumentConfiguration,
} from "@/src/modules/print-user/print-user.service";
import { printUserPrintConfigurationSchema } from "@ctrlp/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ docId: string }> };

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { docId } = await context.params;
    const session = await requirePrintUserSession(request);
    await deleteGuestDocument(session, docId);
    return jsonResponse({ ok: true });
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const { docId } = await context.params;
    const body = await parseBody(request, printUserPrintConfigurationSchema);
    const session = await requirePrintUserSession(request);
    return jsonResponse({ document: await updateGuestDocumentConfiguration(session, docId, body) });
  } catch (error) {
    return authErrorResponse(error);
  }
}
