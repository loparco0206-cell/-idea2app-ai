const SYSTEM = `
You are the AI design engine for Idea2App.

Your job is to turn a user's app idea into a simple, practical app blueprint.

Return ONLY valid JSON.
Do not use markdown.
Do not use code fences.
Do not add commentary before or after the JSON.

Return exactly this shape:

{
  "app": {
    "name": "string",
    "tagline": "string",
    "description": "string",
    "accent": "#RRGGBB",
    "background": "#RRGGBB",
    "screens": ["string"],
    "features": ["string"],
    "modules": {
      "login": false,
      "ai": false,
      "database": false,
      "maps": false,
      "payments": false,
      "booking": false,
      "camera": false,
      "notifications": false,
      "search": false,
      "analytics": false,
      "sharing": false
    }
  }
}

Rules:
- Keep the response compact.
- Use 3 to 6 screens.
- Use 4 to 8 useful features.
- Choose modules only when the app actually needs them.
- Make the app realistic for a starter version.
- Prefer simple features over complicated enterprise features.
`;

function jsonResponse(statusCode, body) {
  return new Response(JSON.stringify(body), {
    status: statusCode,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store"
    }
  });
}

function cleanJSON(text = "") {
  let value = String(text).trim();

  value = value
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  const start = value.indexOf("{");
  const end = value.lastIndexOf("}");

  if (start !== -1 && end !== -1 && end > start) {
    value = value.slice(start, end + 1);
  }

  return value;
}

export default async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("", {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS"
      }
    });
  }

  if (request.method !== "POST") {
    return jsonResponse(405, {
      ok: false,
      error: "Method not allowed"
    });
  }

  try {
    if (!process.env.OPENAI_API_KEY) {
      return jsonResponse(500, {
        ok: false,
        error: "OPENAI_API_KEY is not configured in Netlify."
      });
    }

    const body = await request.json().catch(() => ({}));

    const idea = String(
      body.idea ||
      body.prompt ||
      body.message ||
      ""
    ).trim();

    const platform = String(body.platform || "Mobile app").trim();
    const style = String(body.style || "Modern").trim();

    if (!idea) {
      return jsonResponse(400, {
        ok: false,
        error: "Please enter an app idea."
      });
    }

    if (idea.length > 3000) {
      return jsonResponse(400, {
        ok: false,
        error: "App idea is too long."
      });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000);

    const prompt = `
App idea:
${idea}

Platform:
${platform}

Style:
${style}

Create a compact starter-app blueprint now.
`;

    let apiResponse;

    try {
      apiResponse = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL || "gpt-5.6-luna",

          reasoning: {
            effort: "none"
          },

          text: {
            verbosity: "low"
          },

          instructions: SYSTEM,
          input: prompt,

          max_output_tokens: 1200,
          store: false
        })
      });
    } finally {
      clearTimeout(timeout);
    }

    const raw = await apiResponse.text();

    if (!apiResponse.ok) {
      console.error("OpenAI API error:", apiResponse.status, raw);

      let detail = "";

      try {
        const parsed = JSON.parse(raw);
        detail =
          parsed?.error?.message ||
          parsed?.error?.code ||
          "";
      } catch {}

      return jsonResponse(apiResponse.status, {
        ok: false,
        error: "OpenAI request failed.",
        detail: detail || `HTTP ${apiResponse.status}`
      });
    }

    let responseData;

    try {
      responseData = JSON.parse(raw);
    } catch {
      console.error("OpenAI returned non-JSON HTTP response:", raw);

      return jsonResponse(502, {
        ok: false,
        error: "OpenAI returned an unreadable response."
      });
    }

    let outputText = responseData.output_text || "";

    if (!outputText && Array.isArray(responseData.output)) {
      for (const item of responseData.output) {
        if (!Array.isArray(item.content)) continue;

        for (const content of item.content) {
          if (content?.type === "output_text" && content?.text) {
            outputText += content.text;
          }
        }
      }
    }

    if (!outputText) {
      console.error("No output_text returned:", responseData);

      return jsonResponse(502, {
        ok: false,
        error: "AI returned no app design."
      });
    }

    const cleaned = cleanJSON(outputText);

    let design;

    try {
      design = JSON.parse(cleaned);
    } catch (error) {
      console.error("Could not parse model JSON:", cleaned);

      return jsonResponse(502, {
        ok: false,
        error: "AI returned invalid app data.",
        detail: "Please try again."
      });
    }

    if (!design?.app?.name) {
      return jsonResponse(502, {
        ok: false,
        error: "AI response is missing required app information."
      });
    }

    return new Response(
      JSON.stringify({
        ok: true,
        ...design
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
          "Access-Control-Allow-Origin": "*"
        }
      }
    );

  } catch (error) {
    console.error("Idea2App function error:", error);

    if (error?.name === "AbortError") {
      return jsonResponse(504, {
        ok: false,
        error: "AI took too long to respond. Please try again."
      });
    }

    return jsonResponse(500, {
      ok: false,
      error: "AI server error.",
      detail: String(error?.message || error)
    });
  }
};