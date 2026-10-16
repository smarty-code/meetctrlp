import { parseBody } from "@/src/modules/shops/shop-route";
import { authErrorResponse } from "@/src/modules/auth/auth-http";
import { runPrintUser } from "@/src/modules/print-user/print-user-http";
import {
  clearGuestCart,
  createUploadIntent,
  updateGuestDocumentConfigurations,
} from "@/src/modules/print-user/print-user.service";
import {
  printUserBatchConfigurationSchema,
  printUserUploadIntentRequestSchema,
} from "@ctrlp/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await parseBody(request, printUserUploadIntentRequestSchema);
    return runPrintUser(request, (session) => createUploadIntent(session, body));
  } catch (error) {
    return authErrorResponse(error);
  }
}

/** Clear all: empties the guest's cart. A placed order is not affected. */
export async function DELETE(request: Request) {
  return runPrintUser(request, (session) => clearGuestCart(session));
}

export async function PUT(request: Request) {
  try {
    const body = await parseBody(request, printUserBatchConfigurationSchema);
    return runPrintUser(request, async (session) => ({
      documents: await updateGuestDocumentConfigurations(session, body.documents),
    }));
  } catch (error) {
    return authErrorResponse(error);
  }
}
