import React from 'react';
import MindMap from './components/MindMap';
import { Composer } from './components/Composer';
import { Sidebar } from './components/Sidebar';

const App = () => {
  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#fbfbfa] text-slate-900">
      {/* Header */}
      <header className="flex-none h-14 border-b border-slate-200/60 bg-white/80 backdrop-blur-md px-6 flex items-center justify-between z-10 relative">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 bg-slate-900 rounded-sm flex items-center justify-center">
            <div className="w-2 h-2 bg-white rounded-sm"></div>
          </div>
          <h1 className="text-[15px] font-semibold tracking-tight text-slate-900">MindFlow</h1>
        </div>

        <div className="flex items-center gap-4">
           <a 
            href="#"
            className="text-[13px] text-slate-500 hover:text-slate-900 transition-colors font-medium"
           >
             Documentation
           </a>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="flex-1 w-full h-full relative flex">
        <Sidebar />
        <div className="flex-1 h-full relative">
          <MindMap />
          <Composer />
        </div>
      </main>
    </div>
  );
};

export default App;
