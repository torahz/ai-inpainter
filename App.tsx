
import React, { useState, useCallback, useRef } from 'react';
import { InpaintState, BrushMode } from './types';
import { processInpainting, getPromptSuggestion, analyzeResultForErrors } from './services/gemini';
import { MaskCanvas } from './components/MaskCanvas';

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
        resultImage: null // Go back to editor with new prompt
      }));
    } catch (err: any) {
      setState(prev => ({ ...prev, error: err.message, isAnalyzingResult: false }));
    }
  };

  const handleInpaint = async () => {
    if (!state.originalImage) return;

    setState(prev => ({ ...prev, isProcessing: true, error: null }));
    try {
      // If we have a maskImage, use that. If not, the MaskCanvas update might not have fired yet.
      // But typically MaskCanvas calls onMaskUpdate on mouse up.
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
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-50 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold shadow-lg shadow-indigo-100">AI</div>
          <h1 className="text-xl font-bold text-slate-800 tracking-tight hidden sm:block">Scene Inpainter</h1>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={triggerUpload}
            className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all hover:border-slate-300"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
            New Upload
          </button>
          {state.originalImage && (
            <button onClick={reset} className="text-sm font-medium text-slate-400 hover:text-red-500 transition-colors">Reset</button>
          )}
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        <div className="lg:col-span-7 space-y-6">
          <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />

          {!state.originalImage ? (
            <div 
              onClick={triggerUpload}
              className="group cursor-pointer border-2 border-dashed border-slate-300 rounded-3xl bg-white aspect-video flex flex-col items-center justify-center p-12 hover:border-indigo-400 hover:bg-indigo-50/30 transition-all duration-300"
            >
              <div className="w-20 h-20 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mb-6 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              </div>
              <p className="text-xl font-bold text-slate-700">Select an interior photo</p>
              <p className="text-slate-400 mt-2 text-center max-w-sm">The AI will suggest a layout. You brush the areas and it fills them with life.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-800">
                  {state.resultImage ? "Final Result" : "Brush Area"}
                </h2>
                {!state.resultImage && (
                  <div className="flex items-center gap-4 bg-white p-2 rounded-xl border border-slate-100 shadow-sm">
                    <div className="flex bg-slate-100 p-1 rounded-lg">
                      <button onClick={() => setBrushMode(BrushMode.DRAW)} className={`px-3 py-1 text-xs font-bold rounded flex items-center gap-2 ${brushMode === BrushMode.DRAW ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>
                        <div className="w-2 h-2 rounded-full bg-indigo-500"></div> Brush
                      </button>
                      <button onClick={() => setBrushMode(BrushMode.ERASE)} className={`px-3 py-1 text-xs font-bold rounded flex items-center gap-2 ${brushMode === BrushMode.ERASE ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                        Eraser
                      </button>
                    </div>
                    <div className="flex items-center gap-2 px-2 border-l border-slate-200">
                      <span className="text-xs font-bold text-slate-400 uppercase">Size</span>
                      <input type="range" min="10" max="100" value={brushSize} onChange={(e) => setBrushSize(parseInt(e.target.value))} className="w-20 accent-indigo-600" />
                    </div>
                  </div>
                )}
              </div>

              {state.resultImage ? (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="rounded-3xl overflow-hidden border border-slate-200 shadow-2xl bg-white group relative">
                    <img src={state.resultImage} className="w-full" alt="AI update" />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors pointer-events-none"></div>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-4">
                    <button onClick={handleDownload} className="flex-1 bg-indigo-600 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-indigo-700 shadow-lg shadow-indigo-100 active:scale-95 transition-all">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                      Download Photo
                    </button>
                    <button 
                      onClick={handleSmartFix} 
                      disabled={state.isAnalyzingResult}
                      className="flex-1 bg-amber-50 text-amber-700 border border-amber-200 py-4 rounded-2xl font-bold hover:bg-amber-100 flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50"
                    >
                      {state.isAnalyzingResult ? (
                         <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                      )}
                      Smart Fix Hallucinations
                    </button>
                    <button onClick={() => setState(prev => ({ ...prev, resultImage: null }))} className="bg-white text-slate-600 border border-slate-200 px-6 py-4 rounded-2xl font-bold hover:bg-slate-50 transition-all">
                      Edit
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
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm sticky top-24">
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
                  className={`w-full h-80 text-sm p-5 rounded-2xl bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 resize-none transition-all leading-relaxed ${state.isSuggesting || state.isAnalyzingResult ? 'opacity-50 grayscale cursor-wait' : 'text-slate-600'}`}
                  placeholder="The AI suggestion will appear here..."
                />
                {!state.isSuggesting && !state.isAnalyzingResult && state.originalImage && (
                  <div className="absolute top-3 right-3">
                    <span className="bg-indigo-100 text-indigo-700 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">Active Prompt</span>
                  </div>
                )}
              </div>

              {state.error && (
                <div className="p-4 bg-red-50 text-red-600 text-xs rounded-2xl border border-red-100 flex gap-2 animate-bounce">
                  <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                  {state.error}
                </div>
              )}

              <div className="flex flex-col gap-3">
                <button 
                  disabled={!state.originalImage || state.isProcessing || state.isSuggesting || state.isAnalyzingResult}
                  onClick={handleInpaint}
                  className={`w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 ${
                    !state.originalImage || state.isProcessing || state.isSuggesting || state.isAnalyzingResult
                      ? 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none border border-slate-200' 
                      : 'bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-indigo-100'
                  }`}
                >
                  {state.isProcessing ? (
                    <>
                      <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                      Updating...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                      Apply Update
                    </>
                  )}
                </button>
              </div>

              <div className="bg-amber-50 rounded-2xl p-5 border border-amber-100">
                <h4 className="text-[10px] font-black text-amber-800 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                  Correction Guide
                </h4>
                <p className="text-xs text-amber-700 leading-relaxed">
                  If an item looks like it's <b>flying</b> or <b>blurry</b>, use the <b>Eraser</b> to refine your mask or click <b>Smart Fix</b> to have AI suggest a corrective prompt.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="py-12 text-center text-slate-300 text-[10px] uppercase font-bold tracking-[0.2em]">
        AI Restaurant Inpainter &bull; Intelligence by Gemini
      </footer>
    </div>
  );
};

export default App;
