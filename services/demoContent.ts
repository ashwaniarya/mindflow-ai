import { Edge } from 'reactflow';
import { MindMapNode, SavedMap } from '../types';

interface DemoBranch {
  label: string;
  subtopics: string[];
}

interface DemoMap {
  topic: string;
  keywords: string[];
  rootLabel: string;
  branches: DemoBranch[];
}

const curatedMaps: DemoMap[] = [
  {
    topic: 'SEO Visibility',
    keywords: ['seo', 'visibility', 'search', 'ranking', 'geo'],
    rootLabel: '**SEO Visibility**\n\nHow a brand shows up in search and AI answers',
    branches: [
      {
        label: '**Classic search**\n\nRankings, clicks, and intent',
        subtopics: ['Keyword clusters by intent', 'Technical health: crawl, speed, schema', 'Backlinks and brand mentions'],
      },
      {
        label: '**AI answers**\n\nWhere models cite you',
        subtopics: ['Prompts people actually ask', 'Citations by model and source', 'Share of voice vs competitors'],
      },
      {
        label: '**Content that earns visibility**',
        subtopics: ['Answer the question in the first 100 words', 'Original data and comparisons', 'Refresh cadence for decaying pages'],
      },
      {
        label: '**Measure and iterate**',
        subtopics: ['Visibility over time by topic', 'Mentions vs citations vs prompts', 'Weekly review: what moved and why'],
      },
    ],
  },
  {
    topic: 'Lateral Design Processes',
    keywords: ['lateral', 'design process', 'design thinking', 'ideation', 'creative process'],
    rootLabel: '**Lateral Design Processes**\n\nRoutes around the obvious answer',
    branches: [
      {
        label: '**Reframe the brief**',
        subtopics: ['Invert the goal: how would we make it worse?', 'Change the user: design it for a child', 'Change the medium: paper, voice, motion'],
      },
      {
        label: '**Borrow from elsewhere**',
        subtopics: ['Film grammar: coverage, reaction beats', 'Architecture: thresholds and sight lines', 'Games: feedback loops and reward timing'],
      },
      {
        label: '**Constraints as fuel**',
        subtopics: ['One colour, one typeface', 'Ship in a day', 'No text, only shape and motion'],
      },
      {
        label: '**Converge with taste**',
        subtopics: ['Critique against a reference wall', 'Kill the darlings that only you love', 'Prototype the riskiest interaction first'],
      },
    ],
  },
  {
    topic: 'Engineering, Design and Art',
    keywords: ['engineering', 'design and art', 'art', 'craft', 'design engineer'],
    rootLabel: '**Engineering, Design and Art**\n\nOne practice, three lenses',
    branches: [
      {
        label: '**Engineering**\n\nMake it work, keep it working',
        subtopics: ['Performance budgets and profiling', 'Type safety and tests as design tools', 'Systems: tokens, components, contracts'],
      },
      {
        label: '**Design**\n\nMake it clear and usable',
        subtopics: ['Hierarchy: what the eye reads first', 'Motion that explains state changes', 'Accessibility as a quality bar'],
      },
      {
        label: '**Art**\n\nMake it felt',
        subtopics: ['Composition and negative space', 'Colour with intent, not decoration', 'Taste: knowing when to stop'],
      },
      {
        label: '**Where they meet**',
        subtopics: ['Design engineer: taste you can implement', 'Prototype in code, decide with eyes', 'Polish is the last 5% and it shows'],
      },
    ],
  },
  {
    topic: 'Pixel Colour Change via Sound Waves',
    keywords: ['pixel', 'sound', 'audio', 'wave', 'colour', 'color', 'music visual'],
    rootLabel: '**Pixel Colour Change via Sound Waves**\n\nTurn audio into a living image',
    branches: [
      {
        label: '**Capture the sound**',
        subtopics: ['Web Audio API: AnalyserNode', 'FFT bins: bass, mids, highs', 'Smoothing so pixels do not flicker'],
      },
      {
        label: '**Map sound to colour**',
        subtopics: ['Frequency to hue, amplitude to lightness', 'Beat detection drives saturation bursts', 'Palette constraints for taste'],
      },
      {
        label: '**Render the pixels**',
        subtopics: ['Canvas 2D for a grid of cells', 'GLSL fragment shader for full-screen', 'requestAnimationFrame at 60 fps'],
      },
      {
        label: '**Make it art**',
        subtopics: ['Slow decay instead of hard cuts', 'Composition: where does the energy live?', 'Export frames for a film sequence'],
      },
    ],
  },
];

const genericBranches: DemoBranch[] = [
  { label: '**Why it matters**', subtopics: ['Impact', 'Who benefits', 'Cost of ignoring it'] },
  { label: '**Core ideas**', subtopics: ['Key concept', 'Mental model', 'Vocabulary'] },
  { label: '**Getting started**', subtopics: ['First step', 'Tools needed', 'A quick win'] },
  { label: '**Common pitfalls**', subtopics: ['Overthinking', 'Skipping the basics', 'No feedback loop'] },
];

const normalize = (text: string) => text.toLowerCase().replace(/[^a-z0-9 ]/g, ' ');

const findCurated = (topic: string): DemoMap | undefined => {
  const needle = normalize(topic);
  return curatedMaps.find((map) => map.keywords.some((keyword) => needle.includes(keyword)));
};

const branchesFor = (topic: string): DemoBranch[] => findCurated(topic)?.branches ?? genericBranches;

export const demoDraft = (topic: string) => {
  const curated = findCurated(topic);
  return {
    rootLabel: curated?.rootLabel ?? `**${topic.trim() || 'New idea'}**`,
    branches: branchesFor(topic).map((branch) => branch.label),
  };
};

export const demoExpansions = (branches: { label: string }[]) => {
  const allBranches = curatedMaps.flatMap((map) => map.branches).concat(genericBranches);
  return {
    expansions: branches.map((branch) => ({
      branchLabel: branch.label,
      subtopics: allBranches.find((known) => known.label === branch.label)?.subtopics ?? ['Detail 1', 'Detail 2', 'Detail 3'],
    })),
  };
};

export const demoSubTopics = (topic: string) => {
  const plain = topic.replace(/[*_`#]/g, '').split('\n')[0].trim();
  return [`${plain}: overview`, `${plain}: examples`, `${plain}: open questions`, `${plain}: resources`];
};

export const palette = ['#0ea5e9', '#8b5cf6', '#10b981', '#f59e0b', '#f43f5e', '#14b8a6', '#6366f1', '#84cc16'];

const colorHints: [string[], string][] = [
  [['search', 'seo', 'data', 'measure', 'metric', 'analytics', 'capture', 'engineering', 'technical'], '#0ea5e9'],
  [['ai', 'model', 'agent', 'predict', 'idea', 'lateral', 'reframe', 'design'], '#8b5cf6'],
  [['content', 'write', 'grow', 'start', 'render', 'build', 'ship'], '#10b981'],
  [['art', 'colour', 'color', 'taste', 'craft', 'make it', 'sound', 'music'], '#f59e0b'],
  [['pitfall', 'risk', 'constraint', 'why', 'burnout', 'stress'], '#f43f5e'],
  [['borrow', 'meet', 'together', 'map', 'connect', 'converge'], '#14b8a6'],
];

export const predictColor = (label: string, index = 0): string => {
  const needle = normalize(label);
  const hit = colorHints.find(([keywords]) => keywords.some((keyword) => needle.includes(keyword)));
  return hit ? hit[1] : palette[index % palette.length];
};

export const demoGuidedSubTopics = (label: string, guidance: string) => {
  const plain = label.replace(/[*_`#]/g, '').split('\n')[0].trim();
  const focus = guidance.trim();
  if (!focus) return demoSubTopics(label);
  return [`${focus}: how it applies to ${plain}`, `${focus}: first experiment`, `${focus}: what could go wrong`, `${focus}: how we would measure it`];
};


export const buildDemoMap = (map: DemoMap, index: number): SavedMap => {
  const slug = `demo-${index}`;
  const rootId = `${slug}-root`;
  const nodes: MindMapNode[] = [
    { id: rootId, type: 'custom', position: { x: 0, y: 0 }, data: { label: map.rootLabel, isRoot: true } },
  ];
  const edges: Edge[] = [];
  const branchX = 460;
  const childX = 900;
  const childGap = 84;
  const branchGap = 300;
  const branchCount = map.branches.length;

  map.branches.forEach((branch, branchIndex) => {
    const branchId = `${slug}-b${branchIndex}`;
    const branchY = Math.round((branchIndex - (branchCount - 1) / 2) * branchGap);
    const color = predictColor(branch.label, branchIndex);
    nodes.push({ id: branchId, type: 'custom', position: { x: branchX, y: branchY }, data: { label: branch.label, color } });
    edges.push({ id: `e-${rootId}-${branchId}`, source: rootId, target: branchId, type: 'smoothstep', animated: true, style: { stroke: color } });

    branch.subtopics.forEach((subtopic, subIndex) => {
      const childId = `${branchId}-s${subIndex}`;
      const childY = branchY + Math.round((subIndex - (branch.subtopics.length - 1) / 2) * childGap);
      nodes.push({ id: childId, type: 'custom', position: { x: childX, y: childY }, data: { label: subtopic, color } });
      edges.push({ id: `e-${branchId}-${childId}`, source: branchId, target: childId, type: 'smoothstep', animated: true, style: { stroke: color } });
    });
  });

  return { id: slug, topic: map.topic, nodes, edges, createdAt: Date.now() - index * 86_400_000 };
};

export const demoSavedMaps = (): SavedMap[] => curatedMaps.map(buildDemoMap);
