import { constants } from "node:fs";
import { open } from "node:fs/promises";

export async function readLocalFile(file, maxBytes) {
  const handle = await open(
    file,
    constants.O_RDONLY | (constants.O_NONBLOCK ?? 0),
  );
  try {
    const info = await handle.stat();
    if (!info.isFile())
      throw Object.assign(new Error("Use a regular input file."), {
        code: "INVALID_INPUT",
      });
    if (info.size > maxBytes)
      throw Object.assign(new Error(`Input exceeds ${maxBytes} bytes.`), {
        code: "INPUT_TOO_LARGE",
      });
    const buffer = Buffer.alloc(maxBytes + 1);
    let size = 0;
    while (size < buffer.length) {
      const { bytesRead } = await handle.read(
        buffer,
        size,
        buffer.length - size,
        null,
      );
      if (!bytesRead) break;
      size += bytesRead;
    }
    if (size > maxBytes)
      throw Object.assign(new Error(`Input exceeds ${maxBytes} bytes.`), {
        code: "INPUT_TOO_LARGE",
      });
    return buffer.subarray(0, size);
  } finally {
    await handle.close();
  }
}
