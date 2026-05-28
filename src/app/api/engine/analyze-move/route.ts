import { analyzeServerMove } from "@/lib/chess/server-engine";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!body.fenBefore || !body.fenAfter || !body.playedMoveUci) {
      return Response.json({ error: "Ongeldige aanvraag." }, { status: 400 });
    }

    const analysis = await analyzeServerMove(
      body.fenBefore,
      body.fenAfter,
      body.playedMoveUci,
      Number(body.skillLevel ?? 10),
    );

    return Response.json(analysis);
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Engine-analyse mislukt.",
      },
      { status: 500 },
    );
  }
}
