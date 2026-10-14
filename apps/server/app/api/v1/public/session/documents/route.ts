import { parseBody } from "@/src/modules/shops/shop-route";
import { authErrorResponse } from "@/src/modules/auth/auth-http";
import { runPrintUser } from "@/src/modules/print-user/print-user-http";
import {
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
