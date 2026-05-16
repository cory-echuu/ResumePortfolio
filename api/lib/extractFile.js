const MAX_BYTES = 8 * 1024 * 1024;

export function decodeUpload({ base64, fileName, mimeType }) {
  if (!base64) throw new Error("base64 file payload required");
  const buf = Buffer.from(base64, "base64");
  if (buf.length > MAX_BYTES) {
    throw new Error(`File too large (max ${MAX_BYTES / 1024 / 1024}MB)`);
  }
  const ext = (fileName || "").split(".").pop()?.toLowerCase() || "";
  return { buffer: buf, ext, mimeType: mimeType || "", fileName };
}

export async function extractFromBuffer({ buffer, ext, mimeType }) {
  if (ext === "pdf" || mimeType === "application/pdf") {
    const pdfParse = (await import("pdf-parse")).default;
    const out = await pdfParse(buffer);
    return { kind: "text", text: out.text || "" };
  }

  if (ext === "docx" || mimeType.includes("wordprocessingml")) {
    const mammoth = await import("mammoth");
    const out = await mammoth.extractRawText({ buffer });
    return { kind: "text", text: out.value || "" };
  }

  if (ext === "doc") {
    throw new Error("Legacy .doc not supported — save as .docx or PDF");
  }

  if (["png", "jpg", "jpeg", "webp", "gif"].includes(ext) || mimeType.startsWith("image/")) {
    const b64 = buffer.toString("base64");
    const mt = mimeType || `image/${ext === "jpg" ? "jpeg" : ext}`;
    return { kind: "image", base64: b64, mimeType: mt };
  }

  if (
    ["txt", "text", "md", "markdown", "log", "csv", "tsv"].includes(ext) ||
    mimeType.startsWith("text/") ||
    mimeType === "application/json"
  ) {
    const raw = buffer.toString("utf8");
    const text = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
    return { kind: "text", text };
  }

  throw new Error(`Unsupported file type: .${ext}`);
}
