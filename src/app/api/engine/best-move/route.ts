import { getServerBestMove } from "@/lib/chess/server-engine";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!body.fen) {
      return Response.json({ error: "Ongeldige aanvraag." }, { status: 400 });
    }

    const bestMove = await getServerBestMove(
      body.fen,
      Number(body.skillLevel ?? 10),
    );

    return Response.json({ bestMove });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Bot-zet mislukt.",
      },
      { status: 500 },
    );
  }
}
