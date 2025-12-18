
import React, { useRef, useEffect, useImperativeHandle, forwardRef } from 'react';

export interface CameraTrackerRef {
  getFrame: () => string | null;
}

const CameraTracker = forwardRef<CameraTrackerRef>((_, ref) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    async function setupCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } } 
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("Error accessing camera:", err);
      }
    }
    setupCamera();

    return () => {
      const stream = videoRef.current?.srcObject as MediaStream;
      stream?.getTracks().forEach(track => track.stop());
    };
  }, []);

  useImperativeHandle(ref, () => ({
    getFrame: () => {
      if (!videoRef.current || !canvasRef.current) return null;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      // Sync canvas size to video
      if (canvas.width !== video.videoWidth) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL('image/jpeg', 0.5).split(',')[1];
      }
      return null;
    }
  }));

  return (
    <div className="relative w-full h-full bg-black rounded-xl overflow-hidden shadow-2xl border border-slate-700 flex items-center justify-center">
      <video 
        ref={videoRef} 
        autoPlay 
        playsInline 
        muted 
        className="w-full h-full object-contain mirror"
        style={{ transform: 'scaleX(-1)' }}
      />
      <canvas ref={canvasRef} className="hidden" />
      <div className="absolute top-4 right-4 bg-slate-900/80 px-3 py-1 rounded-full border border-indigo-500/50 flex items-center gap-2">
        <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
        <span className="text-[10px] font-bold text-indigo-100 uppercase tracking-widest">Tracking Active</span>
      </div>
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-center pointer-events-none w-full px-10">
        <p className="text-white/60 text-xs bg-black/40 backdrop-blur-sm py-2 px-4 rounded-lg inline-block">
          Point your camera at your paper, iPad, or sketchbook
        </p>
      </div>
    </div>
  );
});

CameraTracker.displayName = 'CameraTracker';
export default CameraTracker;
