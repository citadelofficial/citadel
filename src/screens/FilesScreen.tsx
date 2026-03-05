import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Heart, ChevronUp, ChevronDown, FileText, Clock, HardDrive, FolderOpen,
  Download, Share2, BookOpen, User,
} from 'lucide-react';
import { BottomNav } from '../components/BottomNav';
import type { ClassData, FileData } from '../App';

interface Props {
  classes: ClassData[];
  initialClassId: string;
  onBack: () => void;
  onHome: () => void;
  onScan?: () => void;
  onFriends?: () => void;
}

export function FilesScreen({ classes, initialClassId, onBack, onHome, onScan, onFriends }: Props) {
  const initialIndex = Math.max(0, classes.findIndex((c) => c.id === initialClassId));
  const [activeTab, setActiveTab] = useState(initialIndex);
  const [expandedFile, setExpandedFile] = useState<number | null>(null);
  const [isPageLiked, setIsPageLiked] = useState(false);
  const [selectedFile, setSelectedFile] = useState<FileData | null>(null);
  const [isFileLiked, setIsFileLiked] = useState(false);

  const currentClass = classes[activeTab] || classes[0];
  const files = currentClass?.files || [];

  const handleTabChange = (index: number) => {
    setActiveTab(index);
    const cls = classes[index];
    if (cls?.files?.length > 0) {
      setExpandedFile(cls.files[0].id);
    } else {
      setExpandedFile(null);
    }
  };

  const openFileDetail = (file: FileData) => {
    setSelectedFile(file);
    setIsFileLiked(false);
  };

  const totalSize = files.reduce((acc, f) => {
    const sizeNum = parseFloat(f.size);
    return acc + sizeNum;
  }, 0);

  // === FILE DETAIL VIEW ===
  if (selectedFile) {
    return (
      <div className="h-full w-full bg-bg-secondary relative flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto hide-scrollbar pb-28">
          {/* Header */}
          <div className="bg-white px-6 pt-14 pb-5 rounded-b-[28px] shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <button onClick={() => setSelectedFile(null)} className="w-10 h-10 rounded-full bg-bg-secondary flex items-center justify-center">
                <ArrowLeft className="w-5 h-5 text-text-primary" />
              </button>
              <div className="flex items-center gap-2">
                <motion.button
                  whileTap={{ scale: 0.85 }}
                  onClick={() => setIsFileLiked(!isFileLiked)}
                  className={`w-10 h-10 rounded-full flex items-center justify-center shadow-sm transition-colors ${isFileLiked ? 'bg-red-500' : 'bg-bg-secondary'}`}
                >
                  <Heart className={`w-4.5 h-4.5 ${isFileLiked ? 'text-white' : 'text-text-primary'}`} fill={isFileLiked ? 'white' : 'none'} />
                </motion.button>
                <button className="w-10 h-10 rounded-full bg-bg-secondary flex items-center justify-center">
                  <Share2 className="w-4.5 h-4.5 text-text-primary" />
                </button>
              </div>
            </div>

            {/* File info */}
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 rounded-2xl overflow-hidden shrink-0 bg-bg-secondary shadow-sm">
                <img src={selectedFile.thumbnail} alt={selectedFile.name} className="w-full h-full object-cover" />
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="font-display text-lg font-bold text-text-primary leading-tight">{selectedFile.name}</h1>
                <p className="font-body text-xs text-text-secondary mt-1">{currentClass.title} • {currentClass.block}</p>
                <p className="font-body text-[11px] text-text-tertiary mt-0.5">Added {selectedFile.date}</p>
              </div>
            </div>

            {/* Stats */}
            <div className="flex items-center gap-4 mt-4">
              <div className="flex items-center gap-1.5 bg-bg-secondary px-3 py-1.5 rounded-full">
                <FileText className="w-3 h-3 text-maroon" />
                <span className="font-body text-[11px] font-medium text-text-primary">{selectedFile.pages} Pages</span>
              </div>
              <div className="flex items-center gap-1.5 bg-bg-secondary px-3 py-1.5 rounded-full">
                <HardDrive className="w-3 h-3 text-blue-500" />
                <span className="font-body text-[11px] font-medium text-text-primary">{selectedFile.size}</span>
              </div>
              <div className="flex items-center gap-1.5 bg-bg-secondary px-3 py-1.5 rounded-full">
                <Clock className="w-3 h-3 text-green-500" />
                <span className="font-body text-[11px] font-medium text-text-primary">{selectedFile.readTime}</span>
              </div>
            </div>
          </div>

          {/* Document Preview */}
          <div className="px-6 mt-5">
            <h2 className="font-display text-base font-bold text-text-primary mb-3">Document Preview</h2>
            <div className="bg-white rounded-3xl shadow-sm shadow-black/5 overflow-hidden">
              {/* Simulated document pages */}
              <div className="p-6">
                <div className="flex items-start gap-2 mb-4">
                  <BookOpen className="w-5 h-5 text-maroon mt-0.5 shrink-0" />
                  <h3 className="font-display text-base font-bold text-text-primary">{selectedFile.previewTitle}</h3>
                </div>
                <p className="font-body text-sm text-text-secondary leading-relaxed mb-4">{selectedFile.previewText}</p>

                {/* Simulated page content */}
                <div className="border-t border-gray-100 pt-4 mt-4">
                  <p className="font-body text-sm text-text-secondary leading-relaxed">
                    This document provides a comprehensive overview of the key concepts and frameworks essential for understanding this topic. 
                    It includes definitions, examples, case studies, and practice questions designed to reinforce learning outcomes.
                  </p>
                </div>

                <div className="border-t border-gray-100 pt-4 mt-4">
                  <h4 className="font-body text-sm font-semibold text-text-primary mb-2">Key Terms</h4>
                  <div className="space-y-2">
                    {['Primary concept definition and application in context',
                      'Secondary framework for analysis and evaluation',
                      'Comparative methodology and research standards',
                      'Application to real-world scenarios and case studies'].map((term, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-maroon mt-1.5 shrink-0" />
                        <p className="font-body text-xs text-text-secondary">{term}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border-t border-gray-100 pt-4 mt-4">
                  <h4 className="font-body text-sm font-semibold text-text-primary mb-2">Study Questions</h4>
                  <div className="space-y-3">
                    {[
                      'How does this concept relate to the broader unit theme?',
                      'Compare and contrast the two main frameworks discussed.',
                      'What evidence supports the main argument presented?',
                    ].map((q, i) => (
                      <div key={i} className="bg-bg-secondary rounded-xl p-3">
                        <p className="font-body text-xs text-text-primary">{i + 1}. {q}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Page indicator */}
              <div className="border-t border-gray-100 px-6 py-3 flex items-center justify-between">
                <span className="font-body text-[11px] text-text-tertiary">Page 1 of {selectedFile.pages}</span>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(selectedFile.pages, 5) }).map((_, i) => (
                    <div key={i} className={`w-1.5 h-1.5 rounded-full ${i === 0 ? 'bg-maroon' : 'bg-gray-300'}`} />
                  ))}
                  {selectedFile.pages > 5 && <span className="font-body text-[10px] text-text-tertiary ml-1">+{selectedFile.pages - 5}</span>}
                </div>
              </div>
            </div>
          </div>

          {/* Uploaded By */}
          <div className="px-6 mt-5">
            <h2 className="font-display text-base font-bold text-text-primary mb-3">Details</h2>
            <div className="bg-white rounded-3xl shadow-sm shadow-black/5 p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                  <User className="w-5 h-5 text-blue-500" strokeWidth={1.5} />
                </div>
                <div>
                  <p className="font-body text-sm font-semibold text-text-primary">Uploaded by You</p>
                  <p className="font-body text-[11px] text-text-tertiary">{selectedFile.date}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-bg-secondary rounded-2xl p-3 text-center">
                  <p className="font-display text-lg font-bold text-maroon">{selectedFile.pages}</p>
                  <p className="font-body text-[11px] text-text-tertiary">Pages</p>
                </div>
                <div className="bg-bg-secondary rounded-2xl p-3 text-center">
                  <p className="font-display text-lg font-bold text-blue-600">{selectedFile.size}</p>
                  <p className="font-body text-[11px] text-text-tertiary">File Size</p>
                </div>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="px-6 mt-5 mb-6 flex gap-3">
            <button className="flex-1 h-12 rounded-full bg-maroon text-white font-body text-sm font-semibold flex items-center justify-center gap-2 shadow-lg shadow-maroon/20 active:scale-[0.97] transition-transform">
              <Download className="w-4 h-4" /> Download
            </button>
            <button className="h-12 w-12 rounded-full bg-white border border-gray-200 flex items-center justify-center active:scale-95 transition-transform shadow-sm">
              <Share2 className="w-4.5 h-4.5 text-text-primary" />
            </button>
          </div>
        </div>

        <BottomNav active="files" onHome={onHome} onScan={onScan} onFriends={onFriends} onFiles={() => {}} />
      </div>
    );
  }

  // === FILE LIST VIEW ===
  return (
    <div className="h-full w-full bg-bg-secondary relative">
      <div className="relative z-10 h-full overflow-y-auto hide-scrollbar pb-28">
        {/* Header */}
        <div className="px-6 pt-14 pb-2">
          <div className="flex items-center justify-between">
            <button onClick={onBack} className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm">
              <ArrowLeft className="w-5 h-5 text-text-primary" />
            </button>
            <div className="text-center">
              <h1 className="font-display text-lg font-bold text-text-primary">Your Files</h1>
              <p className="font-body text-[11px] text-text-tertiary mt-0.5">Saved - 2:13 AM</p>
            </div>
            <motion.button
              whileTap={{ scale: 0.85 }}
              onClick={() => setIsPageLiked(!isPageLiked)}
              className={`w-10 h-10 rounded-full flex items-center justify-center shadow-sm transition-colors ${isPageLiked ? 'bg-red-500' : 'bg-white'}`}
            >
              <Heart className={`w-5 h-5 ${isPageLiked ? 'text-white' : 'text-text-primary'}`} fill={isPageLiked ? 'white' : 'none'} />
            </motion.button>
          </div>
        </div>

        {/* Tab Switcher */}
        <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }} className="flex gap-2 px-6 mt-4 overflow-x-auto hide-scrollbar">
          {classes.map((cls, i) => {
            const shortName = cls.title.length > 14 ? cls.title.substring(0, 14) + '...' : cls.title;
            return (
              <button
                key={cls.id}
                onClick={() => handleTabChange(i)}
                className={`px-5 py-2.5 rounded-full font-body text-sm font-medium whitespace-nowrap transition-all duration-300 ${activeTab === i ? 'bg-maroon text-white shadow-md shadow-maroon/20' : 'bg-white text-text-secondary'}`}
              >
                {shortName}
              </button>
            );
          })}
        </motion.div>

        {/* Sub Header */}
        <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }} className="px-6 mt-6">
          <h2 className="font-display text-xl font-bold text-text-primary">{currentClass?.title || 'No Class'}</h2>
          {currentClass && (
            <p className="font-body text-xs text-text-secondary mt-1">{currentClass.block} • {files.length} file{files.length !== 1 ? 's' : ''}</p>
          )}
        </motion.div>

        {/* File List or Empty State */}
        {files.length > 0 ? (
          <div className="px-6 mt-4 flex flex-col gap-3">
            {files.map((file, i) => {
              const isExpanded = expandedFile === file.id;
              return (
                <motion.div
                  key={file.id}
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.25 + i * 0.1 }}
                  className="bg-white rounded-3xl shadow-sm shadow-black/5 overflow-hidden"
                >
                  <button onClick={() => setExpandedFile(isExpanded ? null : file.id)} className="w-full flex items-center gap-3 p-4">
                    <div className="w-14 h-10 rounded-xl overflow-hidden shrink-0 bg-bg-secondary">
                      <img src={file.thumbnail} alt={file.name} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 text-left min-w-0">
                      <p className="font-body text-[11px] text-text-tertiary">{file.date}</p>
                      <p className="font-body text-sm font-semibold text-text-primary truncate">{file.name}</p>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-bg-secondary flex items-center justify-center shrink-0">
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-text-secondary" /> : <ChevronDown className="w-4 h-4 text-text-secondary" />}
                    </div>
                  </button>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3, ease: 'easeInOut' }} className="overflow-hidden">
                        <div className="px-4 pb-4">
                          <div className="border-2 border-gray-100 rounded-2xl p-4 bg-bg-secondary/50">
                            <div className="flex items-start gap-2 mb-2">
                              <FileText className="w-4 h-4 text-maroon mt-0.5 shrink-0" />
                              <h4 className="font-display text-sm font-bold text-text-primary">{file.previewTitle}</h4>
                            </div>
                            <p className="font-body text-xs text-text-secondary leading-relaxed line-clamp-4">{file.previewText}</p>
                          </div>
                          <div className="flex items-center justify-between mt-3 px-1">
                            <div className="flex items-center gap-4">
                              <div className="flex items-center gap-1.5">
                                <HardDrive className="w-3 h-3 text-text-tertiary" />
                                <span className="font-body text-[11px] text-text-secondary">{file.pages} Pages • {file.size}</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <Clock className="w-3 h-3 text-text-tertiary" />
                                <span className="font-body text-[11px] text-text-secondary">{file.readTime}</span>
                              </div>
                            </div>
                          </div>
                          {/* Open full view button */}
                          <button
                            onClick={() => openFileDetail(file)}
                            className="w-full mt-3 h-10 rounded-2xl bg-maroon text-white font-body text-xs font-semibold flex items-center justify-center gap-2 active:scale-[0.97] transition-transform shadow-md shadow-maroon/20"
                          >
                            <BookOpen className="w-3.5 h-3.5" /> Open Full View
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        ) : (
          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.25 }} className="px-6 mt-6">
            <div className="bg-white rounded-3xl p-8 text-center shadow-sm shadow-black/5">
              <div className="w-16 h-16 rounded-full bg-bg-secondary flex items-center justify-center mx-auto mb-4">
                <FolderOpen className="w-7 h-7 text-text-tertiary" />
              </div>
              <h3 className="font-display text-base font-bold text-text-primary">No Files Yet</h3>
              <p className="font-body text-sm text-text-secondary mt-1.5 leading-relaxed">
                Scan or upload your first notes for {currentClass?.title || 'this class'} to get started.
              </p>
              <button className="mt-4 h-10 px-5 bg-maroon text-white font-body text-sm font-semibold rounded-full active:scale-95 transition-transform shadow-md shadow-maroon/20">
                Upload Files
              </button>
            </div>
          </motion.div>
        )}

        {/* Storage info */}
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.6 }} className="px-6 mt-6">
          <div className="bg-white rounded-3xl p-5 shadow-sm shadow-black/5">
            <div className="flex items-center justify-between mb-2">
              <span className="font-body text-sm font-medium text-text-primary">Storage Used</span>
              <span className="font-body text-xs text-text-tertiary">{totalSize.toFixed(1)} MB / 1 GB</span>
            </div>
            <div className="h-1.5 bg-bg-secondary rounded-full overflow-hidden">
              <div className="h-full bg-maroon rounded-full" style={{ width: `${Math.min((totalSize / 1024) * 100, 100)}%` }} />
            </div>
          </div>
        </motion.div>
      </div>

      <BottomNav active="files" onHome={onHome} onScan={onScan} onFriends={onFriends} onFiles={() => {}} />
    </div>
  );
}
