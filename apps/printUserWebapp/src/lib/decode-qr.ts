import jsQR from "jsqr"

type DetectedBarcode = { rawValue: string }

type BarcodeDetectorLike = {
  detect: (image: ImageBitmapSource) => Promise<DetectedBarcode[]>
}

function getBarcodeDetector(): BarcodeDetectorLike | null {
  const Detector = (
    globalThis as typeof globalThis & {
      BarcodeDetector?: new (options?: { formats?: string[] }) => BarcodeDetectorLike
    }
  ).BarcodeDetector
  if (!Detector) {
    return null
  }
  return new Detector({ formats: ["qr_code"] })
}

async function decodeWithBarcodeDetector(
  source: ImageBitmapSource,
): Promise<string | null> {
  const detector = getBarcodeDetector()
  if (!detector) {
    return null
  }
  try {
    const codes = await detector.detect(source)
    return codes[0]?.rawValue?.trim() || null
  } catch {
    return null
  }
}

function decodeWithJsQr(imageData: ImageData): string | null {
  const result = jsQR(imageData.data, imageData.width, imageData.height, {
    inversionAttempts: "dontInvert",
  })
  return result?.data?.trim() || null
}

function imageDataFromSource(
  source: CanvasImageSource,
  width: number,
  height: number,
): ImageData | null {
  if (width < 8 || height < 8) {
    return null
  }
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext("2d", { willReadFrequently: true })
  if (!context) {
    return null
  }
  context.drawImage(source, 0, 0, width, height)
  return context.getImageData(0, 0, width, height)
}

export async function decodeQrFromVideo(video: HTMLVideoElement): Promise<string | null> {
  const native = await decodeWithBarcodeDetector(video)
  if (native) {
    return native
  }
  const imageData = imageDataFromSource(video, video.videoWidth, video.videoHeight)
  return imageData ? decodeWithJsQr(imageData) : null
}

export async function decodeQrFromFile(file: File): Promise<string | null> {
  const bitmap = await createImageBitmap(file)
  try {
    const native = await decodeWithBarcodeDetector(bitmap)
    if (native) {
      return native
    }
    const imageData = imageDataFromSource(bitmap, bitmap.width, bitmap.height)
    return imageData ? decodeWithJsQr(imageData) : null
  } finally {
    bitmap.close()
  }
}
