import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { pgn, moves } = await req.json();
    if (!pgn || typeof pgn !== "string") {
      return new Response(JSON.stringify({ error: "Missing pgn" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const movesList = Array.isArray(moves) && moves.length
      ? moves.map((m: string, i: number) => `${i + 1}. ${m}`).join(" ")
      : "(see PGN)";

    const tool = {
      type: "function",
      function: {
        name: "submit_analysis",
        description: "Submit chess game analysis with per-move comments and key mistakes.",
        parameters: {
          type: "object",
          properties: {
            summary: {
              type: "string",
              description: "1-2 sentence overall verdict of the game.",
            },
            move_comments: {
              type: "array",
              description:
                "One entry per move played, in order. Comment is short (max 1 sentence). Mark notable moves.",
              items: {
                type: "object",
                properties: {
                  ply: { type: "integer", description: "1-based ply index matching the move list." },
                  san: { type: "string", description: "Move in SAN, e.g. Nf3." },
                  comment: { type: "string", description: "Short coach comment." },
                  quality: {
                    type: "string",
                    enum: ["best", "good", "ok", "inaccuracy", "mistake", "blunder"],
                  },
                },
                required: ["ply", "san", "comment", "quality"],
              },
            },
            key_mistakes: {
              type: "array",
              description: "Top 3 most important mistakes with the recommended better move.",
              items: {
                type: "object",
                properties: {
                  ply: { type: "integer" },
                  san: { type: "string" },
                  why_bad: { type: "string" },
                  better: { type: "string", description: "Suggested better move in SAN." },
                },
                required: ["ply", "san", "why_bad", "better"],
              },
            },
          },
          required: ["summary", "move_comments", "key_mistakes"],
        },
      },
    };

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "system",
              content:
                "You are a friendly chess coach. Given a game PGN and move list, return a structured analysis using the submit_analysis tool. Provide a comment for EVERY move played, keep each comment to one short sentence, and pick the top 3 mistakes overall.",
            },
            {
              role: "user",
              content: `Moves: ${movesList}\n\nPGN:\n${pgn}`,
            },
          ],
          tools: [tool],
          tool_choice: { type: "function", function: { name: "submit_analysis" } },
        }),
      },
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded, try again shortly." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Add funds in Lovable workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    let parsed: unknown = null;
    if (toolCall?.function?.arguments) {
      try {
        parsed = JSON.parse(toolCall.function.arguments);
      } catch (e) {
        console.error("Failed to parse tool arguments:", e);
      }
    }
    return new Response(JSON.stringify({ analysis: parsed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyse-game error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
