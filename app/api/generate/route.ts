import { NextResponse } from "next/server";
import {
  GoogleGenAI,
  createPartFromUri,
  createUserContent,
} from "@google/genai";
import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

type UploadResponse = {
  file?: { uri: string; mimeType: string };
  uri?: string;
  mimeType?: string;
};

type GeminiContentPart = { text?: string };
type GeminiCandidate = { content?: { parts?: GeminiContentPart[] } };

type GeminiResponse = {
  text?: string | (() => string);
  response?: { candidates?: GeminiCandidate[] };
  candidates?: GeminiCandidate[];
};

const getEnvKeys = () => {
  const raw = [
    process.env.GOOGLE_API_KEYS ?? "",
    process.env.GOOGLE_API_KEY ?? "",
  ]
    .filter(Boolean)
    .join(",");

  return raw
    .split(/[,;\s]+/)
    .map((key) => key.trim())
    .filter(Boolean);
};

const parseClientKeys = (raw: FormDataEntryValue | null) => {
  if (!raw || typeof raw !== "string") return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((key) => (typeof key === "string" ? key.trim() : ""))
      .filter(Boolean);
  } catch {
    return [];
  }
};

const pickKey = (keys: string[]) =>
  keys[Math.floor(Math.random() * keys.length)];

const ensureText = (response: GeminiResponse | undefined) => {
  if (!response) return "";
  if (typeof response.text === "function") return response.text();
  if (typeof response.text === "string") return response.text;
  const parts =
    response.response?.candidates?.[0]?.content?.parts ??
    response.candidates?.[0]?.content?.parts ??
    [];
  return parts
    .map((part) => part.text ?? "")
    .filter(Boolean)
    .join("\n");
};

export async function POST(request: Request) {
  const formData = await request.formData();
  const files = formData.getAll("images").filter(
    (file): file is File => file instanceof File,
  );

  if (!files.length) {
    return NextResponse.json(
      { error: "ต้องอัปโหลดรูปอย่างน้อย 1 รูป" },
      { status: 400 },
    );
  }

  let prompts: string[] = [];
  try {
    prompts = JSON.parse((formData.get("prompts") as string) ?? "[]");
  } catch {
    return NextResponse.json(
      { error: "รูปแบบข้อมูล prompt ไม่ถูกต้อง" },
      { status: 400 },
    );
  }

  const defaultPrompt =
    (formData.get("defaultPrompt") as string)?.trim() ||
    "บรรยายรายละเอียดของภาพนี้";
  const model = (formData.get("model") as string)?.trim() || "gemini-2.5-flash";

  const allKeys = [
    ...getEnvKeys(),
    ...parseClientKeys(formData.get("apiKeys")),
  ];

  if (!allKeys.length) {
    return NextResponse.json(
      { error: "ไม่พบ API key กรุณากำหนดใน .env หรือฟอร์ม" },
      { status: 400 },
    );
  }

  const results: Array<{
    filename: string;
    prompt: string;
    text?: string;
    error?: string;
  }> = [];

  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    const prompt = prompts[index]?.trim() || defaultPrompt;
    const tempPath = path.join(tmpdir(), `${randomUUID()}-${file.name}`);

    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      await fs.writeFile(tempPath, buffer);

      const key = pickKey(allKeys);
      const ai = new GoogleGenAI({ apiKey: key });
      const upload = (await ai.files.upload({
        file: tempPath,
      })) as UploadResponse;

      const fileRef = upload.file ?? {
        uri: upload.uri,
        mimeType: upload.mimeType ?? file.type,
      };

      if (!fileRef?.uri || !fileRef?.mimeType) {
        throw new Error("ไม่สามารถอัปโหลดไฟล์ไปยัง Gemini ได้");
      }

      const response = await ai.models.generateContent({
        model,
        contents: [
          createUserContent([
            prompt,
            createPartFromUri(fileRef.uri, fileRef.mimeType),
          ]),
        ],
      });

      results.push({
        filename: file.name,
        prompt,
        text: ensureText(response),
      });
    } catch (error) {
      results.push({
        filename: file.name,
        prompt,
        error: error instanceof Error ? error.message : "เกิดข้อผิดพลาด",
      });
    } finally {
      await fs.unlink(tempPath).catch(() => {});
    }
  }

  return NextResponse.json({ results });
}

