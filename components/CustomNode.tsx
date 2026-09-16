import React, { memo, useState, useCallback } from 'react';
import { Handle, Position, NodeProps, useReactFlow } from 'reactflow';
import { Plus, Edit2, Eye } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { MindMapData } from '../types';

const CustomNode = ({ data, id, isConnectable }: NodeProps<MindMapData>) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const { setNodes } = useReactFlow();

  // We communicate "add child" intent via a custom event dispatched to the window
  const onAddChild = (e: React.MouseEvent) => {
    e.stopPropagation();
    const event = new CustomEvent('mindmap:add-child', { detail: { parentId: id } });
    window.dispatchEvent(event);
  };

  const handleLabelChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newLabel = e.target.value;
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === id) {
          return {
            ...node,
            data: {
              ...node.data,
              label: newLabel,
            },
          };
        }
        return node;
      })
    );
  }, [id, setNodes]);

  const toggleMode = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(!isEditing);
  };

  const startEditing = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
  };

  const onEditorKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape' || (e.key === 'Enter' && (e.metaKey || e.ctrlKey))) {
      e.preventDefault();
      setIsEditing(false);
    }
  };

  const accent = data.color;
  const accentStyle = accent && !data.isRoot
    ? { borderLeft: `3px solid ${accent}`, background: `color-mix(in srgb, ${accent} 7%, white)` }
    : undefined;

  return (
    <div
      className="relative flex items-center group"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Node Content */}
      <div 
        style={accentStyle}
        className={`
          px-4 py-3 rounded-lg shadow-sm border transition-all duration-200 min-w-[180px] max-w-[350px] relative z-10
          ${data.isRoot 
            ? 'bg-slate-900 border-slate-900 text-white' 
            : 'bg-white border-slate-200 text-slate-800 hover:border-slate-300'
          }
          ${isEditing ? 'ring-2 ring-slate-400 ring-offset-2' : ''}
        `}
        onDoubleClick={startEditing}
        title={isEditing ? undefined : 'Double-click to edit markdown'}
      >
        {/* Toggle Button at top right */}
        <button
          onClick={toggleMode}
          className={`
            absolute -top-3 -right-3 p-1.5 rounded-full shadow-sm border border-slate-200 bg-white text-slate-500 hover:text-slate-900 hover:border-slate-300 transition-all z-30
            ${isHovered || isEditing ? 'opacity-100 scale-100' : 'opacity-0 scale-50 pointer-events-none'}
          `}
          title={isEditing ? "Switch to Preview" : "Switch to Edit"}
        >
          {isEditing ? <Eye size={12} /> : <Edit2 size={12} />}
        </button>

        {!data.isRoot && (
          <Handle
            type="target"
            position={Position.Left}
            isConnectable={isConnectable}
            className="w-2 h-2 !bg-slate-300 border-0"
          />
        )}

        <div className="flex flex-col gap-2">
          {data.isRoot && (
            <div className="flex items-center gap-2 mb-1 opacity-70 border-b border-slate-700/50 pb-1">
              <span className="text-[9px] font-bold uppercase tracking-widest text-slate-300">Root Node</span>
            </div>
          )}
          
          <div className="text-left w-full overflow-hidden">
            {isEditing ? (
              <textarea
                value={data.label}
                onChange={handleLabelChange}
                className={`
                  nodrag nowheel w-full rounded p-2 border focus:ring-1 focus:ring-slate-400 focus:border-slate-400 outline-none resize-none overflow-hidden min-h-[60px] text-sm font-mono leading-relaxed
                  ${data.isRoot ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-slate-50 border-slate-200 text-slate-800'}
                `}
                autoFocus
                onBlur={() => setIsEditing(false)}
                onKeyDown={onEditorKeyDown}
                rows={Math.max(3, data.label.split('\n').length)}
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <div className={`
                markdown-content prose prose-sm max-w-none break-words
                ${data.isRoot ? 'text-white font-medium text-[15px]' : 'text-slate-700 font-normal'}
              `}>
                <ReactMarkdown>{data.label}</ReactMarkdown>
              </div>
            )}
          </div>
        </div>

        <Handle
          type="source"
          position={Position.Right}
          isConnectable={isConnectable}
          className="w-2 h-2 !bg-slate-300 border-0"
        />
      </div>

      {/* Quick Add Button */}
      <div 
        className={`
          absolute left-full h-full flex items-center pl-3 z-20
          transition-all duration-200 ease-in-out
          ${isHovered ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-1 pointer-events-none'}
        `}
      >
        <button
          onClick={onAddChild}
          className="p-1 bg-white border border-slate-200 hover:border-slate-300 text-slate-500 hover:text-slate-900 rounded-full shadow-sm transition-all hover:scale-110 active:scale-95 flex items-center justify-center w-6 h-6"
          title="Add Child Node"
        >
          <Plus size={14} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
};

export default memo(CustomNode);
