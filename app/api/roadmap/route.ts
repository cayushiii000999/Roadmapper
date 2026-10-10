import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";

const MODEL = "gemini-3.8-flash";

export async function POST(req: Request) {
  try {
    const { goal, title, description } = await req.json();
    if (!title || typeof title !== "string") {
      return NextResponse.json({ error: "Missing step title." }, { status: 400 });
    }
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: "Server is missing its API key." }, { status: 500 });
    }
    const ai = new GoogleGenAI({ apiKey: (process.env.GEMINI_API_KEY || "").trim() });

    const prompt = `A student wants this career target: "${String(goal || "").slice(0, 1500)}".
They are working on this step: "${title.slice(0, 200)}" (${String(description || "").slice(0, 400)}).
Give specific, practical help for a fresher. Return ONLY valid JSON in exactly this shape:
{
  "project": { "name": "weekend project name", "description": "2-3 sentences on what to build" },
  "repoIdea": "one idea for a GitHub repo to build or study, described in a sentence",
  "questions": ["5 interview questions specific to this step"]
}`;

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model: MODEL,
          contents: prompt,
          config: { responseMimeType: "application/json" },
        });
        const data = JSON.parse((response.text ?? "").replace(/```json|```/g, "").trim());
        if (data.project && Array.isArray(data.questions)) {
          return NextResponse.json(data);
        }
      } catch (e) {
        console.error("Node advice error:", e);
      }
    }
    return NextResponse.json({ error: "Could not get advice. Please try again." }, { status: 502 });
  } catch {
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}