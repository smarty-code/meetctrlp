import { getFirebaseFirestore } from "@ctrlp/firebase/firestore";

export type PrinterInventorySnapshot = {
  deviceId: string;
  capturedAt: string;
  printers: Array<Record<string, unknown>>;
};

export async function savePrinterInventory(snapshot: PrinterInventorySnapshot) {
  const firestore = getFirebaseFirestore();
  const batch = firestore.batch();

  for (const printer of snapshot.printers) {
    const printerId = String(printer.id ?? printer.name ?? "unknown");
    const documentId = `${snapshot.deviceId}__${printerId}`.replace(/[^a-zA-Z0-9_-]/g, "_");
    const reference = firestore.collection("printerInventory").doc(documentId);

    batch.set(
      reference,
      {
        deviceId: snapshot.deviceId,
        printerId,
        capturedAt: snapshot.capturedAt,
        updatedAt: new Date(),
        snapshot: printer,
      },
      { merge: true },
    );
  }

  await batch.commit();
  return { saved: snapshot.printers.length };
}