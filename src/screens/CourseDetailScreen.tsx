import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Heart, Users, FileText, ArrowRight, Clock, X, Copy, Check, Share2, Mail,
  Edit3, ImagePlus, ChevronDown, Plus, Upload, Sparkles, BookOpen, ChevronRight,
  Layers, FolderOpen, FileUp, PenLine, Trash2,
} from 'lucide-react';
import { BottomNav } from '../components/BottomNav';
import type { ClassData, UnitData, SubUnit, SubUnitNote } from '../App';

interface Props {
  classData: ClassData;
  onBack: () => void;
  onFilesOpen: () => void;
  onScan?: () => void;
  onFriends?: () => void;
  onUpdateClass: (updatedClass: ClassData) => void;
}

type ViewMode = 'main' | 'unit-detail' | 'edit';

export function CourseDetailScreen({ classData, onBack, onFilesOpen, onScan, onFriends, onUpdateClass }: Props) {
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [isCourseLiked, setIsCourseLiked] = useState(false);
  const [likedUnits, setLikedUnits] = useState<Set<number>>(new Set());

  // View mode
  const [viewMode, setViewMode] = useState<ViewMode>('main');

  // Unit detail view
  const [selectedUnit, setSelectedUnit] = useState<UnitData | null>(null);
  const [expandedSubUnit, setExpandedSubUnit] = useState<string | null>(null);

  // Smart Merge
  const [showSmartMerge, setShowSmartMerge] = useState(false);
  const [mergeTargetSubUnit, setMergeTargetSubUnit] = useState<string | null>(null);
  const [mergeSelectedNotes, setMergeSelectedNotes] = useState<Set<number>>(new Set());
  const [merging, setMerging] = useState(false);
  const [mergeComplete, setMergeComplete] = useState(false);
  const [mergeExtraContent, setMergeExtraContent] = useState('');

  // Add Notes
  const [showAddNotes, setShowAddNotes] = useState(false);
  const [addNotesTargetSubUnit, setAddNotesTargetSubUnit] = useState<string | null>(null);
  const [addNotesTab, setAddNotesTab] = useState<'write' | 'upload' | 'import'>('write');
  const [addNoteTitle, setAddNoteTitle] = useState('');
  const [addNoteContent, setAddNoteContent] = useState('');
  const [addNoteUploaded, setAddNoteUploaded] = useState(false);
  const [addNoteImportedFile, setAddNoteImportedFile] = useState<number | null>(null);
  const [addingNote, setAddingNote] = useState(false);
  const [addNoteComplete, setAddNoteComplete] = useState(false);

  // Edit mode
  const [editTitle, setEditTitle] = useState(classData.title);
  const [editBlock, setEditBlock] = useState(classData.block);
  const [editDescription, setEditDescription] = useState(classData.description);
  const [editImage, setEditImage] = useState<string | null>(null);
  const [showBlockDropdown, setShowBlockDropdown] = useState(false);

  // Create unit
  const [showCreateUnit, setShowCreateUnit] = useState(false);
  const [newUnitTitle, setNewUnitTitle] = useState('');
  const [newUnitExamDate, setNewUnitExamDate] = useState('');

  // Stable class code
  const classCode = useMemo(() => {
    const prefix = classData.title.replace(/\s+/g, '').substring(0, 4).toUpperCase();
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let suffix = '';
    let seed = 0;
    for (let i = 0; i < classData.id.length; i++) seed += classData.id.charCodeAt(i);
    for (let i = 0; i < 4; i++) {
      suffix += chars.charAt((seed * (i + 7) + i * 13) % chars.length);
    }
    return `CTD-${prefix}-${suffix}`;
  }, [classData.id, classData.title]);

  const inviteLink = `citadel.app/join/${classCode.toLowerCase().replace(/\s+/g, '')}`;

  const copyCode = () => {
    navigator.clipboard?.writeText(classCode).catch(() => {});
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  };

  const copyLink = () => {
    navigator.clipboard?.writeText(inviteLink).catch(() => {});
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const toggleUnitLike = (unitId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setLikedUnits((prev) => {
      const next = new Set(prev);
      if (next.has(unitId)) next.delete(unitId);
      else next.add(unitId);
      return next;
    });
  };

  const isNewClass = classData.classmates === 0 && classData.documents === 0;
  const blockOptions = ['Block 1', 'Block 2', 'Block 3', 'Block 4', 'Block 5', 'Block 6', 'Block 7', 'Block 8'];

  // === EDIT HANDLERS ===
  const openEdit = () => {
    setEditTitle(classData.title);
    setEditBlock(classData.block);
    setEditDescription(classData.description);
    setEditImage(null);
    setViewMode('edit');
  };

  const saveEdit = () => {
    onUpdateClass({
      ...classData,
      title: editTitle.trim() || classData.title,
      block: editBlock,
      description: editDescription.trim() || classData.description,
      image: editImage || classData.image,
    });
    setViewMode('main');
  };

  const handleEditImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setEditImage(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  // === UNIT HANDLERS ===
  const openUnit = (unit: UnitData) => {
    setSelectedUnit(unit);
    setExpandedSubUnit(unit.subUnits.length > 0 ? unit.subUnits[0].id : null);
    setViewMode('unit-detail');
  };

  const createUnit = () => {
    if (!newUnitTitle.trim()) return;
    const newUnit: UnitData = {
      id: Date.now(),
      title: newUnitTitle.trim(),
      pages: 0,
      collaborators: 0,
      examDate: newUnitExamDate || 'TBD',
      daysLeft: newUnitExamDate ? Math.max(0, Math.floor((new Date(newUnitExamDate).getTime() - Date.now()) / 86400000)) : 0,
      subUnits: [
        { id: `${Date.now()}.1`, title: `${newUnitTitle.trim()} - Section 1`, notes: [] },
      ],
    };
    onUpdateClass({ ...classData, units: [...classData.units, newUnit] });
    setShowCreateUnit(false);
    setNewUnitTitle('');
    setNewUnitExamDate('');
  };

  // === SMART MERGE ===
  const startSmartMerge = (subUnitId: string) => {
    setMergeTargetSubUnit(subUnitId);
    setMergeSelectedNotes(new Set());
    setMergeExtraContent('');
    setMerging(false);
    setMergeComplete(false);
    setShowSmartMerge(true);
  };

  const toggleMergeNote = (noteId: number) => {
    setMergeSelectedNotes(prev => {
      const next = new Set(prev);
      if (next.has(noteId)) next.delete(noteId);
      else next.add(noteId);
      return next;
    });
  };

  const getTargetSubUnitNotes = (): SubUnitNote[] => {
    if (!selectedUnit || !mergeTargetSubUnit) return [];
    const su = selectedUnit.subUnits.find(s => s.id === mergeTargetSubUnit);
    return su?.notes || [];
  };

  const executeSmartMerge = () => {
    if (!selectedUnit || !mergeTargetSubUnit || mergeSelectedNotes.size < 2) return;
    setMerging(true);

    setTimeout(() => {
      const targetSu = selectedUnit.subUnits.find(s => s.id === mergeTargetSubUnit);
      if (!targetSu) return;

      const notesToMerge = targetSu.notes.filter(n => mergeSelectedNotes.has(n.id));
      const remainingNotes = targetSu.notes.filter(n => !mergeSelectedNotes.has(n.id));

      // Create merged note
      const mergedTitle = `Merged: ${notesToMerge.map(n => n.title).join(' + ')}`;
      const mergedContent = notesToMerge.map(n => `[${n.title} by ${n.author}]\n${n.content}`).join('\n\n---\n\n') + (mergeExtraContent ? `\n\n---\n\n[Your additions]\n${mergeExtraContent}` : '');
      const mergedPages = notesToMerge.reduce((a, n) => a + n.pages, 0);

      const mergedNote: SubUnitNote = {
        id: Date.now(),
        title: mergedTitle,
        author: 'Smart Merge',
        date: new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }),
        pages: mergedPages,
        content: mergedContent,
      };

      const updatedUnits = classData.units.map(u => {
        if (u.id !== selectedUnit.id) return u;
        return {
          ...u,
          subUnits: u.subUnits.map(su => {
            if (su.id !== mergeTargetSubUnit) return su;
            return { ...su, notes: [...remainingNotes, mergedNote] };
          }),
        };
      });

      onUpdateClass({ ...classData, units: updatedUnits });
      const updatedUnit = updatedUnits.find(u => u.id === selectedUnit.id);
      if (updatedUnit) setSelectedUnit(updatedUnit);

      setMerging(false);
      setMergeComplete(true);
      setTimeout(() => {
        setShowSmartMerge(false);
        setMergeComplete(false);
      }, 1200);
    }, 2200);
  };

  // === ADD NOTES ===
  const startAddNotes = (subUnitId: string) => {
    setAddNotesTargetSubUnit(subUnitId);
    setAddNotesTab('write');
    setAddNoteTitle('');
    setAddNoteContent('');
    setAddNoteUploaded(false);
    setAddNoteImportedFile(null);
    setAddingNote(false);
    setAddNoteComplete(false);
    setShowAddNotes(true);
  };

  const executeAddNote = () => {
    if (!selectedUnit || !addNotesTargetSubUnit) return;

    let title = addNoteTitle.trim();
    let content = addNoteContent.trim();
    let pages = 1;

    if (addNotesTab === 'upload') {
      title = title || 'Uploaded Notes';
      content = content || 'Content from uploaded file.';
      pages = 2;
    } else if (addNotesTab === 'import' && addNoteImportedFile !== null) {
      const importedFile = classData.files.find(f => f.id === addNoteImportedFile);
      if (importedFile) {
        title = title || importedFile.previewTitle;
        content = content || importedFile.previewText;
        pages = importedFile.pages;
      }
    }

    if (!title) return;

    setAddingNote(true);

    setTimeout(() => {
      const newNote: SubUnitNote = {
        id: Date.now(),
        title,
        author: 'You',
        date: new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }),
        pages,
        content: content || 'Added notes.',
      };

      const updatedUnits = classData.units.map(u => {
        if (u.id !== selectedUnit.id) return u;
        return {
          ...u,
          pages: u.pages + newNote.pages,
          subUnits: u.subUnits.map(su => {
            if (su.id !== addNotesTargetSubUnit) return su;
            return { ...su, notes: [...su.notes, newNote] };
          }),
        };
      });

      onUpdateClass({ ...classData, units: updatedUnits, documents: classData.documents + 1 });
      const updatedUnit = updatedUnits.find(u => u.id === selectedUnit.id);
      if (updatedUnit) setSelectedUnit(updatedUnit);

      setAddingNote(false);
      setAddNoteComplete(true);
      setTimeout(() => {
        setShowAddNotes(false);
        setAddNoteComplete(false);
      }, 1200);
    }, 1000);
  };

  // Add sub-unit to selected unit
  const addSubUnit = () => {
    if (!selectedUnit) return;
    const existingCount = selectedUnit.subUnits.length;
    const baseNum = selectedUnit.title.replace(/[^0-9]/g, '') || String(selectedUnit.id);
    const newSubUnit: SubUnit = {
      id: `${baseNum}.${existingCount + 1}-${Date.now()}`,
      title: `${baseNum}.${existingCount + 1} New Section`,
      notes: [],
    };
    const updatedUnit = { ...selectedUnit, subUnits: [...selectedUnit.subUnits, newSubUnit] };
    setSelectedUnit(updatedUnit);
    const updatedUnits = classData.units.map((u) => u.id === selectedUnit.id ? updatedUnit : u);
    onUpdateClass({ ...classData, units: updatedUnits });
  };

  // Delete note
  const deleteNote = (subUnitId: string, noteId: number) => {
    if (!selectedUnit) return;
    const updatedUnits = classData.units.map(u => {
      if (u.id !== selectedUnit.id) return u;
      return {
        ...u,
        subUnits: u.subUnits.map(su => {
          if (su.id !== subUnitId) return su;
          return { ...su, notes: su.notes.filter(n => n.id !== noteId) };
        }),
      };
    });
    onUpdateClass({ ...classData, units: updatedUnits });
    const updatedUnit = updatedUnits.find(u => u.id === selectedUnit.id);
    if (updatedUnit) setSelectedUnit(updatedUnit);
  };

  // ================ RENDER ================

  // === EDIT VIEW ===
  if (viewMode === 'edit') {
    return (
      <div className="h-full w-full bg-white relative flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto hide-scrollbar pb-10">
          {/* Header */}
          <div className="px-6 pt-14 pb-4 flex items-center justify-between">
            <button onClick={() => setViewMode('main')} className="w-10 h-10 rounded-full bg-bg-secondary flex items-center justify-center">
              <ArrowLeft className="w-5 h-5 text-text-primary" />
            </button>
            <h1 className="font-display text-lg font-bold text-text-primary">Edit Class</h1>
            <button onClick={saveEdit} className="px-4 py-2 rounded-full bg-maroon text-white font-body text-sm font-semibold">
              Save
            </button>
          </div>

          <div className="px-6">
            {/* Image */}
            <div className="rounded-2xl overflow-hidden relative mb-6" style={{ height: '160px' }}>
              <img src={editImage || classData.image} alt="" className="absolute inset-0 w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/30" />
              <label className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer gap-2">
                <div className="w-12 h-12 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center">
                  <ImagePlus className="w-5 h-5 text-text-primary" />
                </div>
                <span className="font-body text-xs text-white font-medium">Change Photo</span>
                <input type="file" accept="image/*" onChange={handleEditImageUpload} className="hidden" />
              </label>
              {editImage && (
                <button onClick={() => setEditImage(null)} className="absolute top-3 right-3 w-8 h-8 rounded-full bg-red-500 flex items-center justify-center">
                  <X className="w-4 h-4 text-white" />
                </button>
              )}
            </div>

            {/* Class Name */}
            <label className="font-body text-xs font-semibold text-text-secondary tracking-wide uppercase mb-2 block">Class Name</label>
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="w-full h-[52px] px-5 bg-input-bg rounded-2xl font-body text-sm text-text-primary outline-none focus:ring-2 focus:ring-maroon/20 transition-all mb-5"
            />

            {/* Block */}
            <label className="font-body text-xs font-semibold text-text-secondary tracking-wide uppercase mb-2 block">Block / Period</label>
            <div className="relative mb-5">
              <button onClick={() => setShowBlockDropdown(!showBlockDropdown)} className="w-full h-[52px] px-5 bg-input-bg rounded-2xl font-body text-sm text-left flex items-center justify-between">
                <span className="text-text-primary">{editBlock}</span>
                <motion.div animate={{ rotate: showBlockDropdown ? 180 : 0 }}><ChevronDown className="w-4 h-4 text-text-tertiary" /></motion.div>
              </button>
              <AnimatePresence>
                {showBlockDropdown && (
                  <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-30">
                    <div className="max-h-[200px] overflow-y-auto hide-scrollbar py-1">
                      {blockOptions.map((block) => (
                        <button key={block} onClick={() => { setEditBlock(block); setShowBlockDropdown(false); }} className={`w-full text-left px-5 py-3 font-body text-sm flex items-center justify-between ${editBlock === block ? 'bg-maroon/5 text-maroon font-medium' : 'text-text-primary'}`}>
                          {block}
                          {editBlock === block && <Check className="w-4 h-4 text-maroon" />}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Description */}
            <label className="font-body text-xs font-semibold text-text-secondary tracking-wide uppercase mb-2 block">Description</label>
            <textarea
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              rows={4}
              className="w-full px-5 py-4 bg-input-bg rounded-2xl font-body text-sm text-text-primary outline-none focus:ring-2 focus:ring-maroon/20 transition-all resize-none mb-5"
              placeholder="What are you currently studying?"
            />

            {/* Danger Zone */}
            <div className="bg-red-50 rounded-2xl p-5 mt-4">
              <p className="font-body text-xs font-semibold text-red-600 uppercase tracking-wider mb-2">Danger Zone</p>
              <p className="font-body text-xs text-red-500 mb-3">Leaving this class will remove all your progress.</p>
              <button className="h-10 px-5 rounded-full bg-red-100 text-red-600 font-body text-sm font-semibold active:scale-95 transition-transform">
                Leave Class
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // === UNIT DETAIL VIEW ===
  if (viewMode === 'unit-detail' && selectedUnit) {
    const totalNotes = selectedUnit.subUnits.reduce((a, su) => a + su.notes.length, 0);

    return (
      <div className="h-full w-full bg-bg-secondary relative flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto hide-scrollbar pb-28">
          {/* Header */}
          <div className="bg-white px-6 pt-14 pb-5 rounded-b-[28px] shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <button onClick={() => setViewMode('main')} className="w-10 h-10 rounded-full bg-bg-secondary flex items-center justify-center">
                <ArrowLeft className="w-5 h-5 text-text-primary" />
              </button>
              <div className="flex items-center gap-2">
                <button onClick={() => startAddNotes(selectedUnit.subUnits[0]?.id || '')} className="h-9 px-4 rounded-full bg-maroon/10 flex items-center gap-2 active:scale-95 transition-transform">
                  <Plus className="w-3.5 h-3.5 text-maroon" />
                  <span className="font-body text-xs font-semibold text-maroon">Add</span>
                </button>
                <button onClick={() => startSmartMerge(selectedUnit.subUnits[0]?.id || '')} className="h-9 px-4 rounded-full bg-maroon flex items-center gap-2 active:scale-95 transition-transform shadow-md shadow-maroon/20">
                  <Sparkles className="w-3.5 h-3.5 text-white" />
                  <span className="font-body text-xs font-semibold text-white">Merge</span>
                </button>
              </div>
            </div>
            <h1 className="font-display text-2xl font-bold text-text-primary">{selectedUnit.title}</h1>
            <p className="font-body text-sm text-text-secondary mt-1">{classData.title}</p>
            <div className="flex items-center gap-4 mt-3">
              <div className="flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-maroon" />
                <span className="font-body text-xs text-text-secondary">{totalNotes} Notes</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-maroon" />
                <span className="font-body text-xs text-text-secondary">{selectedUnit.collaborators} Collaborators</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-maroon" />
                <span className="font-body text-xs text-text-secondary">Exam {selectedUnit.examDate}</span>
              </div>
            </div>
          </div>

          {/* Sub-units */}
          <div className="px-6 mt-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-base font-bold text-text-primary">Sections</h2>
              <button onClick={addSubUnit} className="flex items-center gap-1.5 text-maroon font-body text-xs font-semibold active:opacity-60">
                <Plus className="w-3.5 h-3.5" /> Add Section
              </button>
            </div>

            <div className="flex flex-col gap-3">
              {selectedUnit.subUnits.map((subUnit) => {
                const isExpanded = expandedSubUnit === subUnit.id;
                return (
                  <motion.div
                    key={subUnit.id}
                    layout
                    className="bg-white rounded-3xl shadow-sm shadow-black/5 overflow-hidden"
                  >
                    {/* Sub-unit header */}
                    <button
                      onClick={() => setExpandedSubUnit(isExpanded ? null : subUnit.id)}
                      className="w-full flex items-center gap-3 p-4"
                    >
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${isExpanded ? 'bg-maroon' : 'bg-maroon/10'}`}>
                        <BookOpen className={`w-4 h-4 ${isExpanded ? 'text-white' : 'text-maroon'}`} />
                      </div>
                      <div className="flex-1 text-left min-w-0">
                        <p className="font-body text-sm font-semibold text-text-primary truncate">{subUnit.title}</p>
                        <p className="font-body text-[11px] text-text-tertiary mt-0.5">
                          {subUnit.notes.length} note{subUnit.notes.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                      <motion.div animate={{ rotate: isExpanded ? 90 : 0 }} transition={{ duration: 0.2 }}>
                        <ChevronRight className="w-4 h-4 text-text-tertiary" />
                      </motion.div>
                    </button>

                    {/* Expanded notes */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.3, ease: 'easeInOut' }}
                          className="overflow-hidden"
                        >
                          <div className="px-4 pb-4">
                            {subUnit.notes.length > 0 ? (
                              <div className="flex flex-col gap-2">
                                {subUnit.notes.map((note) => (
                                  <div key={note.id} className="bg-bg-secondary rounded-2xl p-4">
                                    <div className="flex items-start justify-between mb-2">
                                      <div className="flex-1 min-w-0">
                                        <p className="font-body text-sm font-semibold text-text-primary truncate">{note.title}</p>
                                        <p className="font-body text-[11px] text-text-tertiary mt-0.5">
                                          By {note.author} • {note.date} • {note.pages} pg
                                        </p>
                                      </div>
                                      <button
                                        onClick={() => deleteNote(subUnit.id, note.id)}
                                        className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-red-50 transition-colors shrink-0 ml-2"
                                      >
                                        <Trash2 className="w-3.5 h-3.5 text-text-tertiary hover:text-red-500" />
                                      </button>
                                    </div>
                                    <p className="font-body text-xs text-text-secondary leading-relaxed line-clamp-3">{note.content}</p>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="bg-bg-secondary rounded-2xl p-5 text-center">
                                <FileText className="w-6 h-6 text-text-tertiary/40 mx-auto mb-2" />
                                <p className="font-body text-xs text-text-tertiary">No notes yet for this section</p>
                              </div>
                            )}

                            {/* Action buttons row */}
                            <div className="flex gap-2 mt-3">
                              {/* Add Notes button */}
                              <button
                                onClick={() => startAddNotes(subUnit.id)}
                                className="flex-1 h-10 rounded-2xl border-2 border-dashed border-blue-200 flex items-center justify-center gap-2 hover:border-blue-400 active:bg-blue-50 transition-all"
                              >
                                <Plus className="w-3.5 h-3.5 text-blue-600" />
                                <span className="font-body text-xs font-semibold text-blue-600">Add Notes</span>
                              </button>

                              {/* Smart Merge button - only if 2+ notes */}
                              {subUnit.notes.length >= 2 && (
                                <button
                                  onClick={() => startSmartMerge(subUnit.id)}
                                  className="flex-1 h-10 rounded-2xl border-2 border-dashed border-maroon/20 flex items-center justify-center gap-2 hover:border-maroon/40 active:bg-maroon/5 transition-all"
                                >
                                  <Sparkles className="w-3.5 h-3.5 text-maroon" />
                                  <span className="font-body text-xs font-semibold text-maroon">Smart Merge</span>
                                </button>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>

        <BottomNav active="home" onHome={onBack} onScan={onScan} onFriends={onFriends} onFiles={onFilesOpen} />

        {/* ===== SMART MERGE MODAL ===== */}
        <AnimatePresence>
          {showSmartMerge && (
            <>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowSmartMerge(false)} className="absolute inset-0 bg-black/40 z-40 backdrop-blur-sm" />
              <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 28, stiffness: 300 }} className="absolute bottom-0 left-0 right-0 z-50 bg-white rounded-t-[28px] shadow-2xl flex flex-col" style={{ maxHeight: '85%' }}>
                <div className="flex justify-center pt-3 pb-1 shrink-0"><div className="w-10 h-1 rounded-full bg-gray-300" /></div>
                <div className="flex items-center justify-between px-6 pt-2 pb-4 shrink-0">
                  <div>
                    <h2 className="font-display text-xl font-bold text-text-primary flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-maroon" /> Smart Merge
                    </h2>
                    <p className="font-body text-xs text-text-secondary mt-0.5">Combine existing notes into one unified document</p>
                  </div>
                  <button onClick={() => setShowSmartMerge(false)} className="w-9 h-9 rounded-full bg-bg-secondary flex items-center justify-center">
                    <X className="w-4 h-4 text-text-secondary" />
                  </button>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto hide-scrollbar px-6 pb-10">
                  {mergeComplete ? (
                    <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center justify-center py-8">
                      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 15 }} className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
                        <Check className="w-8 h-8 text-green-600" />
                      </motion.div>
                      <p className="font-body text-base font-semibold text-text-primary">Notes merged successfully</p>
                      <p className="font-body text-sm text-text-secondary mt-1">Your notes have been combined into one</p>
                    </motion.div>
                  ) : merging ? (
                    <div className="flex flex-col items-center justify-center py-12">
                      <div className="relative w-20 h-20 mb-5">
                        <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }} className="absolute inset-0 rounded-full border-4 border-bg-secondary border-t-maroon" />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Layers className="w-7 h-7 text-maroon" />
                        </div>
                      </div>
                      <p className="font-body text-sm font-semibold text-text-primary">Merging {mergeSelectedNotes.size} notes...</p>
                      <p className="font-body text-xs text-text-secondary mt-1">Analyzing content and combining key points</p>
                      <div className="flex gap-1 mt-4">
                        {[0,1,2].map(i => (
                          <motion.div key={i} animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.3 }} className="w-2 h-2 rounded-full bg-maroon" />
                        ))}
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Target section */}
                      {mergeTargetSubUnit && (
                        <div className="bg-maroon/5 rounded-2xl p-4 mb-5 flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-maroon/10 flex items-center justify-center shrink-0">
                            <Layers className="w-4 h-4 text-maroon" />
                          </div>
                          <div>
                            <p className="font-body text-[11px] font-semibold text-maroon uppercase tracking-wider">Merging in</p>
                            <p className="font-body text-sm font-medium text-text-primary">
                              {selectedUnit?.subUnits.find((su) => su.id === mergeTargetSubUnit)?.title || 'Selected section'}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Select notes to merge */}
                      <p className="font-body text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">Select notes to merge (minimum 2)</p>

                      {getTargetSubUnitNotes().length >= 2 ? (
                        <div className="flex flex-col gap-2 mb-5">
                          {getTargetSubUnitNotes().map(note => {
                            const isSelected = mergeSelectedNotes.has(note.id);
                            return (
                              <button
                                key={note.id}
                                onClick={() => toggleMergeNote(note.id)}
                                className={`w-full text-left rounded-2xl p-4 border-2 transition-all ${isSelected ? 'border-maroon bg-maroon/5' : 'border-gray-100 bg-white'}`}
                              >
                                <div className="flex items-start gap-3">
                                  <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5 transition-colors ${isSelected ? 'bg-maroon' : 'bg-gray-100'}`}>
                                    {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="font-body text-sm font-semibold text-text-primary truncate">{note.title}</p>
                                    <p className="font-body text-[11px] text-text-tertiary mt-0.5">By {note.author} • {note.pages} pg</p>
                                    <p className="font-body text-xs text-text-secondary mt-1.5 line-clamp-2 leading-relaxed">{note.content}</p>
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="bg-bg-secondary rounded-2xl p-6 text-center mb-5">
                          <Layers className="w-8 h-8 text-text-tertiary/40 mx-auto mb-2" />
                          <p className="font-body text-sm font-medium text-text-primary">Not enough notes to merge</p>
                          <p className="font-body text-xs text-text-secondary mt-1">Add at least 2 notes to this section first, then merge them here.</p>
                        </div>
                      )}

                      {/* Additional content */}
                      {getTargetSubUnitNotes().length >= 2 && (
                        <>
                          <div className="relative mb-4">
                            <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-px bg-gray-200" />
                            <p className="font-body text-xs text-text-tertiary bg-white px-3 mx-auto w-fit relative">add your own notes to the merge (optional)</p>
                          </div>

                          <textarea
                            value={mergeExtraContent}
                            onChange={(e) => setMergeExtraContent(e.target.value)}
                            rows={3}
                            placeholder="Add any additional notes you want included in the merge..."
                            className="w-full px-5 py-4 bg-input-bg rounded-2xl font-body text-sm text-text-primary placeholder:text-text-tertiary outline-none focus:ring-2 focus:ring-maroon/20 transition-all resize-none mb-5"
                          />

                          {/* Merge preview */}
                          {mergeSelectedNotes.size >= 2 && (
                            <div className="bg-bg-secondary rounded-2xl p-4 mb-5">
                              <p className="font-body text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">Merge Preview</p>
                              <div className="flex items-center gap-2 flex-wrap">
                                {getTargetSubUnitNotes().filter(n => mergeSelectedNotes.has(n.id)).map((note, i, arr) => (
                                  <div key={note.id} className="flex items-center gap-2">
                                    <span className="font-body text-xs font-medium text-maroon bg-maroon/10 px-2.5 py-1 rounded-full truncate max-w-[120px]">{note.title}</span>
                                    {i < arr.length - 1 && <Plus className="w-3 h-3 text-text-tertiary shrink-0" />}
                                  </div>
                                ))}
                                {mergeExtraContent.trim() && (
                                  <>
                                    <Plus className="w-3 h-3 text-text-tertiary shrink-0" />
                                    <span className="font-body text-xs font-medium text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full">Your additions</span>
                                  </>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 mt-3">
                                <ArrowRight className="w-3 h-3 text-text-tertiary" />
                                <span className="font-body text-xs text-text-secondary">Will create 1 merged note and remove originals</span>
                              </div>
                            </div>
                          )}

                          <button
                            onClick={executeSmartMerge}
                            disabled={mergeSelectedNotes.size < 2}
                            className={`w-full h-[52px] rounded-full font-body font-semibold text-sm flex items-center justify-center gap-2 transition-all ${mergeSelectedNotes.size >= 2 ? 'bg-maroon text-white shadow-lg shadow-maroon/20 active:scale-[0.97]' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
                          >
                            <Sparkles className="w-4 h-4" /> Merge {mergeSelectedNotes.size} Notes into One
                          </button>
                        </>
                      )}
                    </>
                  )}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* ===== ADD NOTES MODAL ===== */}
        <AnimatePresence>
          {showAddNotes && (
            <>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAddNotes(false)} className="absolute inset-0 bg-black/40 z-40 backdrop-blur-sm" />
              <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 28, stiffness: 300 }} className="absolute bottom-0 left-0 right-0 z-50 bg-white rounded-t-[28px] shadow-2xl flex flex-col" style={{ maxHeight: '85%' }}>
                <div className="flex justify-center pt-3 pb-1 shrink-0"><div className="w-10 h-1 rounded-full bg-gray-300" /></div>
                <div className="flex items-center justify-between px-6 pt-2 pb-4 shrink-0">
                  <div>
                    <h2 className="font-display text-xl font-bold text-text-primary flex items-center gap-2">
                      <Plus className="w-5 h-5 text-blue-600" /> Add Notes
                    </h2>
                    <p className="font-body text-xs text-text-secondary mt-0.5">
                      Add to: {selectedUnit?.subUnits.find(su => su.id === addNotesTargetSubUnit)?.title || 'section'}
                    </p>
                  </div>
                  <button onClick={() => setShowAddNotes(false)} className="w-9 h-9 rounded-full bg-bg-secondary flex items-center justify-center">
                    <X className="w-4 h-4 text-text-secondary" />
                  </button>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto hide-scrollbar px-6 pb-10">
                  {addNoteComplete ? (
                    <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center justify-center py-8">
                      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 15 }} className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
                        <Check className="w-8 h-8 text-green-600" />
                      </motion.div>
                      <p className="font-body text-base font-semibold text-text-primary">Notes added successfully</p>
                      <p className="font-body text-sm text-text-secondary mt-1">Your notes are now in this section</p>
                    </motion.div>
                  ) : addingNote ? (
                    <div className="flex flex-col items-center justify-center py-12">
                      <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }} className="w-14 h-14 rounded-full border-4 border-bg-secondary border-t-blue-600 mb-4" />
                      <p className="font-body text-sm font-semibold text-text-primary">Adding your notes...</p>
                    </div>
                  ) : (
                    <>
                      {/* Tab switcher */}
                      <div className="flex gap-2 mb-5 bg-bg-secondary rounded-2xl p-1">
                        {[
                          { key: 'write' as const, label: 'Write', icon: PenLine },
                          { key: 'upload' as const, label: 'Upload', icon: FileUp },
                          { key: 'import' as const, label: 'From Files', icon: FolderOpen },
                        ].map(tab => (
                          <button
                            key={tab.key}
                            onClick={() => { setAddNotesTab(tab.key); setAddNoteImportedFile(null); setAddNoteUploaded(false); }}
                            className={`flex-1 h-10 rounded-xl flex items-center justify-center gap-1.5 font-body text-xs font-semibold transition-all ${addNotesTab === tab.key ? 'bg-white text-text-primary shadow-sm' : 'text-text-tertiary'}`}
                          >
                            <tab.icon className="w-3.5 h-3.5" />
                            {tab.label}
                          </button>
                        ))}
                      </div>

                      {/* Write tab */}
                      {addNotesTab === 'write' && (
                        <>
                          <label className="font-body text-xs font-semibold text-text-secondary tracking-wide uppercase mb-2 block">Note Title</label>
                          <input
                            type="text"
                            value={addNoteTitle}
                            onChange={(e) => setAddNoteTitle(e.target.value)}
                            placeholder="e.g. Chapter 5 Key Terms"
                            className="w-full h-[48px] px-5 bg-input-bg rounded-2xl font-body text-sm text-text-primary placeholder:text-text-tertiary outline-none focus:ring-2 focus:ring-blue-100 transition-all mb-4"
                          />

                          <label className="font-body text-xs font-semibold text-text-secondary tracking-wide uppercase mb-2 block">Notes Content</label>
                          <textarea
                            value={addNoteContent}
                            onChange={(e) => setAddNoteContent(e.target.value)}
                            rows={6}
                            placeholder="Type or paste your notes here..."
                            className="w-full px-5 py-4 bg-input-bg rounded-2xl font-body text-sm text-text-primary placeholder:text-text-tertiary outline-none focus:ring-2 focus:ring-blue-100 transition-all resize-none mb-5"
                          />
                        </>
                      )}

                      {/* Upload tab */}
                      {addNotesTab === 'upload' && (
                        <>
                          <label className={`block w-full border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-colors mb-5 ${addNoteUploaded ? 'border-green-300 bg-green-50' : 'border-gray-200 hover:border-blue-300'}`}>
                            {addNoteUploaded ? (
                              <div>
                                <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
                                  <Check className="w-6 h-6 text-green-600" />
                                </div>
                                <p className="font-body text-sm font-semibold text-green-700">File uploaded</p>
                                <p className="font-body text-xs text-green-600 mt-1">Ready to add to this section</p>
                              </div>
                            ) : (
                              <div>
                                <Upload className="w-10 h-10 text-text-tertiary/40 mx-auto mb-3" />
                                <p className="font-body text-sm font-semibold text-text-primary">Tap to upload a file</p>
                                <p className="font-body text-[11px] text-text-tertiary mt-1">PDF, DOCX, images, or text files</p>
                              </div>
                            )}
                            <input type="file" className="hidden" onChange={() => { setAddNoteUploaded(true); if (!addNoteTitle) setAddNoteTitle('Uploaded Notes'); }} />
                          </label>

                          {addNoteUploaded && (
                            <>
                              <label className="font-body text-xs font-semibold text-text-secondary tracking-wide uppercase mb-2 block">Note Title</label>
                              <input
                                type="text"
                                value={addNoteTitle}
                                onChange={(e) => setAddNoteTitle(e.target.value)}
                                placeholder="Name your notes"
                                className="w-full h-[48px] px-5 bg-input-bg rounded-2xl font-body text-sm text-text-primary placeholder:text-text-tertiary outline-none focus:ring-2 focus:ring-blue-100 transition-all mb-4"
                              />
                            </>
                          )}
                        </>
                      )}

                      {/* Import from Files tab */}
                      {addNotesTab === 'import' && (
                        <>
                          <div className="bg-blue-50 rounded-2xl p-4 mb-4 flex items-start gap-3">
                            <FolderOpen className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                            <div>
                              <p className="font-body text-sm font-medium text-blue-800">Import from your files</p>
                              <p className="font-body text-xs text-blue-600 mt-0.5">Select a file from {classData.title} to add as notes</p>
                            </div>
                          </div>

                          {classData.files.length > 0 ? (
                            <div className="flex flex-col gap-2 mb-5">
                              {classData.files.map(file => {
                                const isSelected = addNoteImportedFile === file.id;
                                return (
                                  <button
                                    key={file.id}
                                    onClick={() => {
                                      setAddNoteImportedFile(isSelected ? null : file.id);
                                      if (!isSelected) {
                                        setAddNoteTitle(file.previewTitle);
                                        setAddNoteContent(file.previewText);
                                      } else {
                                        setAddNoteTitle('');
                                        setAddNoteContent('');
                                      }
                                    }}
                                    className={`w-full text-left rounded-2xl p-4 border-2 transition-all ${isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-100 bg-white'}`}
                                  >
                                    <div className="flex items-center gap-3">
                                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isSelected ? 'bg-blue-500' : 'bg-bg-secondary'}`}>
                                        <FileText className={`w-4 h-4 ${isSelected ? 'text-white' : 'text-text-tertiary'}`} />
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <p className="font-body text-sm font-semibold text-text-primary truncate">{file.name}</p>
                                        <p className="font-body text-[11px] text-text-tertiary mt-0.5">{file.pages} pages • {file.size} • {file.date}</p>
                                      </div>
                                      {isSelected && (
                                        <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center shrink-0">
                                          <Check className="w-3.5 h-3.5 text-white" />
                                        </div>
                                      )}
                                    </div>
                                    {isSelected && (
                                      <div className="mt-3 pt-3 border-t border-blue-100">
                                        <p className="font-body text-xs text-blue-700 font-medium">{file.previewTitle}</p>
                                        <p className="font-body text-[11px] text-blue-600 mt-1 line-clamp-2 leading-relaxed">{file.previewText}</p>
                                      </div>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="bg-bg-secondary rounded-2xl p-6 text-center mb-5">
                              <FolderOpen className="w-8 h-8 text-text-tertiary/40 mx-auto mb-2" />
                              <p className="font-body text-sm font-medium text-text-primary">No files in this class</p>
                              <p className="font-body text-xs text-text-secondary mt-1">Upload files to your class first, then import them here.</p>
                            </div>
                          )}

                          {addNoteImportedFile && (
                            <>
                              <label className="font-body text-xs font-semibold text-text-secondary tracking-wide uppercase mb-2 block">Note Title (editable)</label>
                              <input
                                type="text"
                                value={addNoteTitle}
                                onChange={(e) => setAddNoteTitle(e.target.value)}
                                className="w-full h-[48px] px-5 bg-input-bg rounded-2xl font-body text-sm text-text-primary placeholder:text-text-tertiary outline-none focus:ring-2 focus:ring-blue-100 transition-all mb-4"
                              />
                            </>
                          )}
                        </>
                      )}

                      {/* Add button */}
                      <button
                        onClick={executeAddNote}
                        disabled={!addNoteTitle.trim() && !addNoteUploaded && addNoteImportedFile === null}
                        className={`w-full h-[52px] rounded-full font-body font-semibold text-sm flex items-center justify-center gap-2 transition-all ${(addNoteTitle.trim() || addNoteUploaded || addNoteImportedFile !== null) ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20 active:scale-[0.97]' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
                      >
                        <Plus className="w-4 h-4" /> Add Notes
                      </button>
                    </>
                  )}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // === MAIN VIEW ===
  return (
    <div className="h-full w-full bg-white relative flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto hide-scrollbar pb-28">
        {/* Header Image */}
        <div className="relative h-[260px] w-full shrink-0">
          <img src={classData.image} alt={classData.title} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/30 to-transparent" />
          <div className="absolute top-12 left-5 right-5 flex items-center justify-between">
            <button onClick={onBack} className="w-10 h-10 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center shadow-lg">
              <ArrowLeft className="w-5 h-5 text-text-primary" />
            </button>
            <div className="flex items-center gap-2">
              <motion.button
                whileTap={{ scale: 0.85 }}
                onClick={openEdit}
                className="w-10 h-10 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center shadow-lg"
              >
                <Edit3 className="w-4 h-4 text-text-primary" />
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.85 }}
                onClick={() => setIsCourseLiked(!isCourseLiked)}
                className={`w-10 h-10 rounded-full flex items-center justify-center shadow-lg transition-colors ${isCourseLiked ? 'bg-red-500' : 'bg-white/90 backdrop-blur-sm'}`}
              >
                <Heart className={`w-5 h-5 ${isCourseLiked ? 'text-white' : 'text-text-primary'}`} fill={isCourseLiked ? 'white' : 'none'} />
              </motion.button>
            </div>
          </div>
        </div>

        {/* Content Sheet */}
        <motion.div
          initial={{ y: 50 }}
          animate={{ y: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="relative -mt-8 bg-white rounded-t-[32px]"
        >
          <div className="px-6 pt-8">
            {/* Course Header */}
            <div className="flex items-start justify-between">
              <div>
                <h1 className="font-display text-2xl font-bold text-text-primary">{classData.title}</h1>
                <div className="mt-2">
                  <span className="font-body text-xs font-medium text-text-secondary bg-bg-secondary px-3 py-1.5 rounded-full">{classData.block}</span>
                </div>
              </div>
            </div>

            {/* Stats */}
            {!isNewClass && (
              <div className="flex items-center gap-5 mt-5">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-maroon" />
                  <span className="font-body text-xs text-text-secondary">{classData.classmates} Classmates Joined</span>
                </div>
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-maroon" />
                  <span className="font-body text-xs text-text-secondary">{classData.documents} Documents Uploaded</span>
                </div>
              </div>
            )}

            {/* Description or Empty State */}
            <div className="mt-6">
              {isNewClass ? (
                <div className="bg-bg-secondary rounded-3xl p-6 text-center">
                  <div className="w-14 h-14 rounded-full bg-maroon/10 flex items-center justify-center mx-auto mb-3">
                    <FileText className="w-6 h-6 text-maroon" />
                  </div>
                  <h3 className="font-display text-base font-bold text-text-primary">Fresh Start</h3>
                  <p className="font-body text-sm text-text-secondary mt-1 leading-relaxed">
                    This class is brand new. Start by inviting classmates and uploading your first notes.
                  </p>
                  <button onClick={() => setShowInviteModal(true)} className="mt-4 h-11 px-6 bg-maroon text-white font-body font-semibold text-sm rounded-full inline-flex items-center gap-2 active:scale-[0.97] transition-transform shadow-md shadow-maroon/20">
                    <Users className="w-4 h-4" /> Invite Classmates
                  </button>
                </div>
              ) : (
                <>
                  <p className="font-body text-sm text-text-secondary leading-relaxed">
                    Currently studying:{' '}
                    <span className="text-text-primary font-medium">{classData.description}</span>
                    . The next exam is coming up soon. Keep reviewing your notes and collaborating with classmates.
                  </p>
                  <button onClick={() => setShowInviteModal(true)} className="font-body text-sm font-bold text-maroon mt-3 underline underline-offset-2">
                    Invite Classmates +
                  </button>
                </>
              )}
            </div>

            {/* Units Section */}
            <div className="mt-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display text-lg font-bold text-text-primary">Units</h2>
                <div className="flex items-center gap-3">
                  <button onClick={() => setShowCreateUnit(true)} className="flex items-center gap-1 text-maroon font-body text-xs font-semibold active:opacity-60">
                    <Plus className="w-3.5 h-3.5" /> New Unit
                  </button>
                  {classData.units.length > 0 && (
                    <button onClick={onFilesOpen} className="font-body text-xs text-text-tertiary">See all files</button>
                  )}
                </div>
              </div>

              {classData.units.length > 0 ? (
                <div className="flex gap-4 overflow-x-auto hide-scrollbar -mx-6 px-6 pb-4">
                  {classData.units.map((unit, i) => {
                    const totalNotes = unit.subUnits.reduce((a, su) => a + su.notes.length, 0);
                    return (
                      <motion.div
                        key={unit.id}
                        initial={{ x: 30, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        transition={{ delay: 0.1 + i * 0.1 }}
                        onClick={() => openUnit(unit)}
                        className="w-52 shrink-0 bg-white rounded-3xl shadow-md shadow-black/8 overflow-hidden border border-gray-100 cursor-pointer active:scale-[0.97] transition-transform"
                      >
                        <div className="relative h-32 bg-bg-secondary p-4">
                          <div className="w-full h-full bg-white rounded-xl p-3 shadow-sm overflow-hidden">
                            <div className="space-y-1.5">
                              <div className="h-1.5 bg-gray-200 rounded-full w-3/4" />
                              <div className="h-1.5 bg-gray-100 rounded-full w-full" />
                              <div className="h-1.5 bg-gray-100 rounded-full w-5/6" />
                              <div className="h-1.5 bg-gray-200 rounded-full w-2/3" />
                              <div className="h-1.5 bg-gray-100 rounded-full w-full" />
                              <div className="h-1.5 bg-gray-100 rounded-full w-4/5" />
                            </div>
                          </div>
                          <motion.button
                            whileTap={{ scale: 0.8 }}
                            onClick={(e) => toggleUnitLike(unit.id, e)}
                            className={`absolute top-3 right-3 w-7 h-7 rounded-full flex items-center justify-center transition-colors ${likedUnits.has(unit.id) ? 'bg-red-500' : 'bg-white/80'}`}
                          >
                            <Heart className={`w-3.5 h-3.5 ${likedUnits.has(unit.id) ? 'text-white' : 'text-text-secondary'}`} fill={likedUnits.has(unit.id) ? 'white' : 'none'} />
                          </motion.button>
                        </div>
                        <div className="p-4">
                          <h3 className="font-body text-sm font-bold text-text-primary">{unit.title}</h3>
                          <p className="font-body text-[11px] text-text-tertiary mt-1">
                            {unit.subUnits.length} Sections • {totalNotes} Notes
                          </p>
                          <div className="flex items-center gap-1.5 mt-1.5">
                            <Clock className="w-3 h-3 text-text-tertiary" />
                            <p className="font-body text-[11px] text-text-tertiary">Exam {unit.examDate}</p>
                          </div>
                          <div className="flex items-center justify-between mt-3">
                            <span className="font-body text-[11px] font-medium text-text-secondary bg-bg-secondary px-2.5 py-1 rounded-full">{unit.daysLeft} Days</span>
                            <div className="w-8 h-8 rounded-full bg-maroon flex items-center justify-center shadow-md shadow-maroon/20">
                              <ArrowRight className="w-3.5 h-3.5 text-white" />
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              ) : (
                <div className="bg-bg-secondary rounded-3xl p-6 text-center">
                  <BookOpen className="w-8 h-8 text-text-tertiary/40 mx-auto mb-2" />
                  <p className="font-body text-sm text-text-secondary">No units yet.</p>
                  <button onClick={() => setShowCreateUnit(true)} className="mt-3 h-10 px-5 bg-maroon text-white font-body text-sm font-semibold rounded-full active:scale-95 transition-transform shadow-md shadow-maroon/20 inline-flex items-center gap-2">
                    <Plus className="w-4 h-4" /> Create First Unit
                  </button>
                </div>
              )}
            </div>

            {/* Study Progress */}
            {!isNewClass && (
              <div className="mt-6 pb-6">
                <h2 className="font-display text-lg font-bold text-text-primary mb-4">Study Progress</h2>
                <div className="bg-bg-secondary rounded-3xl p-5">
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-body text-sm font-medium text-text-primary">Overall Completion</span>
                    <span className="font-body text-sm font-bold text-maroon">
                      {classData.title === 'AP Human Geography' ? '67%' : classData.title === 'AP Biology' ? '45%' : '58%'}
                    </span>
                  </div>
                  <div className="h-2 bg-white rounded-full overflow-hidden">
                    <div className="h-full bg-maroon rounded-full" style={{ width: classData.title === 'AP Human Geography' ? '67%' : classData.title === 'AP Biology' ? '45%' : '58%' }} />
                  </div>
                  <div className="flex items-center justify-between mt-4 gap-3">
                    {[
                      { label: 'Notes', value: classData.title === 'AP Human Geography' ? '24' : classData.title === 'AP Biology' ? '18' : '12' },
                      { label: 'Quizzes', value: classData.title === 'AP Human Geography' ? '8' : classData.title === 'AP Biology' ? '5' : '3' },
                      { label: 'Hours', value: classData.title === 'AP Human Geography' ? '32' : classData.title === 'AP Biology' ? '22' : '15' },
                    ].map((stat) => (
                      <div key={stat.label} className="flex-1 bg-white rounded-2xl p-3 text-center">
                        <p className="font-display text-lg font-bold text-maroon">{stat.value}</p>
                        <p className="font-body text-[11px] text-text-tertiary mt-0.5">{stat.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>

      <BottomNav active="home" onHome={onBack} onScan={onScan} onFriends={onFriends} onFiles={onFilesOpen} />

      {/* ===== Create Unit Modal ===== */}
      <AnimatePresence>
        {showCreateUnit && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowCreateUnit(false)} className="absolute inset-0 bg-black/40 z-40 backdrop-blur-sm" />
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 28, stiffness: 300 }} className="absolute bottom-0 left-0 right-0 z-50 bg-white rounded-t-[28px] shadow-2xl" style={{ maxHeight: '70%' }}>
              <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1 rounded-full bg-gray-300" /></div>
              <div className="flex items-center justify-between px-6 pt-2 pb-4">
                <div>
                  <h2 className="font-display text-xl font-bold text-text-primary">New Unit</h2>
                  <p className="font-body text-xs text-text-secondary mt-0.5">Add a new unit to {classData.title}</p>
                </div>
                <button onClick={() => setShowCreateUnit(false)} className="w-9 h-9 rounded-full bg-bg-secondary flex items-center justify-center">
                  <X className="w-4 h-4 text-text-secondary" />
                </button>
              </div>
              <div className="px-6 pb-10">
                <label className="font-body text-xs font-semibold text-text-secondary tracking-wide uppercase mb-2 block">Unit Title</label>
                <input
                  type="text"
                  value={newUnitTitle}
                  onChange={(e) => setNewUnitTitle(e.target.value)}
                  placeholder="e.g. Unit 5"
                  autoFocus
                  className="w-full h-[52px] px-5 bg-input-bg rounded-2xl font-body text-sm text-text-primary placeholder:text-text-tertiary outline-none focus:ring-2 focus:ring-maroon/20 transition-all mb-4"
                />

                <label className="font-body text-xs font-semibold text-text-secondary tracking-wide uppercase mb-2 block">Exam Date (optional)</label>
                <input
                  type="date"
                  value={newUnitExamDate}
                  onChange={(e) => setNewUnitExamDate(e.target.value)}
                  className="w-full h-[52px] px-5 bg-input-bg rounded-2xl font-body text-sm text-text-primary outline-none focus:ring-2 focus:ring-maroon/20 transition-all mb-5"
                />

                <button
                  onClick={createUnit}
                  disabled={!newUnitTitle.trim()}
                  className={`w-full h-[52px] rounded-full font-body font-semibold text-sm flex items-center justify-center gap-2 transition-all ${newUnitTitle.trim() ? 'bg-maroon text-white shadow-lg shadow-maroon/20 active:scale-[0.97]' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
                >
                  <Plus className="w-4 h-4" /> Create Unit
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ===== Invite Classmates Modal ===== */}
      <AnimatePresence>
        {showInviteModal && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowInviteModal(false)} className="absolute inset-0 bg-black/40 z-40 backdrop-blur-sm" />
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 28, stiffness: 300 }} className="absolute bottom-0 left-0 right-0 z-50 bg-white rounded-t-[28px] shadow-2xl flex flex-col" style={{ maxHeight: '80%' }}>
              <div className="flex justify-center pt-3 pb-1 shrink-0"><div className="w-10 h-1 rounded-full bg-gray-300" /></div>
              <div className="flex items-center justify-between px-6 pt-2 pb-4 shrink-0">
                <div>
                  <h2 className="font-display text-xl font-bold text-text-primary">Invite Classmates</h2>
                  <p className="font-body text-xs text-text-secondary mt-0.5">Share this code so others can join</p>
                </div>
                <button onClick={() => setShowInviteModal(false)} className="w-9 h-9 rounded-full bg-bg-secondary flex items-center justify-center active:scale-95 transition-transform">
                  <X className="w-4 h-4 text-text-secondary" />
                </button>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto hide-scrollbar px-6 pb-10">
                {/* Class Code */}
                <div className="bg-bg-secondary rounded-3xl p-6 text-center mb-5">
                  <p className="font-body text-xs font-semibold text-text-secondary uppercase tracking-wider mb-4">Class Code</p>
                  <div className="bg-white rounded-2xl px-6 py-4 shadow-sm mx-auto inline-block">
                    <p className="font-mono text-2xl font-bold text-maroon tracking-[0.25em] select-all">{classCode}</p>
                  </div>
                  <motion.button onClick={copyCode} whileTap={{ scale: 0.95 }} className={`mt-5 h-10 px-5 rounded-full font-body text-sm font-semibold inline-flex items-center gap-2 transition-all ${codeCopied ? 'bg-green-100 text-green-700' : 'bg-maroon text-white shadow-md shadow-maroon/20'}`}>
                    {codeCopied ? <><Check className="w-4 h-4" /> Copied!</> : <><Copy className="w-4 h-4" /> Copy Code</>}
                  </motion.button>
                </div>

                {/* Invite Link */}
                <div className="bg-white border border-gray-100 rounded-2xl p-4 mb-5">
                  <p className="font-body text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">Invite Link</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-11 px-4 bg-bg-secondary rounded-xl flex items-center overflow-hidden">
                      <p className="font-body text-sm text-text-primary truncate">{inviteLink}</p>
                    </div>
                    <button onClick={copyLink} className={`h-11 w-11 rounded-xl flex items-center justify-center shrink-0 transition-all ${linkCopied ? 'bg-green-100' : 'bg-maroon shadow-md shadow-maroon/20'}`}>
                      {linkCopied ? <Check className="w-4 h-4 text-green-700" /> : <Copy className="w-4 h-4 text-white" />}
                    </button>
                  </div>
                </div>

                {/* Share Options */}
                <p className="font-body text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">Share Via</p>
                <div className="grid grid-cols-3 gap-3 mb-5">
                  <button className="flex flex-col items-center gap-2 p-4 bg-bg-secondary rounded-2xl active:scale-95 transition-transform">
                    <div className="w-11 h-11 rounded-full bg-blue-100 flex items-center justify-center"><Share2 className="w-5 h-5 text-blue-600" /></div>
                    <span className="font-body text-xs font-medium text-text-primary">Share</span>
                  </button>
                  <button className="flex flex-col items-center gap-2 p-4 bg-bg-secondary rounded-2xl active:scale-95 transition-transform">
                    <div className="w-11 h-11 rounded-full bg-green-100 flex items-center justify-center"><Mail className="w-5 h-5 text-green-600" /></div>
                    <span className="font-body text-xs font-medium text-text-primary">Email</span>
                  </button>
                  <button className="flex flex-col items-center gap-2 p-4 bg-bg-secondary rounded-2xl active:scale-95 transition-transform">
                    <div className="w-11 h-11 rounded-full bg-purple-100 flex items-center justify-center"><Copy className="w-5 h-5 text-purple-600" /></div>
                    <span className="font-body text-xs font-medium text-text-primary">Copy</span>
                  </button>
                </div>

                {/* Info */}
                <div className="bg-maroon/5 rounded-2xl p-4">
                  <p className="font-body text-xs text-text-secondary leading-relaxed">
                    Anyone with this code can join <span className="font-semibold text-text-primary">{classData.title}</span>. The code expires in 7 days. You can generate a new one anytime.
                  </p>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
