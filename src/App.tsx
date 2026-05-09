import { useState, useRef } from 'react';
import CanvasSketch, { ColorTheme } from './components/CanvasSketch';
import { Settings2, X, GripVertical } from 'lucide-react';
import { motion, useDragControls } from 'motion/react';

export const PRESETS: ColorTheme[] = [
  {
    name: 'Daydream (Default)',
    sunsetTop: '#d6dfee',
    sunsetMid: '#f4e9d2',
    sunsetHorizon: '#f2d0c5',
    waterTop: '#aeb8e6',
    waterBottom: '#d7cff0',
    wave: '#ffffff'
  },
  {
    name: 'Vaporwave',
    sunsetTop: '#2b1055',
    sunsetMid: '#75225e',
    sunsetHorizon: '#ff8a8a',
    waterTop: '#100342',
    waterBottom: '#2b0b4a',
    wave: '#00f0ff'
  },
  {
    name: 'Golden Hour',
    sunsetTop: '#486a9f',
    sunsetMid: '#9d7554',
    sunsetHorizon: '#d69947',
    waterTop: '#2e2c45',
    waterBottom: '#181528',
    wave: '#ffddaa'
  },
  {
    name: 'Midnight',
    sunsetTop: '#080c16',
    sunsetMid: '#120924',
    sunsetHorizon: '#3b0b3e',
    waterTop: '#0d0d19',
    waterBottom: '#1a103c',
    wave: '#ff0055'
  }
];

export default function App() {
  const [theme, setTheme] = useState<ColorTheme>(PRESETS[0]);
  const [isOpen, setIsOpen] = useState(false);
  const constraintsRef = useRef<HTMLDivElement>(null);
  const dragControls = useDragControls();

  const [recordingStatus, setRecordingStatus] = useState<"idle" | "starting" | "recording">("idle");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const toggleRecording = () => {
    if (recordingStatus === "recording") {
      stopRecording();
    } else if (recordingStatus === "idle") {
      setRecordingStatus("starting");
      setIsOpen(false);
      setTimeout(startRecording, 600); // Wait for panel to hide
    }
  };

  const startRecording = () => {
    const canvas = document.querySelector('#main-canvas') as HTMLCanvasElement;
    if (!canvas) {
      setRecordingStatus("idle");
      return;
    }
    
    try {
      const stream = canvas.captureStream(60);
      let recorder: MediaRecorder;
      // Use standard bitrates for high definition
      const optionsInfo = { videoBitsPerSecond: 8500000 };

      if (MediaRecorder.isTypeSupported('video/mp4')) {
         recorder = new MediaRecorder(stream, { mimeType: 'video/mp4', ...optionsInfo });
      } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) {
         recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9', ...optionsInfo });
      } else if (MediaRecorder.isTypeSupported('video/webm')) {
         recorder = new MediaRecorder(stream, { mimeType: 'video/webm', ...optionsInfo });
      } else {
         recorder = new MediaRecorder(stream, optionsInfo);
      }

      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'video/mp4' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const ext = recorder.mimeType.includes('webm') ? 'webm' : 'mp4';
        a.download = `canvas-recording-${Date.now()}.${ext}`;
        a.click();
        URL.revokeObjectURL(url);
        setRecordingStatus("idle");
        (window as any).isRecordingCanvas = false;
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecordingStatus("recording");
      (window as any).isRecordingCanvas = true;
    } catch (err) {
      console.error('Failed to start recording', err);
      setRecordingStatus("idle");
      (window as any).isRecordingCanvas = false;
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  };

  return (
    <main ref={constraintsRef} className="w-full h-screen bg-black overflow-hidden relative font-sans">
      <CanvasSketch theme={theme} />
      
      {/* Settings Trigger Icon (Visible when closed) */}
      <motion.button
        drag="y"
        dragConstraints={constraintsRef}
        dragElastic={0}
        dragMomentum={false}
        onClick={() => setIsOpen(true)}
        className={`absolute top-1/2 right-0 -translate-y-1/2 z-20 p-2 py-4 bg-white/10 hover:bg-white/20 backdrop-blur-xl rounded-l-xl border border-r-0 border-white/10 text-white/70 hover:text-white transition-opacity duration-500 shadow-lg cursor-grab active:cursor-grabbing flex items-center justify-center ${isOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
        title="Customize Theme"
      >
        <Settings2 size={20} />
      </motion.button>

      <motion.div
        drag={isOpen}
        dragControls={dragControls}
        dragListener={false}
        dragMomentum={false}
        dragConstraints={constraintsRef}
        variants={{
          closed: { x: '110%', y: '-50%' },
          open: { x: -16, y: '-50%' }
        }}
        initial="closed"
        animate={isOpen ? "open" : "closed"}
        transition={{ type: "spring", bounce: 0, duration: 0.5 }}
        style={{ position: 'absolute', top: '50%', right: '0px' }}
        className="z-30 w-72 bg-black/80 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl flex flex-col max-h-[calc(100vh-2rem)]"
      >
        {/* Panel Content Container */}
        <div className={`w-full h-full flex flex-col p-4 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
          <div 
            className="flex items-center justify-between mb-4 pb-2 border-b border-white/10 cursor-grab active:cursor-grabbing shrink-0"
            onPointerDown={(e) => dragControls.start(e)}
          >
            <div className="flex items-center text-white/50 pointer-events-none">
              <GripVertical size={16} className="mr-2" />
              <h2 className="font-sans font-medium text-sm tracking-wider uppercase text-white/80 select-none">Theme Customizer</h2>
            </div>
            <button 
              onClick={() => setIsOpen(false)}
              className="p-1 hover:bg-white/10 rounded-md transition-colors text-white/70 hover:text-white shrink-0"
            >
              <X size={16} />
            </button>
          </div>
          
          <div className="overflow-y-auto pr-2 flex-1 space-y-6 pb-2 scrollbar-thin scrollbar-thumb-white/20 hover:scrollbar-thumb-white/30">
            <div className="space-y-3">
              <h3 className="text-xs text-white/50 uppercase tracking-wide">Video Capture</h3>
              <button
                onClick={toggleRecording}
                className={`w-full text-xs font-medium py-2.5 rounded-lg flex items-center justify-center gap-2 transition-all ${
                  recordingStatus === 'recording' 
                    ? 'bg-red-500/20 text-red-400 border border-red-500/50 hover:bg-red-500/30' 
                    : recordingStatus === 'starting'
                    ? 'bg-white/20 text-white/50 pointer-events-none'
                    : 'bg-white/10 text-white border border-white/20 hover:bg-white/20'
                }`}
              >
                {recordingStatus === 'recording' ? (
                  <><span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />结束录制</>
                ) : recordingStatus === 'starting' ? (
                  '准备录制...'
                ) : (
                  '开始录制 (MP4)'
                )}
              </button>
            </div>

            <div className="space-y-3">
              <h3 className="text-xs text-white/50 uppercase tracking-wide">Presets</h3>
              <div className="grid grid-cols-1 gap-2">
                {PRESETS.map((preset, i) => (
                  <button
                    key={i}
                    onClick={() => setTheme(preset)}
                    className={`text-xs p-2.5 rounded-lg transition-all text-left ${theme.name === preset.name ? 'bg-white/20 border border-white/40 shadow-sm text-white' : 'bg-white/5 border border-white/10 hover:bg-white/10 text-white/70 hover:text-white'}`}
                  >
                    {preset.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
               <h3 className="text-xs text-white/50 uppercase tracking-wide">Custom Colors</h3>
               <ColorPicker label="Sunset Top" value={theme.sunsetTop} onChange={(v) => setTheme({...theme, sunsetTop: v, name: 'Custom'})} />
               <ColorPicker label="Sunset Mid" value={theme.sunsetMid} onChange={(v) => setTheme({...theme, sunsetMid: v, name: 'Custom'})} />
               <ColorPicker label="Sunset Horizon" value={theme.sunsetHorizon} onChange={(v) => setTheme({...theme, sunsetHorizon: v, name: 'Custom'})} />
               <div className="h-px bg-white/10 my-3" />
               <ColorPicker label="Water Top" value={theme.waterTop} onChange={(v) => setTheme({...theme, waterTop: v, name: 'Custom'})} />
               <ColorPicker label="Water Bottom" value={theme.waterBottom} onChange={(v) => setTheme({...theme, waterBottom: v, name: 'Custom'})} />
               <div className="h-px bg-white/10 my-3" />
               <ColorPicker label="Wave Text" value={theme.wave} onChange={(v) => setTheme({...theme, wave: v, name: 'Custom'})} />
            </div>
          </div>
        </div>
      </motion.div>
    </main>
  );
}

function ColorPicker({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };

  return (
    <div className="flex items-center justify-between">
      <label className="text-xs text-white/80 font-sans tracking-wide">{label}</label>
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-mono text-white/50 uppercase w-12 text-right">{value}</span>
        <div className="relative w-6 h-6 rounded-md overflow-hidden border border-white/20 hover:border-white/40 transition-colors shadow-sm">
          <input 
            type="color" 
            value={value} 
            onChange={handleChange}
            className="absolute -top-2 -left-2 w-10 h-10 cursor-pointer"
          />
        </div>
      </div>
    </div>
  )
}
