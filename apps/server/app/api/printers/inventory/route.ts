import { appConfig } from "@/src/config/app";
import { jsonResponse } from "@/src/lib/http";
import {
  savePrinterInventory,
  type PrinterInventorySnapshot,
} from "@/src/modules/printers/printer-inventory.service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!appConfig.printerInventoryApiKey) {
    return jsonResponse({ error: "printer inventory API is not configured" }, { status: 503 });
  }

  if (request.headers.get("x-printer-inventory-key") !== appConfig.printerInventoryApiKey) {
    return jsonResponse({ error: "unauthorized" }, { status: 401 });
  }

  let body: PrinterInventorySnapshot;
  try {
    body = (await request.json()) as PrinterInventorySnapshot;
  } catch {
    return jsonResponse({ error: "invalid JSON" }, { status: 400 });
  }

  if (!body.deviceId || !body.capturedAt || !Array.isArray(body.printers)) {
    return jsonResponse({ error: "deviceId, capturedAt, and printers are required" }, { status: 400 });
  }

  try {
    const result = await savePrinterInventory(body);
    return jsonResponse(result);
  } catch (error) {
    console.error("Failed to save printer inventory", error);
    return jsonResponse({ error: "failed to save printer inventory" }, { status: 500 });
  }
}