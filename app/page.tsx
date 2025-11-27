"use client";

import Image from "next/image";
import { useMemo, useState } from "react";

type SelectedImage = {
  id: string;
  file: File;
  prompt: string;
  preview: string;
};

type GenerationResult = {
  filename: string;
  prompt: string;
  text?: string;
  error?: string;
};

const DEFAULT_PROMPT = "Tell me about this instrument";
const DEFAULT_MODEL = "gemini-2.5-flash";

export default function Home() {
  const [images, setImages] = useState<SelectedImage[]>([]);
  const [defaultPrompt, setDefaultPrompt] = useState(DEFAULT_PROMPT);
  const [apiKeysInput, setApiKeysInput] = useState("");
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [results, setResults] = useState<GenerationResult[]>([]);

  const parsedKeys = useMemo(
    () =>
      apiKeysInput
        .split(/[\n,]+/)
        .map((key) => key.trim())
        .filter(Boolean),
    [apiKeysInput],
  );

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList?.length) return;
    const next = Array.from(fileList).map((file) => ({
      id: crypto.randomUUID(),
      file,
      prompt: defaultPrompt,
      preview: URL.createObjectURL(file),
    }));
    setImages((prev) => [...prev, ...next]);
  };

  const updatePrompt = (id: string, value: string) => {
    setImages((prev) =>
      prev.map((item) => (item.id === id ? { ...item, prompt: value } : item)),
    );
  };

  const removeImage = (id: string) => {
    setImages((prev) => {
      const target = prev.find((image) => image.id === id);
      if (target) {
        URL.revokeObjectURL(target.preview);
      }
      return prev.filter((image) => image.id !== id);
    });
  };

  const resetState = () => {
    images.forEach((image) => URL.revokeObjectURL(image.preview));
    setImages([]);
    setResults([]);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!images.length) {
      setErrorMessage("กรุณาเลือกไฟล์รูปอย่างน้อย 1 รูป");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setResults([]);

    const formData = new FormData();
    formData.append("defaultPrompt", defaultPrompt);
    formData.append("model", model);
    formData.append(
      "prompts",
      JSON.stringify(images.map((image) => image.prompt || defaultPrompt)),
    );
    if (parsedKeys.length) {
      formData.append("apiKeys", JSON.stringify(parsedKeys));
    }

    images.forEach((image) => {
      formData.append("images", image.file, image.file.name);
    });

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        body: formData,
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "ไม่สามารถประมวลผลได้");
      }

      setResults(payload.results || []);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "เกิดข้อผิดพลาด",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-gradient-to-b from-zinc-50 to-zinc-100 text-zinc-900 min-h-screen px-4 py-10">
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 rounded-3xl bg-white/80 p-6 shadow-lg backdrop-blur-lg sm:p-10">
        <header className="flex flex-col gap-2 text-center sm:text-left">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-500">
            Gemini Multi-Image Explorer
          </p>
          <h1 className="text-3xl font-semibold text-zinc-900 sm:text-4xl">
            วิเคราะห์รูปหลายไฟล์พร้อมกันด้วย Gemini
          </h1>
          <p className="text-base text-zinc-600">
            อัปโหลดภาพ ระบุ prompt เฉพาะของแต่ละภาพ และสลับ API keys
            ได้ตามต้องการ โดยระบบจะสร้างข้อความตอบกลับแยกตามไฟล์
          </p>
        </header>

        <section className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <form
            onSubmit={handleSubmit}
            className="flex flex-col gap-6 rounded-2xl border border-zinc-100 bg-white p-6 shadow-sm"
          >
            <div className="flex flex-col gap-2">
              <label
                htmlFor="images"
                className="text-sm font-semibold text-zinc-700"
              >
                รูปภาพ (รองรับหลายไฟล์)
              </label>
              <input
                id="images"
                type="file"
                accept="image/*"
                multiple
                onChange={(event) => handleFiles(event.target.files)}
                className="cursor-pointer rounded-xl border border-dashed border-indigo-200 bg-indigo-50/60 px-4 py-6 text-center text-sm font-medium text-indigo-600 transition hover:border-indigo-300"
              />
              <p className="text-xs text-zinc-500">
                ไฟล์จะแสดงตัวอย่างด้านล่าง สามารถลบหรือแก้ prompt สำหรับแต่ละรูปได้
              </p>
            </div>

            {images.length > 0 && (
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between text-sm font-semibold text-zinc-600">
                  <span>รูปที่เลือก ({images.length})</span>
                  <button
                    type="button"
                    onClick={resetState}
                    className="text-red-500 transition hover:text-red-600"
                  >
                    ล้างทั้งหมด
                  </button>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  {images.map((image, index) => (
                    <div
                      key={image.id}
                      className="flex flex-col gap-3 rounded-2xl border border-zinc-100 bg-zinc-50/60 p-3"
                    >
                      <div className="flex items-center justify-between text-sm font-semibold text-zinc-700">
                        <span>ภาพที่ {index + 1}</span>
                        <button
                          type="button"
                          onClick={() => removeImage(image.id)}
                          className="text-xs text-red-500 transition hover:text-red-600"
                        >
                          ลบ
                        </button>
                      </div>
                      <div className="relative h-40 w-full overflow-hidden rounded-xl">
                        <Image
                          src={image.preview}
                          alt={image.file.name}
                          fill
                          sizes="(max-width: 640px) 100vw, 50vw"
                          className="object-cover"
                          unoptimized
                        />
                      </div>
                      <input
                        type="text"
                        value={image.prompt}
                        onChange={(event) =>
                          updatePrompt(image.id, event.target.value)
                        }
                        placeholder="Prompt สำหรับรูปนี้"
                        className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm shadow-inner outline-none transition focus:border-indigo-400"
                      />
                      <p className="text-xs text-zinc-500 line-clamp-2">
                        {image.file.name}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <label
                htmlFor="default-prompt"
                className="text-sm font-semibold text-zinc-700"
              >
                Prompt พื้นฐาน
              </label>
              <textarea
                id="default-prompt"
                value={defaultPrompt}
                onChange={(event) => setDefaultPrompt(event.target.value)}
                rows={3}
                className="rounded-2xl border border-zinc-200 bg-zinc-50/80 px-4 py-3 text-sm outline-none transition focus:border-indigo-400 focus:bg-white"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label
                htmlFor="api-keys"
                className="text-sm font-semibold text-zinc-700"
              >
                API Keys (คั่นด้วยคอมม่า หรือขึ้นบรรทัดใหม่)
              </label>
              <textarea
                id="api-keys"
                value={apiKeysInput}
                onChange={(event) => setApiKeysInput(event.target.value)}
                rows={2}
                className="rounded-2xl border border-zinc-200 bg-zinc-50/80 px-4 py-3 text-sm outline-none transition focus:border-indigo-400 focus:bg-white"
                placeholder="AIzaxxx, AIza..."
              />
              <p className="text-xs text-zinc-500">
                หากไม่ระบุ ระบบจะใช้ API key จากตัวแปรสภาพแวดล้อม (GOOGLE_API_KEYS)
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <label
                htmlFor="model"
                className="text-sm font-semibold text-zinc-700"
              >
                รุ่นโมเดล
              </label>
              <select
                id="model"
                value={model}
                onChange={(event) => setModel(event.target.value)}
                className="rounded-2xl border border-zinc-200 bg-zinc-50/80 px-4 py-3 text-sm outline-none transition focus:border-indigo-400 focus:bg-white"
              >
                <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                <option value="gemini-2.0-flash-exp">
                  Gemini 2.0 Flash Experimental
                </option>
                <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
              </select>
            </div>

            {errorMessage && (
              <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                {errorMessage}
              </p>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center justify-center rounded-2xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-indigo-300"
            >
              {isSubmitting ? "กำลังประมวลผล..." : "สร้างคำตอบจาก Gemini"}
            </button>
          </form>

          <section className="flex flex-col gap-4 rounded-2xl border border-indigo-50 bg-indigo-50/70 p-6 shadow-inner">
            <div>
              <h2 className="text-xl font-semibold text-indigo-900">
                ผลลัพธ์ / สถานะ
              </h2>
              <p className="text-sm text-indigo-700">
                ระบบจะสร้างข้อความตอบกลับหนึ่งชุดต่อหนึ่งไฟล์รูป
              </p>
            </div>

            {results.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-indigo-200 bg-white/60 p-6 text-center text-sm text-indigo-500">
                <p>ผลลัพธ์จะปรากฏที่นี่หลังจากส่งคำขอ</p>
              </div>
            ) : (
              <div className="flex flex-col gap-4 overflow-y-auto">
                {results.map((result, index) => (
                  <article
                    key={`${result.filename}-${index}`}
                    className="rounded-2xl border border-white bg-white p-4 text-sm shadow-sm"
                  >
                    <div className="flex flex-col gap-1 border-b border-zinc-100 pb-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-400">
                        ภาพที่ {index + 1}
                      </p>
                      <p className="font-semibold text-zinc-900">
                        {result.filename}
                      </p>
                      <p className="text-xs text-zinc-500">
                        Prompt: {result.prompt}
                      </p>
                    </div>
                    {result.error ? (
                      <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-red-600">
                        {result.error}
                      </p>
                    ) : (
                      <p className="mt-3 whitespace-pre-wrap rounded-xl border border-zinc-100 bg-zinc-50/70 px-3 py-2 text-zinc-700">
                        {result.text || "ไม่มีข้อความที่ได้รับ"}
                      </p>
                    )}
                  </article>
                ))}
        </div>
            )}
          </section>
        </section>
      </main>
    </div>
  );
}
