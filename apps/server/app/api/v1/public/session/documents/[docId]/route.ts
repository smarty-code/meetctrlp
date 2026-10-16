import { parseBody } from "@/src/modules/shops/shop-route";
import { authErrorResponse } from "@/src/modules/auth/auth-http";
import { runPrintUser } from "@/src/modules/print-user/print-user-http";
import {
  deleteGuestDocument,
  updateGuestDocumentConfiguration,
} from "@/src/modules/print-user/print-user.service";
import { printUserPrintConfigurationSchema } from "@ctrlp/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ docId: string }> };

export async function DELETE(request: Request, context: RouteContext) {
  const { docId } = await context.params;
  return runPrintUser(request, (session) => deleteGuestDocument(session, docId));
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const { docId } = await context.params;
    const body = await parseBody(request, printUserPrintConfigurationSchema);
    return runPrintUser(request, async (session) => ({
      document: await updateGuestDocumentConfiguration(session, docId, body),
    }));
  } catch (error) {
    return authErrorResponse(error);
  }
}
