"use client";

import { useMemo, useState } from "react";
import { ReactFlow, Background, Controls, MiniMap } from "@xyflow/react";
import type { Node, Edge } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import dagre from "@dagrejs/dagre";

type RNode = {
  id: string; title: string; type: string; phase: number; description: string;
  hours: number; parents: string[]; known: boolean; isTrap: boolean; confidence: string;
};
type Roadmap = { title: string; summary: string; nodes: RNode[] };
type Advice = { project: { name: string; description: string }; repoIdea: string; questions: string[] };

const EXAMPLES = [
  "Full Stack Developer at a climate tech startup",
  "UI/UX Designer for fintech apps",
  "Data Analyst at an e-commerce company",
];

const ICONS: Record<string, string> = { skill: "🛠", role: "🎯", certification: "🏅", project: "🚀" };

function layout(nodes: Node[], edges: Edge[]): Node[] {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "LR", nodesep: 40, ranksep: 90 });
  nodes.forEach((n) => g.setNode(n.id, { width: 200, height: 70 }));
  edges.forEach((e) => g.setEdge(e.source, e.target));
  dagre.layout(g);
  return nodes.map((n) => {
    const p = g.node(n.id);
    return { ...n, position: { x: p.x - 100, y: p.y - 35 } };
  });
}

export default function Home() {
  const [goal, setGoal] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [roadmap, setRoadmap] = useState<Roadmap | null>(null);
  const [known, setKnown] = useState<Record<string, boolean>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [advice, setAdvice] = useState<Advice | null>(null);
  const [adviceLoading, setAdviceLoading] = useState(false);
  const [adviceError, setAdviceError] = useState("");

  async function generate() {
    setLoading(true); setError(""); setRoadmap(null); setSelectedId(null);
    setKnown({}); setAdvice(null); setAdviceError("");
    try {
      const res = await fetch("/api/roadmap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      const k: Record<string, boolean> = {};
      data.nodes.forEach((n: RNode) => { if (n.known) k[n.id] = true; });
      setKnown(k);
      setRoadmap(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function getAdvice(n: RNode) {
    setAdviceLoading(true); setAdviceError(""); setAdvice(null);
    try {
      const res = await fetch("/api/node", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal, title: n.title, description: n.description }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      setAdvice(data);
    } catch (e) {
      setAdviceError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setAdviceLoading(false);
    }
  }

  const { nodes, edges } = useMemo(() => {
    if (!roadmap) return { nodes: [] as Node[], edges: [] as Edge[] };
    const rawNodes: Node[] = roadmap.nodes.map((n) => {
      const bg = known[n.id] ? "#bbf7d0" : n.isTrap ? "#fecaca" : "#bfdbfe";
      const selected = n.id === selectedId;
      return {
        id: n.id,
        position: { x: 0, y: 0 },
        data: {
          label: `${n.isTrap ? "⚠" : known[n.id] ? "✓" : ICONS[n.type] || "•"} ${n.title}`,
        },
        style: {
          background: bg, color: "#111",
          border: selected ? "3px solid #1d4ed8" : "1px solid #334155",
          borderRadius: 12, width: 200, height: 70, fontSize: 14, padding: 8,
        },
      };
    });
    const rawEdges: Edge[] = roadmap.nodes.flatMap((n) =>
      n.parents.map((p) => ({ id: `${p}-${n.id}`, source: p, target: n.id, animated: !known[p] }))
    );
    return { nodes: layout(rawNodes, rawEdges), edges: rawEdges };
  }, [roadmap, known, selectedId]);

  const selected = roadmap?.nodes.find((n) => n.id === selectedId) || null;
  const learnable = roadmap ? roadmap.nodes.filter((n) => !n.isTrap) : [];
  const doneCount = learnable.filter((n) => known[n.id]).length;
  const percent = learnable.length ? Math.round((doneCount / learnable.length) * 100) : 0;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="bg-gradient-to-r from-indigo-700 to-blue-600 px-4 py-8 text-white">
        <div className="mx-auto max-w-6xl">
          <h1 className="text-3xl font-bold">Career Roadmapper</h1>
          <p className="mt-1 max-w-2xl text-sm text-blue-50">
            Type your dream job or paste a job posting. AI builds a map of what to learn, step by step.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-6xl p-4">
        <section className="-mt-6 rounded-xl border border-slate-300 bg-white p-4 shadow">
          <label htmlFor="goal" className="block text-sm font-semibold">
            Dream job or job posting
          </label>
          <textarea
            id="goal" value={goal} onChange={(e) => setGoal(e.target.value)} rows={3}
            placeholder="e.g. Full Stack Developer at a climate tech startup"
            className="mt-1 w-full rounded border border-slate-400 p-2 text-slate-900"
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-600">Try:</span>
            {EXAMPLES.map((ex) => (
              <button key={ex} onClick={() => setGoal(ex)}
                className="rounded-full border border-slate-400 px-3 py-1 text-xs hover:bg-slate-100">
                {ex}
              </button>
            ))}
          </div>
          <button onClick={generate} disabled={loading || goal.trim().length < 3}
            className="mt-3 rounded bg-indigo-700 px-5 py-2 font-medium text-white disabled:opacity-50">
            {loading ? "Building your roadmap..." : "Generate roadmap"}
          </button>
          <p className="mt-2 text-xs text-slate-600">
            The roadmap and advice are written by AI (Google Gemini). Please verify details before relying on them.
          </p>
        </section>

        {loading && (
          <p role="status" className="mt-4 rounded bg-blue-50 p-3 text-sm text-blue-900">
            The AI is reading your target and planning the steps. This can take up to a minute...
          </p>
        )}
        {error && (
          <p role="alert" className="mt-4 rounded bg-red-100 p-3 text-sm text-red-800">{error}</p>
        )}

        {roadmap && (
          <section className="mt-6">
            <h2 className="text-xl font-semibold">{roadmap.title}</h2>
            <p className="text-sm text-slate-700">{roadmap.summary}</p>

            <div className="mt-3" aria-label="Progress">
              <div className="flex justify-between text-xs text-slate-700">
                <span>Progress: {doneCount} of {learnable.length} steps known</span>
                <span>{percent}%</span>
              </div>
              <div className="mt-1 h-2 rounded bg-slate-200">
                <div className="h-2 rounded bg-green-600 transition-all" style={{ width: `${percent}%` }} />
              </div>
            </div>

            <p className="mb-2 mt-3 text-xs text-slate-700">
              Blue = to learn, green = known, red ⚠ = probably skippable. Scroll to zoom, drag to move, click a step.
            </p>

            <div className="flex flex-col gap-3 md:flex-row">
              <div className="h-[60vh] flex-1 rounded-xl border border-slate-300 bg-white">
                <ReactFlow
                  nodes={nodes} edges={edges} fitView nodesDraggable={false}
                  onNodeClick={(_, node) => { setSelectedId(node.id); setAdvice(null); setAdviceError(""); }}
                >
                  <Background /><Controls /><MiniMap />
                </ReactFlow>
              </div>

              <aside className="w-full rounded-xl border border-slate-300 bg-white p-4 md:w-96 md:max-h-[60vh] md:overflow-y-auto">
                {selected ? (
                  <>
                    <h3 className="text-lg font-semibold">{selected.title}</h3>
                    <p className="text-xs text-slate-600">
                      {selected.type} · phase {selected.phase} · about {selected.hours} hrs · confidence: {selected.confidence}
                    </p>
                    {selected.isTrap && (
                      <p className="mt-1 text-sm text-red-700">Probably not needed for this target.</p>
                    )}
                    <p className="mt-2 text-sm">{selected.description}</p>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        onClick={() => setKnown((k) => ({ ...k, [selected.id]: !k[selected.id] }))}
                        className="rounded border border-slate-500 px-3 py-1 text-sm">
                        {known[selected.id] ? "Mark as not known" : "I already know this"}
                      </button>
                      <button
                        onClick={() => getAdvice(selected)} disabled={adviceLoading}
                        className="rounded bg-indigo-700 px-3 py-1 text-sm text-white disabled:opacity-50">
                        {adviceLoading ? "Thinking..." : "Get project & interview questions"}
                      </button>
                    </div>

                    {adviceError && (
                      <p role="alert" className="mt-2 text-sm text-red-700">{adviceError}</p>
                    )}
                    {advice && (
                      <div className="mt-3 text-sm">
                        <p className="text-xs text-slate-600">AI-generated. Please verify.</p>
                        <h4 className="mt-1 font-semibold">Weekend project: {advice.project.name}</h4>
                        <p>{advice.project.description}</p>
                        <h4 className="mt-2 font-semibold">Repo idea</h4>
                        <p>{advice.repoIdea}</p>
                        <h4 className="mt-2 font-semibold">Interview questions</h4>
                        <ol className="list-decimal pl-5">
                          {advice.questions.map((q, i) => <li key={i}>{q}</li>)}
                        </ol>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-slate-600">Click a step on the map to see details and get advice.</p>
                )}
              </aside>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}