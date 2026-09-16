import React from 'react';
import { ContextMenuProps } from '../types';
import { Sparkles, Trash2, PlusCircle, Edit3 } from 'lucide-react';

export const ContextMenu: React.FC<ContextMenuProps> = ({
  top,
  left,
  nodeId,
  onClose,
  onAddNode,
  onDeleteNode,
  onExpandAI,
  onRename
}) => {
  return (
    <div
      style={{ top, left }}
      className="absolute z-50 bg-white border border-slate-200 rounded-lg shadow-xl py-1 min-w-[180px] animate-in fade-in zoom-in-95 duration-100"
      onMouseLeave={onClose}
    >
      {nodeId ? (
        <>
          <button
            onClick={() => { onExpandAI(nodeId); onClose(); }}
            className="w-full text-left px-4 py-2 text-sm text-indigo-600 hover:bg-indigo-50 flex items-center gap-2 font-medium"
          >
            <Sparkles size={16} />
            Expand with AI
          </button>
          <div className="h-px bg-slate-100 my-1" />
           <button
            onClick={() => { onRename(nodeId); onClose(); }}
            className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
          >
            <Edit3 size={16} />
            Rename
          </button>
          <button
            onClick={() => { onDeleteNode(nodeId); onClose(); }}
            className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
          >
            <Trash2 size={16} />
            Delete Node
          </button>
        </>
      ) : (
        <button
          onClick={() => { onAddNode({ x: left, y: top }); onClose(); }}
          className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
        >
          <PlusCircle size={16} />
          Add Node Here
        </button>
      )}
    </div>
  );
};