import OpenAI from "openai";
import {
  buildCoachSystemPrompt,
  buildCoachUserPrompt,
  buildFallbackCoachResponse,
} from "@/lib/coach/prompt";
import { getDifficultyConfig } from "@/lib/chess/difficulty";
import type { CoachRequest, CoachResponse } from "@/lib/coach/types";

export async function POST(request: Request) {
  let body: CoachRequest;

  try {
    body = (await request.json()) as CoachRequest;
  } catch {
    return Response.json({ error: "Ongeldige aanvraag." }, { status: 400 });
  }

  if (!body.fen || !body.moveSan || !body.analysis) {
    return Response.json({ error: "Ongeldige aanvraag." }, { status: 400 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return Response.json(buildFallbackCoachResponse(body));
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
          content: buildCoachSystemPrompt(levelConfig.title, levelConfig.coachTone),
        },
        {
          role: "user",
          content: buildCoachUserPrompt(body),
        },
      ],
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      return Response.json(buildFallbackCoachResponse(body));
    }

    const parsed = JSON.parse(content) as Partial<CoachResponse>;
    const fallback = buildFallbackCoachResponse(body);

    const response: CoachResponse = {
      summary: parsed.summary ?? fallback.summary,
      verdict: parsed.verdict ?? body.analysis.classification,
      followUpSteps: parsed.followUpSteps?.length
        ? parsed.followUpSteps
        : fallback.followUpSteps,
      variantLine: parsed.variantLine ?? fallback.variantLine,
      blunderAnalysis: parsed.blunderAnalysis ?? fallback.blunderAnalysis,
      source: "openai",
    };

    return Response.json(response);
  } catch {
    return Response.json(buildFallbackCoachResponse(body));
  }
}
