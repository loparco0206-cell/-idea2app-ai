const SYSTEM = `
You are the AI design engine for Idea2App, a no-code starter app builder.
Return ONLY valid JSON. No markdown, no code fences, no commentary.

Your JSON must have exactly this top-level shape:
{
  "app": {
    "name": string,
    "tagline": string,
    "description": string,
    "accent": "#RRGGBB",
    "background": "#RRGGBB",
    "screens": string[],
    "features": string[],
    "modules": {
      "login": boolean,
      "ai": boolean,
      "database": boolean,
      "maps": boolean,
      "payments": boolean,
      "booking": boolean,
      "camera": boolean,
      "notifications": boolean,
      "search": boolean,
      "analytics": boolean,
      "sharing": boolean,
      "offline": boolean
    }
  }
}

Rules:
- Produce a practical MVP, usually 4-6 screens.
- Use concise screen names.
- Use 4-10 concrete features.
- Turn on only modules that make sense.
- Always keep offline true unless clearly inappropriate.
- Do not claim a third-party integration is already connected.
- Keep colors as six-digit hex strings.
`;

function cleanJSON(text) {
  let t = String(text || "").trim();
  if (t.startsWith("```")) {
    t = t.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  }
  const first = t.indexOf("{");
  const last = t.lastIndexOf("}");
  if (first >= 0 && last > first) t = t.slice(first, last + 1);
  return JSON.parse(t);
}

export default async (req) => {
  if (req.method !== "POST") {
    return Response.json({ error: "POST required" }, { status: 405 });
  }

  try {
    const body = await req.json();
    const key = process.env.OPENAI_API_KEY;
    if (!key) {
      return Response.json({
        error: "OpenAI is not connected yet. Add OPENAI_API_KEY in Netlify environment variables, then redeploy."
      }, { status: 500 });
    }

    const model = process.env.OPENAI_MODEL || "gpt-5";
    let input;

    if (body.mode === "generate") {
      input = `Create an app plan from this idea.

IDEA:
${body.idea}

PLATFORM:
${body.platform || "Mobile app"}

STYLE:
${body.style || "Modern"}

Return the required JSON only.`;
    } else if (body.mode === "modify") {
      input = `Modify this existing app according to the user's instruction.

CURRENT APP:
${JSON.stringify(body.app)}

USER INSTRUCTION:
${body.instruction}

Preserve parts the user did not ask to change. Return the full updated app JSON using the required shape.`;
    } else {
      return Response.json({ error: "Unknown AI mode" }, { status: 400 });
    }

    const resp = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${key}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        instructions: SYSTEM,
        input
      })
    });

    const raw = await resp.json();

    if (!resp.ok) {
      const msg = raw?.error?.message || `OpenAI request failed (${resp.status})`;
      return Response.json({ error: msg }, { status: resp.status });
    }

    let text = raw.output_text;
    if (!text && Array.isArray(raw.output)) {
      text = raw.output
        .flatMap(x => Array.isArray(x.content) ? x.content : [])
        .filter(x => x.type === "output_text")
        .map(x => x.text)
        .join("");
    }

    const parsed = cleanJSON(text);
    if (!parsed.app) throw new Error("AI response did not contain an app.");
    return Response.json(parsed);
  } catch (err) {
    return Response.json({ error: err.message || "AI function error" }, { status: 500 });
  }
};

export const config = {
  path: "/.netlify/functions/ai"
};
