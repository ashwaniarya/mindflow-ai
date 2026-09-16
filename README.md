# MindFlow AI

A mind-map canvas where an agent builds the map with you. Right-click to add a node by hand, or hand a topic to the agent and watch it expand the graph node by node through tool calls.

**Live demo:** https://mindflow-ai-sepia.vercel.app

## What it explores

- **Agent as a canvas collaborator** — a LangGraph state machine drives a tool-calling loop (add node, connect, expand) that mutates the same graph you edit manually, capped at 10 steps per run.
- **Streamed graph construction** — nodes appear as the agent decides on them rather than after a single batch response, so the reasoning is legible while it happens.
- **Manual and agentic editing in one surface** — right-click on empty canvas to create, hover a node to branch from it; nothing is read-only while the agent works.

## Stack

React 19, TypeScript, React Flow, LangGraph, Google Gemini (`gemini-3-flash-preview`), Tailwind CSS 4, Vite 6.

## Run locally

Requires Node.js 20+.

```bash
npm install
npm run dev
```

Without an API key the app runs in **demo mode**: the agent replays scripted content from `services/demoContent.ts`, so the full interaction works offline.

To run the real agent, set a Gemini API key in `.env.local`:

```
API_KEY=your-gemini-api-key
```

## Layout

```
services/reactAgent.ts    LangGraph agent, tool declarations, state graph
services/geminiService.ts Gemini client calls
services/demoContent.ts   scripted fallback for demo mode
services/layout.ts        node placement
components/MindMap.tsx    React Flow canvas
components/Composer.tsx   topic input and agent controls
```
