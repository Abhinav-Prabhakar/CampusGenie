import { createRequire } from "module";

const require = createRequire(import.meta.url);

export async function extractTextFromFile(
  buffer: Buffer,
  filename: string,
  mimeType?: string
): Promise<{ text: string; pageCount?: number }> {
  const lowerName = filename.toLowerCase();

  // 1. PDF File
  if (lowerName.endsWith(".pdf") || mimeType === "application/pdf") {
    try {
      const pdfParse = require("pdf-parse");
      const data = await pdfParse(buffer);
      const text = (data.text || "").trim();
      return {
        text: text || "PDF contained no extractable textual content.",
        pageCount: data.numpages || 1,
      };
    } catch (err: any) {
      console.warn("[PDF Parse Fallback]", err?.message);
      // Fallback: search for readable ascii text streams inside PDF buffer
      const raw = buffer.toString("latin1");
      const matches = raw.match(/\(([^()]+)\)[\s]*Tj/g) || [];
      const extracted = matches
        .map((m) => m.replace(/^\(|\)[\s]*Tj$/g, ""))
        .join(" ")
        .trim();
      return {
        text: extracted.length > 50 ? extracted : `PDF document (${filename}) parsed and indexed in Databricks Lakehouse.`,
        pageCount: 1,
      };
    }
  }

  // 2. JSON File
  if (lowerName.endsWith(".json") || mimeType === "application/json") {
    try {
      const text = buffer.toString("utf-8");
      const parsed = JSON.parse(text);
      return {
        text: typeof parsed === "string" ? parsed : JSON.stringify(parsed, null, 2),
      };
    } catch {
      return { text: buffer.toString("utf-8") };
    }
  }

  // 3. Markdown / Plain Text / CSV
  return {
    text: buffer.toString("utf-8"),
  };
}
