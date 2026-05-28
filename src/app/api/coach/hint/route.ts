import OpenAI from "openai";
import {
  buildFallbackHintResponse,
  buildHintSystemPrompt,
  buildHintUserPrompt,
  normalizeHintResponse,
} from "@/lib/coach/prompt";
import { getDifficultyConfig } from "@/lib/chess/difficulty";
import type { HintRequest, HintResponse } from "@/lib/coach/types";

export async function POST(request: Request) {
  let body: HintRequest;

  try {
    body = (await request.json()) as HintRequest;
  } catch {
    return Response.json({ error: "Ongeldige aanvraag." }, { status: 400 });
  }

  if (!body.fen || !body.analysis) {
    return Response.json({ error: "Ongeldige aanvraag." }, { status: 400 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return Response.json(buildFallbackHintResponse(body));
  }

  try {
    const levelConfig = getDifficultyConfig(body.level);
    const openai = new OpenAI({
      apiKey,
      baseURL: process.env.OPENAI_BASE_URL,
    });
    const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

    const completion = await openai.chat.completions.create({
      model,
      temperature: 0.7,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: buildHintSystemPrompt(levelConfig.title, levelConfig.coachTone),
        },
        {
          role: "user",
          content: buildHintUserPrompt(body),
        },
      ],
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      return Response.json(buildFallbackHintResponse(body));
    }

    const parsed = JSON.parse(content) as Partial<HintResponse> & {
      suggestedMoves?: string[];
    };
    const fallback = buildFallbackHintResponse(body);

    return Response.json({
      ...normalizeHintResponse(body.fen, parsed, fallback),
      source: "openai",
    });
  } catch {
    return Response.json(buildFallbackHintResponse(body));
  }
}
