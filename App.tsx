
import React, { useState, useCallback, useRef } from 'react';
import { InpaintState, BrushMode } from './types';
import { processInpainting, getPromptSuggestion, analyzeResultForErrors } from './services/gemini';
import { MaskCanvas } from './components/MaskCanvas';

// Componente de Logo fiel à imagem enviada
const APrioriLogo = ({ className = "w-8 h-8" }: { className?: string }) => (
  <svg viewBox="0 0 100 100" className={className} xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="50" r="48" fill="white" stroke="#e2e8f0" strokeWidth="1" />
    <defs>
      <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
        <path d="M 10 0 L 0 0 0 10" fill="none" stroke="#cbd5e1" strokeWidth="0.5"/>
      </pattern>
    </defs>
    <circle cx="50" cy="50" r="48" fill="url(#grid)" />
    <path 
      d="M 50 25 A 25 25 0 1 0 75 50 L 75 75 L 50 50" 
      fill="none" 
      stroke="black" 
      strokeWidth="6" 
      strokeLinecap="round" 
      strokeLinejoin="round"
      transform="translate(0, 0)"
    />
  </svg>
);

const App: React.FC = () => {
  const [state, setState] = useState<InpaintState & { isSuggesting: boolean, isAnalyzingResult: boolean }>({
    originalImage: null,
    maskImage: null,
    resultImage: null,
    prompt: '',
    isProcessing: false,
    isSuggesting: false,
    isAnalyzingResult: false,
    error: null,
  });

  const [brushSize, setBrushSize] = useState(40);
  const [brushMode, setBrushMode] = useState<BrushMode>(BrushMode.DRAW);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64 = event.target?.result as string;
        
        setState(prev => ({
          ...prev,
          originalImage: base64,
          resultImage: null,
          error: null,
          isSuggesting: true,
          prompt: 'Analyzing scene to suggest prompt...'
        }));

        try {
          const suggestion = await getPromptSuggestion(base64);
          setState(prev => ({
            ...prev,
            prompt: suggestion,
            isSuggesting: false
          }));
        } catch (err: any) {
          setState(prev => ({
            ...prev,
            isSuggesting: false,
            prompt: 'Inpainting task: Add people to the empty spaces. Keep the architecture exactly as it is.',
            error: "Could not auto-suggest prompt. Please write your own instructions."
          }));
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSmartFix = async () => {
    if (!state.resultImage || !state.originalImage) return;

    setState(prev => ({ ...prev, isAnalyzingResult: true, error: null }));
    try {
      const fixPrompt = await analyzeResultForErrors(state.originalImage, state.resultImage);
      setState(prev => ({ 
        ...prev, 
        prompt: fixPrompt, 
        isAnalyzingResult: false,
        resultImage: null 
      }));
    } catch (err: any) {
      setState(prev => ({ ...prev, error: err.message, isAnalyzingResult: false }));
    }
  };

  const handleInpaint = async () => {
    if (!state.originalImage) return;

    setState(prev => ({ ...prev, isProcessing: true, error: null }));
    try {
      const targetImage = state.maskImage || state.originalImage;
      const result = await processInpainting(targetImage, state.prompt);
      setState(prev => ({ ...prev, resultImage: result, isProcessing: false }));
    } catch (err: any) {
      setState(prev => ({ ...prev, error: err.message, isProcessing: false }));
    }
  };

  const handleDownload = () => {
    if (!state.resultImage) return;
    const link = document.createElement('a');
    link.href = state.resultImage;
    link.download = 'inpainted-scene.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const reset = () => {
    setState({
      originalImage: null,
      maskImage: null,
      resultImage: null,
      prompt: '',
      isProcessing: false,
      isSuggesting: false,
      isAnalyzingResult: false,
      error: null,
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const triggerUpload = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="min-h-screen flex flex-col font-sans bg-slate-50">
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 px-4 py-3 flex items-center justify-between sticky top-0 z-50 shadow-sm">
        <div className="flex items-center gap-3">
          <APrioriLogo className="w-10 h-10 shadow-sm rounded-full" />
          <div className="flex flex-col">
            <h1 className="text-sm font-black text-slate-900 tracking-tighter leading-none">A PRIORI</h1>
            <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest">Scene Inpainter</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={triggerUpload}
            className="p-2 sm:px-4 sm:py-2 text-sm font-bold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all active:scale-95"
          >
            <svg className="w-5 h-5 sm:hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
            <span className="hidden sm:inline">New Upload</span>
          </button>
          {state.originalImage && (
            <button onClick={reset} className="p-2 text-slate-400 hover:text-red-500 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-8 grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8">
        
        <div className="lg:col-span-7 space-y-6">
          <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />

          {!state.originalImage ? (
            <div 
              onClick={triggerUpload}
              className="group cursor-pointer border-2 border-dashed border-slate-300 rounded-3xl bg-white aspect-video flex flex-col items-center justify-center p-8 md:p-12 hover:border-indigo-400 hover:bg-indigo-50/30 transition-all duration-300"
            >
              <div className="w-20 h-20 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mb-6 group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-inner">
                <APrioriLogo className="w-12 h-12" />
              </div>
              <p className="text-xl font-bold text-slate-700 text-center">Select an interior photo</p>
              <p className="text-slate-400 mt-2 text-center max-w-sm text-sm">The AI will suggest a layout. You brush the areas and it fills them with life.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <h2 className="text-lg font-bold text-slate-800">
                  {state.resultImage ? "Final Result" : "Brush Area"}
                </h2>
                {!state.resultImage && (
                  <div className="flex items-center gap-3 bg-white p-2 rounded-2xl border border-slate-100 shadow-sm overflow-x-auto">
                    <div className="flex bg-slate-100 p-1 rounded-xl shrink-0">
                      <button onClick={() => setBrushMode(BrushMode.DRAW)} className={`px-3 py-1.5 text-xs font-bold rounded-lg flex items-center gap-2 ${brushMode === BrushMode.DRAW ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>
                        Brush
                      </button>
                      <button onClick={() => setBrushMode(BrushMode.ERASE)} className={`px-3 py-1.5 text-xs font-bold rounded-lg flex items-center gap-2 ${brushMode === BrushMode.ERASE ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>
                        Eraser
                      </button>
                    </div>
                    <div className="flex items-center gap-3 px-3 border-l border-slate-200 shrink-0">
                      <input type="range" min="10" max="100" value={brushSize} onChange={(e) => setBrushSize(parseInt(e.target.value))} className="w-24 accent-indigo-600" />
                    </div>
                  </div>
                )}
              </div>

              {state.resultImage ? (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="rounded-3xl overflow-hidden border border-slate-200 shadow-2xl bg-white group relative">
                    <img src={state.resultImage} className="w-full" alt="AI update" />
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <button onClick={handleDownload} className="flex-1 bg-indigo-600 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-indigo-700 shadow-lg shadow-indigo-100 active:scale-95 transition-all">
                      Download Photo
                    </button>
                    <button 
                      onClick={handleSmartFix} 
                      disabled={state.isAnalyzingResult}
                      className="flex-1 bg-amber-50 text-amber-700 border border-amber-200 py-4 rounded-2xl font-bold hover:bg-amber-100 flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50"
                    >
                      {state.isAnalyzingResult ? 'Analyzing...' : 'Smart Fix'}
                    </button>
                    <button onClick={() => setState(prev => ({ ...prev, resultImage: null }))} className="bg-white text-slate-600 border border-slate-200 px-6 py-4 rounded-2xl font-bold hover:bg-slate-50 transition-all active:scale-95">
                      Back
                    </button>
                  </div>
                </div>
              ) : (
                <MaskCanvas imageSrc={state.originalImage} brushSize={brushSize} mode={brushMode} onMaskUpdate={(m) => setState(prev => ({ ...prev, maskImage: m }))} />
              )}
            </div>
          )}
        </div>

        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm md:sticky md:top-24">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                AI Assistant
              </h3>
              {(state.isSuggesting || state.isAnalyzingResult) && (
                <div className="flex items-center gap-2 text-indigo-600 text-xs font-bold animate-pulse">
                  <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  Thinking...
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="relative">
                <textarea 
                  value={state.prompt}
                  onChange={(e) => setState(prev => ({ ...prev, prompt: e.target.value }))}
                  disabled={state.isSuggesting || state.isAnalyzingResult}
                  className={`w-full h-48 md:h-80 text-sm p-5 rounded-2xl bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 resize-none transition-all leading-relaxed ${state.isSuggesting || state.isAnalyzingResult ? 'opacity-50 grayscale cursor-wait' : 'text-slate-600'}`}
                  placeholder="The AI suggestion will appear here..."
                />
              </div>

              {state.error && (
                <div className="p-4 bg-red-50 text-red-600 text-xs rounded-2xl border border-red-100 flex gap-2">
                  <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                  {state.error}
                </div>
              )}

              <button 
                disabled={!state.originalImage || state.isProcessing || state.isSuggesting || state.isAnalyzingResult}
                onClick={handleInpaint}
                className={`w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 ${
                  !state.originalImage || state.isProcessing || state.isSuggesting || state.isAnalyzingResult
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none border border-slate-200' 
                    : 'bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-indigo-100'
                }`}
              >
                {state.isProcessing ? 'Updating...' : 'Apply Update'}
              </button>

              <div className="bg-amber-50 rounded-2xl p-5 border border-amber-100">
                <h4 className="text-[10px] font-black text-amber-800 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                  Correction Guide
                </h4>
                <p className="text-xs text-amber-700 leading-relaxed">
                  Add people <b>ONLY</b> to empty spaces. Use the <b>Eraser</b> to refine your mask for better integration.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="py-8 text-center text-slate-300 text-[10px] uppercase font-bold tracking-[0.2em] flex flex-col items-center gap-4">
        <APrioriLogo className="w-6 h-6 grayscale opacity-30" />
        A Priori - Scene Inpainter &bull; Intelligence by Gemini
      </footer>
    </div>
  );
};

export default App;
