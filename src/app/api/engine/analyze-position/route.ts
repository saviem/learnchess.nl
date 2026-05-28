import { analyzeServerPosition } from "@/lib/chess/server-engine";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!body.fen) {
      return Response.json({ error: "Ongeldige aanvraag." }, { status: 400 });
    }

    const analysis = await analyzeServerPosition(
      body.fen,
      Number(body.skillLevel ?? 10),
    );

    return Response.json(analysis);
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Positie-analyse mislukt.",
      },
      { status: 500 },
    );
  }
}
