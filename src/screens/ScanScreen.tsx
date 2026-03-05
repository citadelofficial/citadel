import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Zap,
  FlipHorizontal,
  Image,
  X,
  FileText,
  BookOpen,
  PenTool,
  Check,
  ChevronRight,
  ScanLine,
} from 'lucide-react';
import { BottomNav } from '../components/BottomNav';

interface Props {
  onHome: () => void;
  onFiles: () => void;
  onFriends: () => void;
}

type ScanMode = 'notes' | 'document' | 'whiteboard';
type ScanState = 'ready' | 'scanning' | 'scanned';

const recentScans = [
  {
    id: 1,
    title: 'AP HUG Unit 5 Notes',
    date: 'Today, 3:45 PM',
    pages: 3,
    course: 'AP Human Geo',
  },
  {
    id: 2,
    title: 'Biology Lab Report',
    date: 'Yesterday, 11:20 AM',
    pages: 5,
    course: 'AP Biology',
  },
  {
    id: 3,
    title: 'Math Homework Ch.7',
    date: 'Jan 28, 2026',
    pages: 2,
    course: 'Calculus',
  },
];

export function ScanScreen({ onHome, onFiles, onFriends }: Props) {
  const [scanMode, setScanMode] = useState<ScanMode>('notes');
  const [scanState, setScanState] = useState<ScanState>('ready');
  const [flashOn, setFlashOn] = useState(false);

  const modes: { id: ScanMode; label: string; icon: typeof FileText }[] = [
    { id: 'notes', label: 'Notes', icon: PenTool },
    { id: 'document', label: 'Document', icon: FileText },
    { id: 'whiteboard', label: 'Whiteboard', icon: BookOpen },
  ];

  const handleScan = () => {
    setScanState('scanning');
    setTimeout(() => {
      setScanState('scanned');
    }, 2000);
  };

  const resetScan = () => {
    setScanState('ready');
  };

  return (
    <div className="h-full w-full bg-[#0a0a0a] relative flex flex-col">
      {/* Camera Viewfinder Area */}
      <div className="flex-1 relative overflow-hidden">
        {/* Simulated camera feed - dark with grain texture */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#1a1a1a] via-[#111] to-[#0a0a0a]">
          {/* Subtle grid pattern to simulate viewfinder */}
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage:
                'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
              backgroundSize: '20px 20px',
            }}
          />
        </div>

        {/* Top Controls */}
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="relative z-10 flex items-center justify-between px-6 pt-14"
        >
          <button
            onClick={onHome}
            className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center"
          >
            <X className="w-5 h-5 text-white" />
          </button>

          <div className="flex items-center gap-2">
            <h1 className="font-display text-lg font-bold text-white">Scan</h1>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setFlashOn(!flashOn)}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                flashOn ? 'bg-yellow-400' : 'bg-white/10 backdrop-blur-md'
              }`}
            >
              <Zap
                className={`w-5 h-5 ${flashOn ? 'text-black' : 'text-white'}`}
                fill={flashOn ? 'currentColor' : 'none'}
              />
            </button>
          </div>
        </motion.div>

        {/* Scan Mode Tabs */}
        <motion.div
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="relative z-10 flex items-center justify-center gap-2 mt-5"
        >
          {modes.map((mode) => (
            <button
              key={mode.id}
              onClick={() => setScanMode(mode.id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full font-body text-xs font-medium transition-all duration-300 ${
                scanMode === mode.id
                  ? 'bg-maroon text-white shadow-lg shadow-maroon/30'
                  : 'bg-white/10 backdrop-blur-sm text-white/70'
              }`}
            >
              <mode.icon className="w-3.5 h-3.5" />
              {mode.label}
            </button>
          ))}
        </motion.div>

        {/* Viewfinder Frame */}
        <div className="relative z-10 flex-1 flex items-center justify-center px-10 mt-6">
          <AnimatePresence mode="wait">
            {scanState === 'ready' && (
              <motion.div
                key="ready"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full aspect-[3/4] relative max-h-[340px]"
              >
                {/* Corner brackets */}
                <div className="absolute top-0 left-0 w-10 h-10 border-t-[3px] border-l-[3px] border-white rounded-tl-xl" />
                <div className="absolute top-0 right-0 w-10 h-10 border-t-[3px] border-r-[3px] border-white rounded-tr-xl" />
                <div className="absolute bottom-0 left-0 w-10 h-10 border-b-[3px] border-l-[3px] border-white rounded-bl-xl" />
                <div className="absolute bottom-0 right-0 w-10 h-10 border-b-[3px] border-r-[3px] border-white rounded-br-xl" />

                {/* Center guide text */}
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <ScanLine className="w-12 h-12 text-white/20 mb-3" />
                  <p className="font-body text-sm text-white/40 text-center">
                    Position your {scanMode === 'whiteboard' ? 'whiteboard' : scanMode === 'document' ? 'document' : 'notes'} here
                  </p>
                  <p className="font-body text-xs text-white/25 mt-1">
                    Align edges within the frame
                  </p>
                </div>
              </motion.div>
            )}

            {scanState === 'scanning' && (
              <motion.div
                key="scanning"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="w-full aspect-[3/4] relative max-h-[340px]"
              >
                {/* Animated scan line */}
                <motion.div
                  className="absolute left-4 right-4 h-[2px] bg-maroon shadow-[0_0_15px_rgba(61,12,17,0.8)] z-10"
                  animate={{ top: ['5%', '95%', '5%'] }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                />
                {/* Corner brackets */}
                <div className="absolute top-0 left-0 w-10 h-10 border-t-[3px] border-l-[3px] border-maroon rounded-tl-xl" />
                <div className="absolute top-0 right-0 w-10 h-10 border-t-[3px] border-r-[3px] border-maroon rounded-tr-xl" />
                <div className="absolute bottom-0 left-0 w-10 h-10 border-b-[3px] border-l-[3px] border-maroon rounded-bl-xl" />
                <div className="absolute bottom-0 right-0 w-10 h-10 border-b-[3px] border-r-[3px] border-maroon rounded-br-xl" />

                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="flex flex-col items-center">
                    <div className="w-10 h-10 border-2 border-maroon border-t-transparent rounded-full animate-spin mb-3" />
                    <p className="font-body text-sm text-white/60">Scanning...</p>
                  </div>
                </div>
              </motion.div>
            )}

            {scanState === 'scanned' && (
              <motion.div
                key="scanned"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="w-full aspect-[3/4] relative max-h-[340px] bg-white rounded-2xl overflow-hidden shadow-2xl"
              >
                {/* Simulated scanned document */}
                <div className="p-5 h-full">
                  <div className="space-y-2 mb-4">
                    <div className="h-3 bg-gray-800 rounded-full w-3/4" />
                    <div className="h-2 bg-gray-300 rounded-full w-full" />
                    <div className="h-2 bg-gray-300 rounded-full w-5/6" />
                    <div className="h-2 bg-gray-200 rounded-full w-full" />
                    <div className="h-2 bg-gray-300 rounded-full w-2/3" />
                  </div>
                  <div className="space-y-2 mb-4">
                    <div className="h-2.5 bg-gray-700 rounded-full w-1/2" />
                    <div className="h-2 bg-gray-200 rounded-full w-full" />
                    <div className="h-2 bg-gray-300 rounded-full w-4/5" />
                    <div className="h-2 bg-gray-200 rounded-full w-full" />
                    <div className="h-2 bg-gray-300 rounded-full w-3/4" />
                    <div className="h-2 bg-gray-200 rounded-full w-5/6" />
                  </div>
                  <div className="w-full h-16 bg-gray-100 rounded-lg mt-3" />
                  <div className="space-y-2 mt-4">
                    <div className="h-2 bg-gray-300 rounded-full w-full" />
                    <div className="h-2 bg-gray-200 rounded-full w-3/4" />
                    <div className="h-2 bg-gray-300 rounded-full w-5/6" />
                  </div>
                </div>

                {/* Success overlay */}
                <div className="absolute inset-0 bg-maroon/10 flex items-center justify-center">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', delay: 0.2 }}
                    className="w-16 h-16 rounded-full bg-maroon flex items-center justify-center shadow-xl shadow-maroon/40"
                  >
                    <Check className="w-8 h-8 text-white" />
                  </motion.div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Bottom Controls */}
        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.25 }}
          className="relative z-10 px-6 pb-4 mt-4"
        >
          {scanState === 'scanned' ? (
            <motion.div
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="flex flex-col gap-2.5"
            >
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-maroon/20 flex items-center justify-center">
                    <FileText className="w-5 h-5 text-maroon" />
                  </div>
                  <div className="flex-1">
                    <p className="font-body text-sm font-semibold text-white">Scan Complete</p>
                    <p className="font-body text-xs text-white/50">1 page • Enhanced quality</p>
                  </div>
                </div>
              </div>
              <div className="flex gap-2.5">
                <button
                  onClick={resetScan}
                  className="flex-1 h-12 bg-white/10 backdrop-blur-md text-white font-body font-semibold text-sm rounded-full active:scale-[0.97] transition-transform"
                >
                  Retake
                </button>
                <button
                  onClick={onFiles}
                  className="flex-1 h-12 bg-maroon text-white font-body font-semibold text-sm rounded-full active:scale-[0.97] transition-transform shadow-lg shadow-maroon/30 flex items-center justify-center gap-2"
                >
                  Save
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          ) : (
            <div className="flex items-center justify-between">
              {/* Gallery button */}
              <button className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center">
                <Image className="w-5 h-5 text-white" />
              </button>

              {/* Shutter button */}
              <button
                onClick={handleScan}
                disabled={scanState === 'scanning'}
                className="relative"
              >
                <div className="w-[72px] h-[72px] rounded-full border-[3px] border-white flex items-center justify-center">
                  <motion.div
                    animate={scanState === 'scanning' ? { scale: [1, 0.85, 1] } : {}}
                    transition={scanState === 'scanning' ? { duration: 1, repeat: Infinity } : {}}
                    className="w-[58px] h-[58px] rounded-full bg-white"
                  />
                </div>
              </button>

              {/* Flip camera */}
              <button className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center">
                <FlipHorizontal className="w-5 h-5 text-white" />
              </button>
            </div>
          )}
        </motion.div>
      </div>

      {/* Recent Scans Section */}
      <motion.div
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="bg-[#1a1a1a] rounded-t-[28px] px-6 pt-5 pb-28"
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-base font-bold text-white">Recent Scans</h2>
          <button className="font-body text-xs text-white/40">See all</button>
        </div>

        <div className="flex flex-col gap-2">
          {recentScans.map((scan) => (
            <button
              key={scan.id}
              className="flex items-center gap-3 bg-white/5 rounded-2xl p-3 text-left transition-all active:bg-white/10"
            >
              <div className="w-11 h-11 rounded-xl bg-maroon/15 flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5 text-maroon" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-body text-sm font-semibold text-white truncate">
                  {scan.title}
                </p>
                <p className="font-body text-[11px] text-white/40">
                  {scan.date} • {scan.pages} pages
                </p>
              </div>
              <span className="font-body text-[10px] font-medium text-white/30 bg-white/5 px-2.5 py-1 rounded-full shrink-0">
                {scan.course}
              </span>
            </button>
          ))}
        </div>
      </motion.div>

      <BottomNav active="scan" onHome={onHome} onFiles={onFiles} onScan={() => {}} onFriends={onFriends} />
    </div>
  );
}
