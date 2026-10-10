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

// Only for testing the map. Remove before submitting, the real roadmap must come from the AI.
const SAMPLE: Roadmap = {
  title: "Sample roadmap (test data)",
  summary: "This is fixed test data to check the map works.",
  nodes: [
    { id: "n1", title: "HTML & CSS", type: "skill", phase: 1, description: "Build static pages.", hours: 20, parents: [], known: false, isTrap: false, confidence: "high" },
    { id: "n2", title: "JavaScript", type: "skill", phase: 1, description: "Learn core JS.", hours: 40, parents: ["n1"], known: false, isTrap: false, confidence: "high" },
    { id: "n3", title: "React", type: "skill", phase: 2, description: "Build components.", hours: 40, parents: ["n2"], known: false, isTrap: false, confidence: "high" },
    { id: "n4", title: "Learn 5 CSS frameworks", type: "skill", phase: 2, description: "Not needed, one is enough.", hours: 30, parents: ["n1"], known: false, isTrap: true, confidence: "medium" },
    { id: "n5", title: "Node.js + REST API", type: "project", phase: 3, description: "Build a small API.", hours: 40, parents: ["n3"], known: false, isTrap: false, confidence: "medium" },
    { id: "n6", title: "Junior Developer", type: "role", phase: 4, description: "Target role.", hours: 0, parents: ["n5"], known: false, isTrap: false, confidence: "medium" },
  ],
};

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
  const [isSample, setIsSample] = useState(false);
  const [known, setKnown] = useState<Record<string, boolean>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);

  async function generate() {
    setLoading(true); setError(""); setRoadmap(null); setSelectedId(null); setKnown({});
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
      setKnown(k); setRoadmap(data); setIsSample(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  function loadSample() {
    setError(""); setSelectedId(null); setKnown({}); setRoadmap(SAMPLE); setIsSample(true);
  }

  const { nodes, edges } = useMemo(() => {
    if (!roadmap) return { nodes: [] as Node[], edges: [] as Edge[] };
    const rawNodes: Node[] = roadmap.nodes.map((n) => {
      const bg = known[n.id] ? "#bbf7d0" : n.isTrap ? "#fecaca" : "#bfdbfe";
      return {
        id: n.id,
        position: { x: 0, y: 0 },
        data: { label: (n.isTrap ? "⚠ " : known[n.id] ? "✓ " : "") + n.title },
        style: { background: bg, color: "#111", border: "1px solid #333", borderRadius: 10, width: 200, height: 70, fontSize: 14, padding: 8 },
      };
    });
    const rawEdges: Edge[] = roadmap.nodes.flatMap((n) =>
      n.parents.map((p) => ({ id: `${p}-${n.id}`, source: p, target: n.id, animated: !known[p] }))
    );
    return { nodes: layout(rawNodes, rawEdges), edges: rawEdges };
  }, [roadmap, known]);

  const selected = roadmap?.nodes.find((n) => n.id === selectedId) || null;

  return (
    <main className="mx-auto max-w-6xl p-4 text-gray-900">
      <h1 className="text-2xl font-bold">Career Roadmapper</h1>
      <p className="mb-4 text-sm text-gray-700">
        Type a dream job or paste a job posting. AI builds your roadmap.
      </p>

      <label htmlFor="goal" className="block text-sm font-medium">Dream job or job posting</label>
      <textarea
        id="goal" value={goal} onChange={(e) => setGoal(e.target.value)} rows={3}
        placeholder="e.g. Full Stack Developer at a climate tech startup"
        className="mb-2 w-full rounded border border-gray-400 p-2"
      />
      <div className="mb-4 flex gap-2">
        <button onClick={generate} disabled={loading || goal.trim().length < 3}
          className="rounded bg-blue-700 px-4 py-2 text-white disabled:opacity-50">
          {loading ? "Building your roadmap..." : "Generate roadmap"}
        </button>
        <button onClick={loadSample} className="rounded border border-gray-500 px-4 py-2">
          Try sample
        </button>
      </div>

      {error && <p role="alert" className="mb-3 rounded bg-red-100 p-2 text-red-800">{error}</p>}

      {roadmap && (
        <>
          <h2 className="text-lg font-semibold">{roadmap.title}</h2>
          <p className="text-sm">{roadmap.summary}</p>
          <p className="mb-2 text-xs text-gray-700">
            {isSample ? "Test data, not AI-generated." : "AI-generated. Please verify certifications and company details."}
            {" "}Blue = to learn, green = known, red = may be skippable.
          </p>
          <div className="flex flex-col gap-3 md:flex-row">
            <div className="h-[65vh] flex-1 rounded border border-gray-400 bg-white">
              <ReactFlow nodes={nodes} edges={edges} fitView
                onNodeClick={(_, node) => setSelectedId(node.id)} nodesDraggable={false}>
                <Background /><Controls /><MiniMap />
              </ReactFlow>
            </div>
            <aside className="w-full rounded border border-gray-400 p-3 md:w-80">
              {selected ? (
                <>
                  <h3 className="font-semibold">{selected.title}</h3>
                  <p className="text-xs text-gray-600">
                    {selected.type} · phase {selected.phase} · ~{selected.hours} hrs · confidence: {selected.confidence}
                  </p>
                  {selected.isTrap && <p className="mt-1 text-sm text-red-700">Probably not needed for this target.</p>}
                  <p className="mt-2 text-sm">{selected.description}</p>
                  <button
                    onClick={() => setKnown((k) => ({ ...k, [selected.id]: !k[selected.id] }))}
                    className="mt-3 rounded border border-gray-600 px-3 py-1 text-sm">
                    {known[selected.id] ? "Mark as not known" : "I already know this"}
                  </button>
                </>
              ) : (
                <p className="text-sm text-gray-600">Click a step on the map to see details.</p>
              )}
            </aside>
          </div>
        </>
      )}
    </main>
  );
}