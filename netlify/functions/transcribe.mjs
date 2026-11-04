import { GoogleGenAI } from "@google/genai";

export default async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204 });
  }
  if (req.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const body = await req.json().catch(() => null);
    if (!body || !body.audioBase64) {
      return Response.json({ error: "Missing audioBase64 payload" }, { status: 400 });
    }

    const mimeType = body.mimeType || "audio/mp4";
    const genAI = new GoogleGenAI({});

    const result = await genAI.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                mimeType,
                data: body.audioBase64
              }
            },
            {
              text: "You are an English speech-to-text transcriber for an OPIc speaking test. Listen to the audio and transcribe ONLY the exact English words spoken by the speaker. Do NOT correct their grammar mistakes, do NOT add punctuation at the start/end like quotes, and do NOT output any Korean or explanation. If no English speech is heard, return an empty string."
            }
          ]
        }
      ]
    });

    const transcript = (result.text || "").trim().replace(/^["']|["']$/g, "");
    return Response.json({ transcript });
  } catch (err) {
    return Response.json(
      { error: String(err?.message || err) },
      { status: 500 }
    );
  }
};

export const config = {
  path: "/api/transcribe"
};
