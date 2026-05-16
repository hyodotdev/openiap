export class JsonBodyTooLargeError extends Error {
  constructor(message = "Request body is too large") {
    super(message);
  }
}

export function isContentLengthOverLimit(
  contentLengthHeader: string | undefined,
  limitBytes: number,
): boolean {
  if (!contentLengthHeader) return false;
  const value = contentLengthHeader.trim();
  if (!/^\d+$/.test(value)) return false;
  try {
    return BigInt(value) > BigInt(limitBytes);
  } catch {
    return false;
  }
}

export async function readJsonBodyWithLimit(
  request: Request,
  limitBytes: number,
  errorMessage = "Request body is too large",
): Promise<unknown> {
  const text = await readRequestTextWithLimit(
    request,
    limitBytes,
    errorMessage,
  );
  return JSON.parse(text);
}

async function readRequestTextWithLimit(
  request: Request,
  limitBytes: number,
  errorMessage: string,
): Promise<string> {
  const reader = request.body?.getReader();
  if (!reader) return "";

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    totalBytes += value.byteLength;
    if (totalBytes > limitBytes) {
      await reader.cancel().catch(() => undefined);
      throw new JsonBodyTooLargeError(errorMessage);
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}
