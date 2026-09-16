import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';

export const Composer = () => {
  const [topic, setTopic] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [agentProgress, setAgentProgress] = useState<string>('');
  const [selection, setSelection] = useState<{ count: number; label: string }>({ count: 0, label: '' });

  useEffect(() => {
    const handleStart = () => setIsGenerating(true);
    const handleProgress = (e: Event) => {
      const customEvent = e as CustomEvent;
      setAgentProgress(customEvent.detail.progress);
    };
    const handleEnd = () => {
      setIsGenerating(false);
      setAgentProgress('');
    };

    const handleSelection = (e: Event) => setSelection((e as CustomEvent).detail);
    window.addEventListener('mindmap:selection', handleSelection);
    window.addEventListener('mindmap:agent-start', handleStart);
    window.addEventListener('mindmap:agent-progress', handleProgress);
    window.addEventListener('mindmap:agent-end', handleEnd);

    return () => {
      window.removeEventListener('mindmap:selection', handleSelection);
      window.removeEventListener('mindmap:agent-start', handleStart);
      window.removeEventListener('mindmap:agent-progress', handleProgress);
      window.removeEventListener('mindmap:agent-end', handleEnd);
    };
  }, []);

  const extending = selection.count > 0;
  const selectionTitle = selection.count > 1 ? `${selection.count} nodes` : selection.label;

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    if ((!topic.trim() && !extending) || isGenerating) return;
    
    const event = new CustomEvent('mindmap:generate-agent', { detail: { topic } });
    window.dispatchEvent(event);
    setTopic('');
  };

  return (
    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-full max-w-2xl z-50 flex flex-col items-center">
      {isGenerating && (
        <div className="mb-3 px-4 py-1.5 flex items-center gap-2 bg-slate-900 text-white rounded shadow-sm text-xs font-mono animate-fade-in-up">
           <Loader2 className="w-3 h-3 animate-spin text-slate-300" />
           <span>Agent: {agentProgress || 'Working...'}</span>
        </div>
      )}

      <form onSubmit={handleGenerate} className="w-full bg-white shadow-xl shadow-slate-200/50 rounded-xl p-1.5 border border-slate-200 focus-within:border-slate-300 transition-colors">
        {extending && !isGenerating && (
          <div className="px-3 pt-1.5 pb-0.5 text-[11px] text-slate-500 flex items-center gap-1.5">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-violet-500" />
            Extending <span className="font-medium text-slate-800 truncate max-w-[60%]">{selectionTitle}</span>. Type a focus, or leave empty.
          </div>
        )}
        <div className="relative w-full flex items-center">
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            disabled={isGenerating}
            placeholder={isGenerating ? "Mapping in progress..." : extending ? "Focus for the new branches (optional)" : "What would you like to map?"}
            className="w-full pl-4 pr-32 py-2.5 bg-transparent border-none focus:outline-none focus:ring-0 text-slate-900 placeholder-slate-400 text-sm disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={(!topic.trim() && !extending) || isGenerating}
            className="absolute right-1 px-5 py-2 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-lg text-xs font-semibold tracking-wide transition-colors flex items-center gap-2"
          >
            {isGenerating ? 'Working...' : extending ? 'Extend' : 'Generate'}
          </button>
        </div>
      </form>
    </div>
  );
};

