
import React, { useState, useRef, useCallback } from 'react';
import { GoogleGenAI, Modality } from '@google/genai';
import DrawingCanvas, { DrawingCanvasRef } from './components/DrawingCanvas';
import CameraTracker, { CameraTrackerRef } from './components/CameraTracker';
import { ART_COACH_SYSTEM_INSTRUCTION, LESSONS, FRAME_RATE } from './constants';
import { decodeAudioData, decode, createPcmBlob } from './services/audioUtils';
import { TranscriptionItem } from './types';

type TrackingMode = 'digital' | 'physical';

const App: React.FC = () => {
  const [isActive, setIsActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [currentLesson, setCurrentLesson] = useState(LESSONS[0]);
  const [transcriptions, setTranscriptions] = useState<TranscriptionItem[]>([]);
  const [trackingMode, setTrackingMode] = useState<TrackingMode>('digital');
  
  const canvasRef = useRef<DrawingCanvasRef>(null);
  const cameraRef = useRef<CameraTrackerRef>(null);
  const sessionRef = useRef<any>(null);
  const audioContextRef = useRef<{ input: AudioContext; output: AudioContext } | null>(null);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const nextStartTimeRef = useRef<number>(0);
  const frameIntervalRef = useRef<number | null>(null);

  const addTranscription = useCallback((text: string, type: 'user' | 'ai') => {
    setTranscriptions(prev => [...prev, { text, type, timestamp: Date.now() }].slice(-15));
  }, []);

  const stopSession = () => {
    if (sessionRef.current) {
      sessionRef.current.close();
      sessionRef.current = null;
    }
    if (frameIntervalRef.current) {
      window.clearInterval(frameIntervalRef.current);
      frameIntervalRef.current = null;
    }
    sourcesRef.current.forEach(s => s.stop());
    sourcesRef.current.clear();
    setIsActive(false);
  };

  const startSession = async () => {
    setIsConnecting(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      if (!audioContextRef.current) {
        audioContextRef.current = {
          input: new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 }),
          output: new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 })
        };
      }

      const { input: inputCtx, output: outputCtx } = audioContextRef.current;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: ART_COACH_SYSTEM_INSTRUCTION + 
            `\nMODE: ${trackingMode.toUpperCase()}.` +
            `\nLESSON: ${currentLesson.title}. GOAL: ${currentLesson.description}` +
            `\nIMPORTANT: Be extremely talkative. Comment on every new stroke you see. Provide a verbal critique every few seconds if progress is being made.`,
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } }
          },
          inputAudioTranscription: {},
          outputAudioTranscription: {}
        },
        callbacks: {
          onopen: () => {
            setIsConnecting(false);
            setIsActive(true);
            
            const source = inputCtx.createMediaStreamSource(stream);
            const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const pcmBlob = createPcmBlob(inputData);
              sessionRef.current?.sendRealtimeInput({ media: pcmBlob });
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(inputCtx.destination);

            frameIntervalRef.current = window.setInterval(() => {
              const frame = trackingMode === 'digital' 
                ? canvasRef.current?.getFrame() 
                : cameraRef.current?.getFrame();

              if (frame) {
                sessionRef.current?.sendRealtimeInput({
                  media: { data: frame, mimeType: 'image/jpeg' }
                });
              }
            }, 1000 / FRAME_RATE);
          },
          onmessage: async (msg) => {
            if (msg.serverContent?.inputTranscription) {
              addTranscription(msg.serverContent.inputTranscription.text, 'user');
            }
            if (msg.serverContent?.outputTranscription) {
              addTranscription(msg.serverContent.outputTranscription.text, 'ai');
            }

            const audioData = msg.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (audioData) {
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputCtx.currentTime);
              const buffer = await decodeAudioData(decode(audioData), outputCtx, 24000, 1);
              const source = outputCtx.createBufferSource();
              source.buffer = buffer;
              source.connect(outputCtx.destination);
              source.addEventListener('ended', () => sourcesRef.current.delete(source));
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += buffer.duration;
              sourcesRef.current.add(source);
            }

            if (msg.serverContent?.interrupted) {
              sourcesRef.current.forEach(s => s.stop());
              sourcesRef.current.clear();
              nextStartTimeRef.current = 0;
            }
          },
          onerror: (e) => {
            console.error('Session error:', e);
            stopSession();
          },
          onclose: () => {
            stopSession();
          }
        }
      });

      sessionRef.current = await sessionPromise;
    } catch (err) {
      console.error('Failed to start session:', err);
      setIsConnecting(false);
    }
  };

  const requestImmediateCritique = () => {
    if (!sessionRef.current) return;
    // We "nudge" the AI by sending a fresh frame and a silent context check
    // Since we can't easily send text in the middle of a live stream without complex parts,
    // the model is already instructed to be proactive. If it isn't talking, 
    // the user should just say "How am I doing?" out loud.
    // I will add a UI note to encourage speaking.
  };

  return (
    <div className="flex flex-col lg:flex-row h-screen w-full bg-slate-950 text-slate-200 overflow-hidden p-4 gap-4">
      {/* Sidebar: Lessons & Controls */}
      <aside className="lg:w-80 flex flex-col gap-4 flex-shrink-0">
        <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800 shadow-xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-indigo-500 rounded-full flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight uppercase">AI Coach</h1>
              <p className="text-xs text-slate-400">Proactive Mentoring</p>
            </div>
          </div>

          <div className="space-y-3">
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Lesson Library</h2>
            {LESSONS.map(lesson => (
              <button
                key={lesson.id}
                onClick={() => setCurrentLesson(lesson)}
                className={`w-full text-left p-3 rounded-xl transition-all border ${
                  currentLesson.id === lesson.id 
                    ? 'bg-indigo-500/10 border-indigo-500/50 text-indigo-100' 
                    : 'bg-slate-800/50 border-transparent hover:bg-slate-800 text-slate-400'
                }`}
              >
                <h3 className="text-sm font-medium">{lesson.title}</h3>
                <p className="text-[10px] opacity-70 mt-1 line-clamp-1">{lesson.description}</p>
              </button>
            ))}
          </div>

          <div className="mt-8 space-y-3">
            <button
              onClick={isActive ? stopSession : startSession}
              disabled={isConnecting}
              className={`w-full py-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${
                isActive 
                  ? 'bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 shadow-lg shadow-red-500/10' 
                  : 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-lg shadow-indigo-600/20'
              }`}
            >
              {isConnecting ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : isActive ? (
                <>Stop Session</>
              ) : (
                <>Start Coaching</>
              )}
            </button>
            
            {isActive && (
              <div className="p-3 bg-slate-800/50 rounded-xl border border-slate-700">
                <p className="text-[10px] text-indigo-300 font-medium mb-2 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-ping" />
                  Coach is Listening & Watching
                </p>
                <p className="text-[10px] text-slate-500 leading-tight">
                  "Talk to your coach! Ask: 'How is my perspective?' or 'Are my shapes correct?'"
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Live Feedback Box */}
        <div className="flex-1 bg-slate-900/50 rounded-2xl border border-slate-800 overflow-hidden flex flex-col shadow-inner">
          <div className="p-4 border-b border-slate-800 bg-slate-900/50 flex justify-between items-center">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Feedback Log</span>
            <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-green-500 animate-pulse' : 'bg-slate-700'}`} />
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-slate-950/20">
            {transcriptions.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-600 text-center p-4">
                <svg className="w-8 h-8 mb-3 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
                <p className="text-xs">Start session and talk to the coach for real-time art critique.</p>
              </div>
            ) : (
              transcriptions.map((t, i) => (
                <div key={i} className={`flex flex-col ${t.type === 'user' ? 'items-end' : 'items-start'}`}>
                  <div className={`max-w-[90%] rounded-2xl px-4 py-3 text-xs leading-relaxed shadow-sm ${
                    t.type === 'user' 
                      ? 'bg-slate-800 text-slate-300 rounded-tr-none border border-slate-700' 
                      : 'bg-indigo-900/40 text-indigo-100 rounded-tl-none border border-indigo-500/20'
                  }`}>
                    {t.text}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </aside>

      {/* Main Drawing Area */}
      <main className="flex-1 flex flex-col gap-4 overflow-hidden">
        <header className="flex flex-col sm:flex-row sm:items-center justify-between bg-slate-900 p-4 rounded-2xl border border-slate-800 gap-4 shadow-xl">
          <div className="flex items-center gap-4">
            <div className="bg-indigo-500/10 p-2.5 rounded-xl">
              <svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.582.477 5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-100">{currentLesson.title}</h2>
              <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest">Active Focus</p>
            </div>
          </div>
          
          <div className="flex p-1 bg-slate-950 rounded-xl border border-slate-800 self-start sm:self-center">
            <button
              onClick={() => { if (isActive) stopSession(); setTrackingMode('digital'); }}
              className={`px-5 py-2 rounded-lg text-xs font-bold transition-all ${
                trackingMode === 'digital' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              Digital Studio
            </button>
            <button
              onClick={() => { if (isActive) stopSession(); setTrackingMode('physical'); }}
              className={`px-5 py-2 rounded-lg text-xs font-bold transition-all ${
                trackingMode === 'physical' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              Physical Sketchbook
            </button>
          </div>
        </header>

        <section className="flex-1 relative min-h-0">
          {trackingMode === 'digital' ? (
            <DrawingCanvas ref={canvasRef} />
          ) : (
            <CameraTracker ref={cameraRef} />
          )}
          
          {/* AI Status Indicator */}
          {isActive && (
            <div className="absolute bottom-6 right-6 pointer-events-none group">
              <div className="flex items-center gap-4 bg-slate-950/90 backdrop-blur-2xl px-6 py-4 rounded-3xl border border-white/10 shadow-[0_30px_60px_rgba(0,0,0,0.6)] animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-end gap-1.5 h-6">
                  {[...Array(6)].map((_, i) => (
                    <div 
                      key={i} 
                      className="w-1.5 bg-indigo-500 rounded-full animate-pulse" 
                      style={{ 
                        height: `${40 + Math.random() * 60}%`,
                        animationDelay: `${i * 0.12}s`,
                        animationDuration: '0.8s'
                      }} 
                    />
                  ))}
                </div>
                <div className="flex flex-col">
                  <span className="text-[12px] font-black text-white uppercase tracking-[0.2em]">
                    Coach is Guiding
                  </span>
                  <span className="text-[9px] text-slate-500 font-medium">Analyzing technique in real-time...</span>
                </div>
              </div>
            </div>
          )}
        </section>

        <footer className="bg-slate-900/60 backdrop-blur-md p-4 rounded-2xl border border-slate-800 flex flex-col sm:flex-row justify-between items-center text-[10px] text-slate-400 gap-3 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
            <p className="font-medium">
              {trackingMode === 'digital' 
                ? "Digital Studio: Using internal canvas for precision feedback." 
                : "Sketchbook Mode: Point your webcam at your paper for AI tracking."}
            </p>
          </div>
          <div className="flex gap-6 font-mono font-bold text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 border border-slate-700 rounded-sm flex items-center justify-center text-[8px]">V</span>
              VOICE FEEDBACK ON
            </span>
            <span className="flex items-center gap-1.5">
               <span className="w-3 h-3 border border-slate-700 rounded-sm flex items-center justify-center text-[8px]">L</span>
              LATENCY: OPTIMIZED
            </span>
          </div>
        </footer>
      </main>
    </div>
  );
};

export default App;
