import React, { useState, useEffect } from 'react';
import { SavedMap } from '../types';
import { demoSavedMaps } from '../services/demoContent';
import { Clock, MessageSquare, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';

export const Sidebar = () => {
  const [savedMaps, setSavedMaps] = useState<SavedMap[]>([]);
  const [isOpen, setIsOpen] = useState(true);

  useEffect(() => {
    // Load from local storage
    const loaded = localStorage.getItem('mindmaps');
    let restored: SavedMap[] = [];
    if (loaded) {
      try {
        restored = JSON.parse(loaded);
      } catch (e) {
        console.error("Failed to parse saved maps");
      }
    }
    if (restored.length === 0) {
      restored = demoSavedMaps();
      localStorage.setItem('mindmaps', JSON.stringify(restored));
    }
    setSavedMaps(restored);

    // Listen for new maps
    const handleSaveMap = (e: Event) => {
      const customEvent = e as CustomEvent<SavedMap>;
      const newMap = customEvent.detail;
      setSavedMaps(prev => {
        const updated = [newMap, ...prev];
        localStorage.setItem('mindmaps', JSON.stringify(updated));
        return updated;
      });
    };

    window.addEventListener('mindmap:save-map', handleSaveMap);
    return () => window.removeEventListener('mindmap:save-map', handleSaveMap);
  }, []);

  const loadMap = (map: SavedMap) => {
    window.dispatchEvent(new CustomEvent('mindmap:load-map', { detail: map }));
  };

  const deleteMap = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setSavedMaps(prev => {
      const updated = prev.filter(m => m.id !== id);
      localStorage.setItem('mindmaps', JSON.stringify(updated));
      return updated;
    });
  };

  if (!isOpen) {
    return (
      <div className="h-full bg-white border-r border-slate-200 flex flex-col items-center py-4 relative w-12 transition-all">
        <button 
          onClick={() => setIsOpen(true)}
          className="absolute -right-3 top-6 bg-white border border-slate-200 rounded-sm p-1 hover:bg-slate-50 z-20 text-slate-400 hover:text-slate-900"
        >
          <ChevronRight className="w-3 h-3" />
        </button>
      </div>
    );
  }

  return (
    <div className="h-full w-64 bg-white border-r border-slate-200 flex flex-col relative transition-all">
      <button 
        onClick={() => setIsOpen(false)}
        className="absolute -right-3 top-6 bg-white border border-slate-200 rounded-sm p-1 hover:bg-slate-50 z-20 text-slate-400 hover:text-slate-900"
      >
        <ChevronLeft className="w-3 h-3" />
      </button>

      <div className="px-4 py-5 border-b border-slate-200 flex items-center justify-between">
        <h2 className="text-[10px] uppercase tracking-widest font-bold text-slate-500">History</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
        {savedMaps.length === 0 ? (
          <div className="text-center text-slate-400 text-xs py-8 px-4">
            No generated maps yet. Use the composer to create one.
          </div>
        ) : (
          savedMaps.map(map => (
            <div 
              key={map.id}
              onClick={() => loadMap(map)}
              className="group p-2 rounded-md hover:bg-slate-50 cursor-pointer transition-colors border border-transparent hover:border-slate-200 relative"
            >
              <div className="flex items-start gap-2">
                <MessageSquare className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-medium text-slate-800 truncate">{map.topic}</h3>
                  <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-1 font-mono">
                    <Clock className="w-3 h-3" />
                    {new Date(map.createdAt).toLocaleDateString()}
                  </div>
                </div>
              </div>
              <button 
                onClick={(e) => deleteMap(e, map.id)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-300 hover:text-slate-900 hover:bg-slate-200 rounded-md opacity-0 group-hover:opacity-100 transition-all"
                title="Delete map"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
