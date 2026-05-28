import OpenAI from "openai";
import {
  buildFallbackOpponentMoveResponse,
  buildOpponentMoveSystemPrompt,
  buildOpponentMoveUserPrompt,
} from "@/lib/coach/prompt";
import { getDifficultyConfig } from "@/lib/chess/difficulty";
import type { CoachResponse, OpponentMoveRequest } from "@/lib/coach/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: OpponentMoveRequest;

  try {
    body = (await request.json()) as OpponentMoveRequest;
  } catch {
    return Response.json({ error: "Ongeldige aanvraag." }, { status: 400 });
  }

  if (!body.fen || !body.fenBefore || !body.moveSan) {
    return Response.json({ error: "Ongeldige aanvraag." }, { status: 400 });
  }

  const fallback = buildFallbackOpponentMoveResponse(body);
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return Response.json(fallback);
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
          content: buildOpponentMoveSystemPrompt(
            levelConfig.title,
            levelConfig.coachTone,
          ),
        },
        {
          role: "user",
          content: buildOpponentMoveUserPrompt(body),
        },
      ],
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      return Response.json(fallback);
    }

    const parsed = JSON.parse(content) as Partial<CoachResponse>;

    const response: CoachResponse = {
      summary: parsed.summary ?? fallback.summary,
      verdict: "neutral",
      followUpSteps: parsed.followUpSteps?.length
        ? parsed.followUpSteps
        : fallback.followUpSteps,
      source: "openai",
    };

    return Response.json(response);
  } catch {
    return Response.json(fallback);
  }
}
