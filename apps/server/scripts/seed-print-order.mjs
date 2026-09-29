/**
 * Development/emulator smoke seed for the production-like document intake API.
 *
 * Required:
 *   SERVER_BASE_URL=http://localhost:3000
 *   SHOP_ID=<development shop id>
 *   SHOP_TOKEN=<development shop operator Firebase ID token>
 *
 * Optional: FIXTURE=pdf|png|jpeg, PAYMENT_METHOD=CASH|ONLINE,
 * COLOR_MODE=BW|COLOR, PAPER_SIZE=A4|A3, COPIES=1
 *
 * Never point this at production. It creates a real order and uploads a file.
 */
const baseUrl = process.env.SERVER_BASE_URL
const shopId = process.env.SHOP_ID
const token = process.env.SHOP_TOKEN
const fixture = (process.env.FIXTURE ?? "pdf").toLowerCase()

if (!baseUrl || !shopId || !token) {
  throw new Error("Set SERVER_BASE_URL, SHOP_ID, and SHOP_TOKEN for a local/emulator environment.")
}
if (!/localhost|127\.0\.0\.1|emulator/i.test(baseUrl)) {
  throw new Error("The seed script only permits localhost or emulator SERVER_BASE_URL values.")
}

function onePagePdf() {
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << >> /Contents 4 0 R >>",
    "<< /Length 0 >>\nstream\n\nendstream",
  ]
  let pdf = "%PDF-1.4\n"
  const offsets = [0]
  for (const [index, body] of objects.entries()) {
    offsets.push(Buffer.byteLength(pdf, "ascii"))
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`
  }
  const xref = Buffer.byteLength(pdf, "ascii")
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  pdf += offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")
  return Buffer.from(`${pdf}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`)
}

const fixtures = {
  // Valid one-page PDF suitable for the PDFium-backed Windows print path.
  pdf: {
    name: "ctrlp-smoke.pdf",
    type: "application/pdf",
    bytes: onePagePdf(),
  },
  png: {
    name: "ctrlp-smoke.png",
    type: "image/png",
    bytes: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLnpAAAAABJRU5ErkJggg==", "base64"),
  },
  jpeg: {
    name: "ctrlp-smoke.jpg",
    type: "image/jpeg",
    bytes: Buffer.from("/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAH/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAEFAqf/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAEDAQE/Aaf/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAECAQE/Aaf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAY/Aqf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAE/Idf/2gAMAwEAAgADAAAAEP/EABQRAQAAAAAAAAAAAAAAAAAAABD/2gAIAQMBAT8QH//EABQRAQAAAAAAAAAAAAAAAAAAABD/2gAIAQIBAT8QH//EABQQAQAAAAAAAAAAAAAAAAAAABD/2gAIAQEAAT8QH//Z", "base64"),
  },
}[fixture]

if (!fixtures) throw new Error("FIXTURE must be pdf, png, or jpeg.")

const form = new FormData()
form.set("files", new Blob([fixtures.bytes], { type: fixtures.type }), fixtures.name)
form.set("colorMode", process.env.COLOR_MODE === "COLOR" ? "COLOR" : "BW")
form.set("paperSize", process.env.PAPER_SIZE === "A3" ? "A3" : "A4")
form.set("copies", process.env.COPIES ?? "1")
form.set("paymentMethod", process.env.PAYMENT_METHOD === "ONLINE" ? "ONLINE" : "CASH")

const response = await fetch(`${baseUrl.replace(/\/$/, "")}/api/v1/shops/${shopId}/orders/documents`, {
  method: "POST",
  headers: { authorization: `Bearer ${token}` },
  body: form,
})
const result = await response.json().catch(() => ({ message: response.statusText }))
if (!response.ok) throw new Error(`Seed failed (${response.status}): ${JSON.stringify(result)}`)

console.log(JSON.stringify({
  orderId: result.id,
  status: result.status,
  paymentMethod: result.paymentMethod,
  documents: result.documents?.map(({ id, docId, filename, mimeType }) => ({ id: id ?? docId, filename, mimeType })),
}, null, 2))
