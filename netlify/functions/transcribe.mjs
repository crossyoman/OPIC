import { GoogleGenAI } from "@google/genai";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

export default async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method === "GET") {
    try {
      const resp = await fetch("https://api.netlify.com/api/v1/ai-gateway/providers/detailed");
      const data = await resp.json().catch(() => ({}));
      return Response.json({
        hasOpenAI: Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_BASE_URL),
        hasGemini: Boolean(process.env.GEMINI_API_KEY && process.env.GOOGLE_GEMINI_BASE_URL),
        hasAnthropic: Boolean(process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_BASE_URL),
        hasGatewayKey: Boolean(process.env.NETLIFY_AI_GATEWAY_KEY),
        providers: data
      }, { headers: corsHeaders });
    } catch (e) {
      return Response.json({ error: String(e) }, { status: 500, headers: corsHeaders });
    }
  }

  if (req.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405, headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => null);
    if (!body || !body.audioBase64) {
      return Response.json({ error: "Missing audioBase64 payload" }, { status: 400, headers: corsHeaders });
    }

    const mimeType = body.mimeType || "audio/mp4";
    const targetHint = body.targetEnglish
      ? `The learner is attempting to say a sentence similar to: "${body.targetEnglish}". If their pronunciation is slightly off or accented, transcribe the intended English words they actually attempted to speak.`
      : "";

    const genAI = new GoogleGenAI({});
    const candidateModels = [
      "gemini-2.5-pro",
      "gemini-2.0-flash",
      "gemini-1.5-flash",
      "gemini-1.5-pro"
    ];

    let lastErr = null;
    for (const modelName of candidateModels) {
      try {
        const result = await genAI.models.generateContent({
          model: modelName,
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
                  text: `You are an English speech-to-text transcriber for an OPIc speaking app. ${targetHint} Listen to the audio and return ONLY the plain English sentence spoken by the user without quotes or explanations.`
                }
              ]
            }
          ]
        });
        const transcript = (result.text || "").trim().replace(/^["']|["']$/g, "");
        return Response.json({ transcript, model: modelName }, { headers: corsHeaders });
      } catch (e) {
        lastErr = e;
      }
    }

    return Response.json(
      { error: String(lastErr?.message || lastErr) },
      { status: 500, headers: corsHeaders }
    );
  } catch (err) {
    return Response.json(
      { error: String(err?.message || err) },
      { status: 500, headers: corsHeaders }
    );
  }
};

export const config = {
  path: "/api/transcribe"
};
