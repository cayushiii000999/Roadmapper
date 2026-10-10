import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";

const MODEL = "gemini-3.8-flash";

function buildPrompt(goal: string, resume: string, hoursPerWeek?: number, months?: number) {
  return `You are a career mentor for Indian college students aiming at fresher-level jobs.
The student's target (a job title OR a pasted job posting):
"""${goal.slice(0, 6000)}"""

${resume ? `The student's resume text (mark skills clearly shown here as known):\n"""${resume.slice(0, 6000)}"""` : "No resume provided."}
${hoursPerWeek && months ? `Time budget: ${hoursPerWeek} hours/week for ${months} months. Fit the plan inside it.` : ""}

Build a realistic roadmap with 12 to 18 nodes. Use real roles, real certifications and concrete projects. Do not invent certifications; if unsure, set confidence to "low".
Include 2 or 3 "trap" nodes: things students often waste time on that this target does not need (isTrap: true).

Return ONLY valid JSON, no markdown, in exactly this shape:
{
  "title": "short roadmap title",
  "summary": "2 sentences",
  "nodes": [
    {
      "id": "n1",
      "title": "short title",
      "type": "skill | role | certification | project",
      "phase": 1,
      "description": "one or two sentences",
      "hours": 20,
      "parents": ["ids of nodes that must come first; empty for the first nodes"],
      "known": false,
      "isTrap": false,
      "confidence": "high | medium | low"
    }
  ]
}
Phases go from 1 (foundations) up to the final target role. Every parent id must exist.`;
}

function parseJson(text: string) {
  const cleaned = text.replace(/```json|```/g, "").trim();
  return JSON.parse(cleaned);
}

export async function POST(req: Request) {
  try {
    const { goal, resume, hoursPerWeek, months } = await req.json();

    if (!goal || typeof goal !== "string" || goal.trim().length < 3) {
      return NextResponse.json(
        { error: "Please enter a dream job or paste a job posting." },
        { status: 400 }
      );
    }
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: "Server is missing its API key." }, { status: 500 });
    }

    const ai = new GoogleGenAI({ apiKey: (process.env.GEMINI_API_KEY || "").trim() });
    const prompt = buildPrompt(goal.trim(), (resume || "").trim(), hoursPerWeek, months);

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model: MODEL,
          contents: prompt,
          config: { responseMimeType: "application/json" },
        });
        const data = parseJson(response.text ?? "");
        if (Array.isArray(data.nodes) && data.nodes.length > 0) {
          const ids = new Set(data.nodes.map((n: { id: string }) => n.id));
          for (const n of data.nodes) {
            n.parents = (n.parents || []).filter((p: string) => ids.has(p));
          }
          return NextResponse.json(data);
        }
      } catch (e) {
        console.error("Gemini error:", e);
      }
    }
    return NextResponse.json(
      { error: "The AI could not build a roadmap. Please try again." },
      { status: 502 }
    );
  } catch {
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}