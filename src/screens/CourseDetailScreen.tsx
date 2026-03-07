import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Image,
  StyleSheet,
  Modal,
  TextInput,
  Alert,
  Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { BottomNav } from '../components/BottomNav';
import { colors } from '../theme';
import type { ClassData, SubUnitNote, UnitData } from '../types';

interface Props {
  classData: ClassData;
  onBack: () => void;
  onFilesOpen: () => void;
  onScan?: () => void;
  onFriends?: () => void;
  onUpdateClass: (updatedClass: ClassData) => void;
}

function makeCustomCode(title: string) {
  const prefix =
    title
      .replace(/[^A-Za-z0-9 ]/g, '')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || '')
      .join('') || 'CL';
  const suffix = Math.random().toString(36).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(2, 6);
  return `${prefix}-${suffix}`;
}

function formatToday() {
  const now = new Date();
  return `${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}/${now.getFullYear()}`;
}

export function CourseDetailScreen({ classData, onBack, onFilesOpen, onScan, onFriends, onUpdateClass }: Props) {
  const [selectedUnit, setSelectedUnit] = useState<UnitData | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [copyStatus, setCopyStatus] = useState('');

  const [draftTitle, setDraftTitle] = useState(classData.title);
  const [draftBlock, setDraftBlock] = useState(classData.block);
  const [draftDescription, setDraftDescription] = useState(classData.description);
  const [draftCode, setDraftCode] = useState(classData.classCode);
  const [draftImage, setDraftImage] = useState(classData.image);

  const [showUnitEditModal, setShowUnitEditModal] = useState(false);
  const [editingUnitId, setEditingUnitId] = useState<number | null>(null);
  const [unitDraftTitle, setUnitDraftTitle] = useState('');
  const [unitDraftExamDate, setUnitDraftExamDate] = useState('');
  const [unitDraftDaysLeft, setUnitDraftDaysLeft] = useState('');

  const [showAddNoteModal, setShowAddNoteModal] = useState(false);
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [activeSubUnitId, setActiveSubUnitId] = useState<string | null>(null);
  const [noteSource, setNoteSource] = useState<'filesTab' | 'phone'>('filesTab');
  const [selectedClassFileId, setSelectedClassFileId] = useState<number | null>(classData.files[0]?.id || null);
  const [localUpload, setLocalUpload] = useState<{ name: string; content: string; pages: number } | null>(null);
  const [newNoteAuthor, setNewNoteAuthor] = useState('You');
  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [newNoteContent, setNewNoteContent] = useState('');
  const [selectedMergeNoteIds, setSelectedMergeNoteIds] = useState<number[]>([]);
  const [activeNote, setActiveNote] = useState<{ note: SubUnitNote; sectionTitle: string } | null>(null);
  const [noteActionStatus, setNoteActionStatus] = useState('');

  const [unitProgress, setUnitProgress] = useState<Record<string, boolean>>({});

  const isNewClass = classData.classmates === 0 && classData.documents === 0;

  const selectedUnitTotalSections = selectedUnit?.subUnits.length || 0;
  const selectedUnitCompletedSections = useMemo(() => {
    if (!selectedUnit) return 0;
    return selectedUnit.subUnits.filter((sub) => unitProgress[`${selectedUnit.id}-${sub.id}`]).length;
  }, [selectedUnit, unitProgress]);

  const selectedUnitProgress =
    selectedUnitTotalSections > 0 ? selectedUnitCompletedSections / selectedUnitTotalSections : 0;

  const canSaveAddedNote = useMemo(() => {
    if (!activeSubUnitId) return false;
    const hasTypedText = newNoteContent.trim().length > 0;
    if (noteSource === 'filesTab') {
      return hasTypedText || classData.files.some((file) => file.id === selectedClassFileId) || classData.files.length > 0;
    }
    return hasTypedText || !!localUpload;
  }, [activeSubUnitId, classData.files, localUpload, newNoteContent, noteSource, selectedClassFileId]);

  useEffect(() => {
    if (!selectedUnit) return;
    const refreshed = classData.units.find((unit) => unit.id === selectedUnit.id);
    if (refreshed) setSelectedUnit(refreshed);
  }, [classData, selectedUnit]);

  const updateClassUnits = (updater: (units: UnitData[]) => UnitData[]) => {
    onUpdateClass({ ...classData, units: updater(classData.units) });
  };

  const openEditModal = () => {
    setDraftTitle(classData.title);
    setDraftBlock(classData.block);
    setDraftDescription(classData.description);
    setDraftCode(classData.classCode);
    setDraftImage(classData.image);
    setShowEditModal(true);
  };

  const saveClassEdits = () => {
    onUpdateClass({
      ...classData,
      title: draftTitle.trim() || classData.title,
      block: draftBlock.trim() || classData.block,
      description: draftDescription.trim() || classData.description,
      classCode: draftCode.trim().toUpperCase() || classData.classCode,
      image: draftImage || classData.image,
    });
    setShowEditModal(false);
  };

  const copyClassCode = async () => {
    await Clipboard.setStringAsync(classData.classCode);
    setCopyStatus('Class code copied!');
    setTimeout(() => setCopyStatus(''), 1500);
  };

  const regenerateCode = () => {
    const newCode = makeCustomCode(classData.title);
    onUpdateClass({ ...classData, classCode: newCode });
    setCopyStatus('New class code generated.');
    setTimeout(() => setCopyStatus(''), 1500);
  };

  const addUnit = () => {
    const nextId = classData.units.length > 0 ? Math.max(...classData.units.map((unit) => unit.id)) + 1 : 1;
    const newUnit: UnitData = {
      id: nextId,
      title: `Unit ${nextId}`,
      pages: 0,
      collaborators: 0,
      examDate: 'TBD',
      daysLeft: 0,
      subUnits: [
        { id: `${nextId}.1`, title: 'Core Concepts', notes: [] },
        { id: `${nextId}.2`, title: 'Review Questions', notes: [] },
      ],
    };

    updateClassUnits((units) => [...units, newUnit]);
  };

  const openUnitEditor = (unit: UnitData) => {
    setEditingUnitId(unit.id);
    setUnitDraftTitle(unit.title);
    setUnitDraftExamDate(unit.examDate);
    setUnitDraftDaysLeft(unit.daysLeft > 0 ? String(unit.daysLeft) : '');
    setShowUnitEditModal(true);
  };

  const saveUnitEdits = () => {
    if (!editingUnitId) return;
    const parsedDays = Number.parseInt(unitDraftDaysLeft, 10);

    updateClassUnits((units) =>
      units.map((unit) =>
        unit.id === editingUnitId
          ? {
              ...unit,
              title: unitDraftTitle.trim() || unit.title,
              examDate: unitDraftExamDate.trim() || unit.examDate,
              daysLeft: Number.isFinite(parsedDays) && parsedDays > 0 ? parsedDays : 0,
            }
          : unit
      )
    );

    if (selectedUnit?.id === editingUnitId) {
      setSelectedUnit((prev) =>
        prev
          ? {
              ...prev,
              title: unitDraftTitle.trim() || prev.title,
              examDate: unitDraftExamDate.trim() || prev.examDate,
              daysLeft: Number.isFinite(parsedDays) && parsedDays > 0 ? parsedDays : 0,
            }
          : prev
      );
    }

    setShowUnitEditModal(false);
    setEditingUnitId(null);
  };

  const deleteUnit = (unitId: number) => {
    Alert.alert('Delete Unit', 'This will remove the unit and all notes inside it. Continue?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          updateClassUnits((units) => units.filter((unit) => unit.id !== unitId));
          if (selectedUnit?.id === unitId) {
            setSelectedUnit(null);
          }
        },
      },
    ]);
  };

  const pickClassBackground = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.9,
      aspect: [3, 2],
    });

    if (!result.canceled && result.assets[0]) {
      setDraftImage(result.assets[0].uri);
    }
  };

  const updateSelectedUnit = (updater: (unit: UnitData) => UnitData) => {
    if (!selectedUnit) return;
    const updatedUnits = classData.units.map((unit) => (unit.id === selectedUnit.id ? updater(unit) : unit));
    const refreshed = updatedUnits.find((unit) => unit.id === selectedUnit.id) || selectedUnit;
    onUpdateClass({ ...classData, units: updatedUnits });
    setSelectedUnit(refreshed);
  };

  const openAddNoteModal = (subUnitId: string) => {
    setActiveSubUnitId(subUnitId);
    setNoteSource('filesTab');
    setSelectedClassFileId(classData.files[0]?.id || null);
    setLocalUpload(null);
    setNewNoteAuthor('You');
    setNewNoteTitle('');
    setNewNoteContent('');
    setShowAddNoteModal(true);
  };

  const openScanTabFromAddNote = () => {
    setShowAddNoteModal(false);
    onScan?.();
  };

  const pickNoteFromPhone = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      multiple: false,
      type: ['application/pdf', 'image/*', 'text/plain'],
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const pages = asset.mimeType === 'application/pdf' ? 3 : 1;
      const trimmedName = asset.name.replace(/\.[^/.]+$/, '');

      setLocalUpload({
        name: asset.name,
        pages,
        content: `${trimmedName} was uploaded from phone storage. Key points are ready to annotate and merge with class notes.`,
      });
    }
  };

  const saveSectionNote = () => {
    if (!selectedUnit || !activeSubUnitId) return;

    const selectedFile = classData.files.find((file) => file.id === selectedClassFileId) || classData.files[0] || null;
    const sourceTitle =
      noteSource === 'filesTab'
        ? selectedFile
          ? `From File: ${selectedFile.name}`
          : 'Imported File Note'
        : localUpload
          ? `From Phone: ${localUpload.name}`
          : 'Uploaded Note';

    const sourceContent = noteSource === 'filesTab' ? selectedFile?.previewText : localUpload?.content;
    const sourcePages =
      noteSource === 'filesTab' ? Math.max(1, selectedFile?.pages || 1) : Math.max(1, localUpload?.pages || 1);

    const title = newNoteTitle.trim() || sourceTitle;
    const content = newNoteContent.trim() || sourceContent || 'New class note added.';

    updateSelectedUnit((unit) => ({
      ...unit,
      subUnits: unit.subUnits.map((sub) =>
        sub.id === activeSubUnitId
          ? {
              ...sub,
              notes: [
                ...sub.notes,
                {
                  id: Date.now(),
                  title,
                  author: newNoteAuthor.trim() || 'You',
                  date: formatToday(),
                  pages: sourcePages,
                  content,
                },
              ],
            }
          : sub
      ),
    }));

    setShowAddNoteModal(false);
  };

  const openMergeNotesModal = (subUnitId: string) => {
    setActiveSubUnitId(subUnitId);
    setSelectedMergeNoteIds([]);
    setShowMergeModal(true);
  };

  const toggleMergeNote = (id: number) => {
    setSelectedMergeNoteIds((prev) => (prev.includes(id) ? prev.filter((noteId) => noteId !== id) : [...prev, id]));
  };

  const mergeSelectedNotes = () => {
    if (!selectedUnit || !activeSubUnitId || selectedMergeNoteIds.length < 2) return;

    updateSelectedUnit((unit) => ({
      ...unit,
      subUnits: unit.subUnits.map((sub) => {
        if (sub.id !== activeSubUnitId) return sub;
        const chosen = sub.notes.filter((note) => selectedMergeNoteIds.includes(note.id));
        const mergedBody = chosen.map((note) => `- ${note.title}: ${note.content}`).join(' ');

        return {
          ...sub,
          notes: [
            ...sub.notes,
            {
              id: Date.now(),
              title: `Merged (${chosen.length} Notes)`,
              author: 'Citadel Merge',
              date: formatToday(),
              pages: 1,
              content: `Merged summary: ${mergedBody}`.slice(0, 600),
            },
          ],
        };
      }),
    }));

    setShowMergeModal(false);
  };

  const openNoteModal = (note: SubUnitNote, sectionTitle: string) => {
    setActiveNote({ note, sectionTitle });
    setNoteActionStatus('');
  };

  const shareActiveNote = async () => {
    if (!activeNote) return;
    await Share.share({
      title: activeNote.note.title,
      message: `${activeNote.note.title}\n${activeNote.note.author} • ${activeNote.note.date}\n\n${activeNote.note.content}`,
    });
  };

  const downloadActiveNote = () => {
    if (!activeNote) return;
    const wordCount = activeNote.note.content.trim().split(/\s+/).filter(Boolean).length;
    const sizeMb = Math.max(0.1, Number((activeNote.note.content.length / 1800).toFixed(1)));
    const readTime = Math.max(1, Math.ceil(wordCount / 180));

    const file = {
      id: Date.now(),
      name: `${activeNote.note.title}.txt`,
      date: formatToday(),
      thumbnail: classData.image,
      pages: Math.max(1, activeNote.note.pages),
      size: `${sizeMb}MB`,
      readTime: `${readTime} Min Read`,
      previewTitle: activeNote.note.title,
      previewText: activeNote.note.content,
      source: 'document' as const,
    };

    onUpdateClass({
      ...classData,
      files: [file, ...classData.files],
      documents: classData.documents + 1,
    });

    setNoteActionStatus('Saved to Files tab.');
    setTimeout(() => setNoteActionStatus(''), 1400);
  };

  if (selectedUnit) {
    const mergeCandidates = selectedUnit.subUnits.find((sub) => sub.id === activeSubUnitId)?.notes || [];

    return (
      <View style={styles.container}>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          <View style={styles.unitHeader}>
            <TouchableOpacity onPress={() => setSelectedUnit(null)} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
            </TouchableOpacity>
            <View style={styles.unitHeaderText}>
              <Text style={styles.unitTitle}>{selectedUnit.title}</Text>
              <Text style={styles.unitMeta}>{classData.title}</Text>
            </View>
          </View>

          <View style={styles.unitOverviewCard}>
            <Text style={styles.unitOverviewTitle}>Unit Progress</Text>
            <View style={styles.progressRow}>
              <Text style={styles.progressValue}>{Math.round(selectedUnitProgress * 100)}%</Text>
              <Text style={styles.progressSub}>
                {selectedUnitCompletedSections}/{selectedUnitTotalSections} sections complete
              </Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${Math.round(selectedUnitProgress * 100)}%` }]} />
            </View>

            <View style={styles.unitStatsRow}>
              <View style={styles.unitStatCard}>
                <Ionicons name="document-text" size={16} color={colors.maroon} />
                <Text style={styles.unitStatValue}>{selectedUnit.subUnits.reduce((a, s) => a + s.notes.length, 0)}</Text>
                <Text style={styles.unitStatLabel}>Notes</Text>
              </View>
              <View style={styles.unitStatCard}>
                <Ionicons name="people" size={16} color={colors.maroon} />
                <Text style={styles.unitStatValue}>{selectedUnit.collaborators}</Text>
                <Text style={styles.unitStatLabel}>Collaborators</Text>
              </View>
              <View style={styles.unitStatCard}>
                <Ionicons name="calendar" size={16} color={colors.maroon} />
                <Text style={styles.unitStatValue}>{selectedUnit.daysLeft}</Text>
                <Text style={styles.unitStatLabel}>Days Left</Text>
              </View>
            </View>
          </View>

          <View style={styles.sectionHeaderStack}>
            <Text style={styles.sectionTitle}>Sections</Text>
            <Text style={styles.sectionSub}>Track completion and upload notes from files or scans.</Text>
          </View>

          {selectedUnit.subUnits.map((subUnit) => {
            const key = `${selectedUnit.id}-${subUnit.id}`;
            const done = !!unitProgress[key];
            return (
              <View key={subUnit.id} style={styles.subUnitCard}>
                <View style={styles.subUnitHeader}>
                  <TouchableOpacity
                    style={[styles.checkbox, done && styles.checkboxDone]}
                    onPress={() => setUnitProgress((prev) => ({ ...prev, [key]: !done }))}
                  >
                    {done && <Ionicons name="checkmark" size={14} color="white" />}
                  </TouchableOpacity>
                  <View style={styles.subUnitInfo}>
                    <Text style={styles.subUnitTitle}>{subUnit.title}</Text>
                    <Text style={styles.subUnitCount}>
                      {subUnit.notes.length} note{subUnit.notes.length !== 1 ? 's' : ''}
                    </Text>
                  </View>
                </View>

                <View style={styles.subUnitActionsRow}>
                  <TouchableOpacity style={styles.subUnitAction} onPress={() => openAddNoteModal(subUnit.id)}>
                    <Ionicons name="add" size={14} color={colors.maroon} />
                    <Text style={styles.subUnitActionText}>Add Note</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.subUnitAction, subUnit.notes.length < 2 && styles.subUnitActionDisabled]}
                    onPress={() => openMergeNotesModal(subUnit.id)}
                    disabled={subUnit.notes.length < 2}
                  >
                    <Ionicons
                      name="git-merge"
                      size={14}
                      color={subUnit.notes.length < 2 ? colors.textTertiary : colors.maroon}
                    />
                    <Text style={[styles.subUnitActionText, subUnit.notes.length < 2 && styles.subUnitActionTextDisabled]}>
                      Merge
                    </Text>
                  </TouchableOpacity>
                </View>

                {subUnit.notes.length > 0 ? (
                  <View style={styles.notesList}>
                    {subUnit.notes.map((note) => (
                      <TouchableOpacity key={note.id} style={styles.noteCard} onPress={() => openNoteModal(note, subUnit.title)}>
                        <View style={styles.noteTopRow}>
                          <Text style={styles.noteTitle}>{note.title}</Text>
                          <Text style={styles.noteAuthorPill}>{note.author}</Text>
                        </View>
                        <Text style={styles.noteMeta}>{note.date}</Text>
                        <Text style={styles.noteContent} numberOfLines={3}>
                          {note.content}
                        </Text>
                        <Text style={styles.noteTapHint}>Tap to view actions</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : (
                  <View style={styles.emptySectionHint}>
                    <Ionicons name="sparkles" size={14} color={colors.textTertiary} />
                    <Text style={styles.emptySectionText}>No notes yet. Add your first upload for this section.</Text>
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>

        <BottomNav active="home" onHome={onBack} onScan={onScan} onFriends={onFriends} onFiles={onFilesOpen} />

        <Modal visible={showAddNoteModal} transparent animationType="fade" onRequestClose={() => setShowAddNoteModal(false)}>
          <View style={styles.modalBackdropCentered}>
            <View style={styles.noteModalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Add Note</Text>
                <TouchableOpacity onPress={() => setShowAddNoteModal(false)}>
                  <Ionicons name="close" size={22} color={colors.textPrimary} />
                </TouchableOpacity>
              </View>

              <View style={styles.noteMethodRow}>
                <TouchableOpacity style={[styles.noteMethodBtn, styles.noteMethodBtnActive]}>
                  <Text style={[styles.noteMethodText, styles.noteMethodTextActive]}>Upload from Files</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.noteMethodBtn} onPress={openScanTabFromAddNote}>
                  <Text style={styles.noteMethodText}>Scan Now</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.modalLabel}>Source</Text>
              <View style={styles.sourceRow}>
                <TouchableOpacity
                  style={[styles.sourceChip, noteSource === 'filesTab' && styles.sourceChipActive]}
                  onPress={() => setNoteSource('filesTab')}
                >
                  <Text style={[styles.sourceChipText, noteSource === 'filesTab' && styles.sourceChipTextActive]}>
                    Files Tab
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.sourceChip, noteSource === 'phone' && styles.sourceChipActive]}
                  onPress={() => setNoteSource('phone')}
                >
                  <Text style={[styles.sourceChipText, noteSource === 'phone' && styles.sourceChipTextActive]}>
                    Phone Storage
                  </Text>
                </TouchableOpacity>
              </View>

              {noteSource === 'filesTab' ? (
                classData.files.length > 0 ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filePickRow}>
                    {classData.files.map((file) => (
                      <TouchableOpacity
                        key={file.id}
                        style={[styles.filePickChip, selectedClassFileId === file.id && styles.filePickChipActive]}
                        onPress={() => setSelectedClassFileId(file.id)}
                      >
                        <Text
                          style={[styles.filePickChipText, selectedClassFileId === file.id && styles.filePickChipTextActive]}
                          numberOfLines={1}
                        >
                          {file.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                ) : (
                  <Text style={styles.sourceHint}>No files in this class yet. Add content manually or scan first.</Text>
                )
              ) : (
                <View>
                  <TouchableOpacity style={styles.phonePickBtn} onPress={pickNoteFromPhone}>
                    <Ionicons name="folder-open" size={14} color={colors.maroon} />
                    <Text style={styles.phonePickBtnText}>Choose File from Phone</Text>
                  </TouchableOpacity>
                  {localUpload && (
                    <Text style={styles.sourceHint}>
                      Selected: {localUpload.name} ({localUpload.pages} page{localUpload.pages > 1 ? 's' : ''})
                    </Text>
                  )}
                </View>
              )}

              <Text style={styles.modalLabel}>Contributor Name</Text>
              <TextInput style={styles.modalInput} value={newNoteAuthor} onChangeText={setNewNoteAuthor} placeholder="Name" />
              <Text style={styles.modalLabel}>Note Title</Text>
              <TextInput
                style={styles.modalInput}
                value={newNoteTitle}
                onChangeText={setNewNoteTitle}
                placeholder="Optional custom title"
              />
              <Text style={styles.modalLabel}>Add Extra Context (Optional)</Text>
              <TextInput
                style={styles.modalInputMultiline}
                value={newNoteContent}
                onChangeText={setNewNoteContent}
                placeholder="Add highlights or context for this section"
                multiline
              />

              <TouchableOpacity
                style={[styles.modalSaveBtn, !canSaveAddedNote && styles.modalSaveBtnDisabled]}
                onPress={saveSectionNote}
                disabled={!canSaveAddedNote}
              >
                <Text style={styles.modalSaveBtnText}>Add to Section</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        <Modal visible={showMergeModal} transparent animationType="fade" onRequestClose={() => setShowMergeModal(false)}>
          <View style={styles.modalBackdropCentered}>
            <View style={styles.noteModalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Merge Notes</Text>
                <TouchableOpacity onPress={() => setShowMergeModal(false)}>
                  <Ionicons name="close" size={22} color={colors.textPrimary} />
                </TouchableOpacity>
              </View>
              <Text style={styles.mergeHint}>Select 2 or more notes to combine into one merged summary.</Text>

              <ScrollView style={styles.mergeList}>
                {mergeCandidates.map((note) => {
                  const selected = selectedMergeNoteIds.includes(note.id);
                  return (
                    <TouchableOpacity key={note.id} style={styles.mergeItem} onPress={() => toggleMergeNote(note.id)}>
                      <View style={[styles.mergeCheckbox, selected && styles.mergeCheckboxActive]}>
                        {selected && <Ionicons name="checkmark" size={14} color="white" />}
                      </View>
                      <View style={styles.mergeItemInfo}>
                        <Text style={styles.mergeItemTitle}>{note.title}</Text>
                        <Text style={styles.mergeItemMeta}>
                          {note.author} • {note.date}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <TouchableOpacity
                style={[styles.modalSaveBtn, selectedMergeNoteIds.length < 2 && styles.modalSaveBtnDisabled]}
                onPress={mergeSelectedNotes}
                disabled={selectedMergeNoteIds.length < 2}
              >
                <Text style={styles.modalSaveBtnText}>Merge Selected</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        <Modal visible={!!activeNote} transparent animationType="fade" onRequestClose={() => setActiveNote(null)}>
          <View style={styles.modalBackdropCentered}>
            <View style={styles.noteModalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Note Details</Text>
                <TouchableOpacity onPress={() => setActiveNote(null)}>
                  <Ionicons name="close" size={22} color={colors.textPrimary} />
                </TouchableOpacity>
              </View>

              {activeNote && (
                <>
                  <Text style={styles.detailNoteTitle}>{activeNote.note.title}</Text>
                  <Text style={styles.detailNoteMeta}>
                    {activeNote.sectionTitle} • {activeNote.note.author} • {activeNote.note.date}
                  </Text>
                  <ScrollView style={styles.detailNoteScroll}>
                    <Text style={styles.detailNoteBody}>{activeNote.note.content}</Text>
                  </ScrollView>

                  {noteActionStatus.length > 0 && <Text style={styles.noteActionStatus}>{noteActionStatus}</Text>}

                  <View style={styles.noteActionsRow}>
                    <TouchableOpacity style={styles.noteActionBtn} onPress={downloadActiveNote}>
                      <Ionicons name="download-outline" size={14} color={colors.maroon} />
                      <Text style={styles.noteActionText}>Download</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.noteActionBtn} onPress={shareActiveNote}>
                      <Ionicons name="share-social-outline" size={14} color={colors.maroon} />
                      <Text style={styles.noteActionText}>Share</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.noteActionBtn}
                      onPress={() => {
                        setActiveNote(null);
                        onFilesOpen();
                      }}
                    >
                      <Ionicons name="folder-open-outline" size={14} color={colors.maroon} />
                      <Text style={styles.noteActionText}>Files</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Image source={{ uri: classData.image }} style={styles.heroImage} />
          <View style={styles.heroOverlay} />
          <View style={styles.heroBar}>
            <TouchableOpacity onPress={onBack} style={styles.heroBtn}>
              <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
            </TouchableOpacity>
            <View style={styles.heroBtns}>
              <TouchableOpacity style={styles.heroBtn} onPress={openEditModal}>
                <Ionicons name="pencil" size={18} color={colors.textPrimary} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.heroBtn} onPress={() => setShowInviteModal(true)}>
                <Ionicons name="people" size={18} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={styles.sheet}>
          <Text style={styles.courseTitle}>{classData.title}</Text>
          <View style={styles.badgeRow}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{classData.block}</Text>
            </View>
            <View style={styles.codePill}>
              <Ionicons name="key" size={13} color={colors.maroon} />
              <Text style={styles.codeText}>{classData.classCode}</Text>
            </View>
          </View>

          {!isNewClass && (
            <View style={styles.stats}>
              <View style={styles.stat}>
                <Ionicons name="people" size={16} color={colors.maroon} />
                <Text style={styles.statText}>{classData.classmates} Classmates</Text>
              </View>
              <View style={styles.stat}>
                <Ionicons name="document-text" size={16} color={colors.maroon} />
                <Text style={styles.statText}>{classData.documents} Documents</Text>
              </View>
            </View>
          )}

          {isNewClass ? (
            <View style={styles.emptyBox}>
              <Ionicons name="document-text" size={24} color={colors.maroon} />
              <Text style={styles.emptyTitle}>Fresh Start</Text>
              <Text style={styles.emptyText}>
                This class is brand new. Invite classmates with your class code and upload your first materials.
              </Text>
              <TouchableOpacity style={styles.inviteBtn} onPress={() => setShowInviteModal(true)}>
                <Ionicons name="people" size={16} color="white" />
                <Text style={styles.inviteBtnText}>Invite Classmates</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <Text style={styles.desc}>
              Currently studying: <Text style={styles.descBold}>{classData.description}</Text>. Keep your unit pages updated and
              collaborate with classmates.
            </Text>
          )}

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Units</Text>
            <TouchableOpacity style={styles.addUnitBtn} onPress={addUnit}>
              <Ionicons name="add" size={16} color="white" />
              <Text style={styles.addUnitBtnText}>New Unit</Text>
            </TouchableOpacity>
          </View>

          {classData.units.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.unitsRow}>
              {classData.units.map((unit) => {
                const totalNotes = unit.subUnits.reduce((a, s) => a + s.notes.length, 0);
                const sectionCount = unit.subUnits.length;
                return (
                  <View key={unit.id} style={styles.unitCard}>
                    <View style={styles.unitCardTop}>
                      <Text style={styles.unitCardTitle}>{unit.title}</Text>
                      <View style={styles.unitCardActions}>
                        <TouchableOpacity style={styles.unitCardActionBtn} onPress={() => openUnitEditor(unit)}>
                          <Ionicons name="pencil" size={14} color={colors.maroon} />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.unitCardActionBtn} onPress={() => deleteUnit(unit.id)}>
                          <Ionicons name="trash" size={14} color="#b91c1c" />
                        </TouchableOpacity>
                      </View>
                    </View>

                    <TouchableOpacity style={styles.unitCardBody} onPress={() => setSelectedUnit(unit)}>
                      <View style={styles.unitCardDaysPill}>
                        <Text style={styles.unitCardDaysText}>{unit.daysLeft > 0 ? `${unit.daysLeft}d left` : 'TBD'}</Text>
                      </View>
                      <Text style={styles.unitCardMeta}>
                        {sectionCount} sections • {totalNotes} notes
                      </Text>
                      <View style={styles.unitCardFooter}>
                        <Text style={styles.unitCardExam}>Exam: {unit.examDate}</Text>
                        <Ionicons name="arrow-forward-circle" size={22} color={colors.maroon} />
                      </View>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </ScrollView>
          ) : (
            <View style={styles.emptyUnits}>
              <Ionicons name="book" size={32} color={colors.textTertiary} />
              <Text style={styles.emptyUnitsText}>No units yet.</Text>
              <TouchableOpacity style={styles.addUnitInlineBtn} onPress={addUnit}>
                <Ionicons name="add" size={16} color="white" />
                <Text style={styles.addUnitBtnText}>Create First Unit</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>

      <BottomNav active="home" onHome={onBack} onScan={onScan} onFriends={onFriends} onFiles={onFilesOpen} />

      <Modal visible={showEditModal} transparent animationType="slide" onRequestClose={() => setShowEditModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Class</Text>
              <TouchableOpacity onPress={() => setShowEditModal(false)}>
                <Ionicons name="close" size={22} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalLabel}>Class Name</Text>
            <TextInput style={styles.modalInput} value={draftTitle} onChangeText={setDraftTitle} />
            <Text style={styles.modalLabel}>Block</Text>
            <TextInput style={styles.modalInput} value={draftBlock} onChangeText={setDraftBlock} />
            <Text style={styles.modalLabel}>Description</Text>
            <TextInput style={styles.modalInput} value={draftDescription} onChangeText={setDraftDescription} />
            <Text style={styles.modalLabel}>Class Code</Text>
            <TextInput
              style={styles.modalInput}
              value={draftCode}
              onChangeText={(text) => setDraftCode(text.toUpperCase())}
              autoCapitalize="characters"
            />
            <Text style={styles.modalLabel}>Background Image</Text>
            <TouchableOpacity style={styles.imagePickerBtn} onPress={pickClassBackground}>
              <Ionicons name="image" size={16} color={colors.maroon} />
              <Text style={styles.imagePickerBtnText}>Upload / Change Background</Text>
            </TouchableOpacity>
            <Image source={{ uri: draftImage }} style={styles.editImagePreview} />

            <TouchableOpacity style={styles.modalSaveBtn} onPress={saveClassEdits}>
              <Text style={styles.modalSaveBtnText}>Save Changes</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showUnitEditModal} transparent animationType="fade" onRequestClose={() => setShowUnitEditModal(false)}>
        <View style={styles.modalBackdropCentered}>
          <View style={styles.noteModalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Unit</Text>
              <TouchableOpacity onPress={() => setShowUnitEditModal(false)}>
                <Ionicons name="close" size={22} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalLabel}>Unit Title</Text>
            <TextInput style={styles.modalInput} value={unitDraftTitle} onChangeText={setUnitDraftTitle} />
            <Text style={styles.modalLabel}>Exam Date</Text>
            <TextInput style={styles.modalInput} value={unitDraftExamDate} onChangeText={setUnitDraftExamDate} placeholder="Ex: 05/10/2026" />
            <Text style={styles.modalLabel}>Days Left</Text>
            <TextInput
              style={styles.modalInput}
              value={unitDraftDaysLeft}
              onChangeText={setUnitDraftDaysLeft}
              placeholder="Ex: 28"
              keyboardType="number-pad"
            />

            <TouchableOpacity style={styles.modalSaveBtn} onPress={saveUnitEdits}>
              <Text style={styles.modalSaveBtnText}>Save Unit</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showInviteModal} transparent animationType="fade" onRequestClose={() => setShowInviteModal(false)}>
        <View style={styles.modalBackdropCentered}>
          <View style={styles.inviteCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Invite Classmates</Text>
              <TouchableOpacity onPress={() => setShowInviteModal(false)}>
                <Ionicons name="close" size={22} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.inviteLabel}>Share this custom class code:</Text>
            <View style={styles.codeCard}>
              <Ionicons name="key" size={18} color={colors.maroon} />
              <Text style={styles.codeCardText}>{classData.classCode}</Text>
            </View>

            {copyStatus.length > 0 && <Text style={styles.copyStatus}>{copyStatus}</Text>}

            <View style={styles.inviteActions}>
              <TouchableOpacity style={styles.inviteActionBtn} onPress={copyClassCode}>
                <Ionicons name="copy-outline" size={16} color={colors.maroon} />
                <Text style={styles.inviteActionText}>Copy Code</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.inviteActionBtn} onPress={regenerateCode}>
                <Ionicons name="refresh" size={16} color={colors.maroon} />
                <Text style={styles.inviteActionText}>Regenerate</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgPrimary },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 120 },

  hero: { height: 260, width: '100%' },
  heroImage: { ...StyleSheet.absoluteFillObject },
  heroOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.28)' },
  heroBar: {
    position: 'absolute',
    top: 48,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  heroBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroBtns: { flexDirection: 'row', gap: 8 },

  sheet: {
    backgroundColor: 'white',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    marginTop: -32,
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 24,
  },
  courseTitle: { fontSize: 24, fontWeight: '700', color: colors.textPrimary },
  badgeRow: { flexDirection: 'row', gap: 10, marginTop: 10, flexWrap: 'wrap' },
  badge: { backgroundColor: colors.bgSecondary, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7 },
  badgeText: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  codePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: `${colors.maroon}10`,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  codeText: { fontSize: 12, fontWeight: '700', color: colors.maroon },
  stats: { flexDirection: 'row', gap: 20, marginTop: 20 },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statText: { fontSize: 12, color: colors.textSecondary },
  desc: { fontSize: 14, color: colors.textSecondary, marginTop: 24, lineHeight: 22 },
  descBold: { fontWeight: '600', color: colors.textPrimary },

  emptyBox: { backgroundColor: colors.bgSecondary, borderRadius: 24, padding: 24, alignItems: 'center', marginTop: 24 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginTop: 12 },
  emptyText: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginTop: 8, lineHeight: 20 },
  inviteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    height: 44,
    paddingHorizontal: 24,
    backgroundColor: colors.maroon,
    borderRadius: 22,
  },
  inviteBtnText: { fontSize: 14, fontWeight: '600', color: 'white' },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 28,
    marginBottom: 14,
  },
  sectionHeaderStack: { marginHorizontal: 24, marginTop: 18, marginBottom: 10 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },
  sectionSub: { marginTop: 4, fontSize: 12, color: colors.textSecondary },
  addUnitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.maroon,
    borderRadius: 18,
    paddingHorizontal: 12,
    height: 36,
  },
  addUnitBtnText: { fontSize: 12, fontWeight: '700', color: 'white' },

  unitsRow: { gap: 12, paddingRight: 24 },
  unitCard: {
    width: 226,
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: '#efeaea',
  },
  unitCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  unitCardTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, flex: 1, marginRight: 8 },
  unitCardActions: { flexDirection: 'row', gap: 6 },
  unitCardActionBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#f6f3f3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  unitCardBody: { marginTop: 10 },
  unitCardDaysPill: {
    alignSelf: 'flex-start',
    backgroundColor: `${colors.maroon}12`,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  unitCardDaysText: { fontSize: 11, color: colors.maroon, fontWeight: '700' },
  unitCardMeta: { fontSize: 12, color: colors.textSecondary, marginTop: 8 },
  unitCardFooter: { marginTop: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  unitCardExam: { fontSize: 11, color: colors.textTertiary },

  emptyUnits: { alignItems: 'center', paddingVertical: 32, backgroundColor: colors.bgSecondary, borderRadius: 24 },
  emptyUnitsText: { fontSize: 14, color: colors.textSecondary, marginTop: 8 },
  addUnitInlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    height: 40,
    paddingHorizontal: 20,
    backgroundColor: colors.maroon,
    borderRadius: 20,
  },

  unitHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 56,
    paddingBottom: 16,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.bgSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  unitHeaderText: { flex: 1 },
  unitTitle: { fontSize: 24, fontWeight: '700', color: colors.textPrimary },
  unitMeta: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  unitOverviewCard: {
    marginHorizontal: 24,
    backgroundColor: 'white',
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: '#f1ecec',
  },
  unitOverviewTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 10 },
  progressValue: { fontSize: 26, fontWeight: '800', color: colors.maroon },
  progressSub: { fontSize: 12, color: colors.textSecondary },
  progressTrack: { height: 8, backgroundColor: '#ede9e9', borderRadius: 999, marginTop: 10, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.maroon, borderRadius: 999 },
  unitStatsRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  unitStatCard: { flex: 1, backgroundColor: '#faf8f8', borderRadius: 14, padding: 10, alignItems: 'center' },
  unitStatValue: { fontSize: 16, fontWeight: '800', color: colors.textPrimary, marginTop: 4 },
  unitStatLabel: { fontSize: 10, color: colors.textSecondary },

  subUnitCard: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 14,
    marginBottom: 12,
    marginHorizontal: 24,
    borderWidth: 1,
    borderColor: '#f1ecec',
  },
  subUnitHeader: { flexDirection: 'row', alignItems: 'center' },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#d1caca',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxDone: { backgroundColor: colors.maroon, borderColor: colors.maroon },
  subUnitInfo: { flex: 1, marginLeft: 10 },
  subUnitTitle: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  subUnitCount: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  subUnitActionsRow: { marginTop: 10, flexDirection: 'row', gap: 8 },
  subUnitAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    height: 34,
    borderRadius: 17,
    backgroundColor: `${colors.maroon}12`,
    paddingHorizontal: 10,
  },
  subUnitActionDisabled: { backgroundColor: '#efeded' },
  subUnitActionText: { fontSize: 12, color: colors.maroon, fontWeight: '700' },
  subUnitActionTextDisabled: { color: colors.textTertiary },

  notesList: { marginTop: 12, gap: 8 },
  noteCard: { backgroundColor: colors.bgSecondary, borderRadius: 14, padding: 12 },
  noteTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  noteTitle: { fontSize: 14, fontWeight: '600', color: colors.textPrimary, flex: 1, marginRight: 8 },
  noteAuthorPill: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.maroon,
    backgroundColor: `${colors.maroon}12`,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  noteMeta: { fontSize: 11, color: colors.textTertiary, marginTop: 4 },
  noteContent: { fontSize: 12, color: colors.textSecondary, marginTop: 8, lineHeight: 18 },
  noteTapHint: { marginTop: 8, fontSize: 10, color: colors.maroon, fontWeight: '700' },
  emptySectionHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    backgroundColor: '#faf8f8',
    borderRadius: 12,
    padding: 10,
  },
  emptySectionText: { fontSize: 12, color: colors.textSecondary, flex: 1 },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalBackdropCentered: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: { backgroundColor: 'white', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 28 },
  inviteCard: { width: '100%', backgroundColor: 'white', borderRadius: 24, padding: 20 },
  noteModalCard: { width: '100%', backgroundColor: 'white', borderRadius: 24, padding: 20, maxHeight: '88%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: colors.textPrimary },
  modalLabel: { fontSize: 12, color: colors.textSecondary, fontWeight: '700', marginTop: 8, marginBottom: 6 },
  modalInput: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ece8e8',
    backgroundColor: '#faf8f8',
    paddingHorizontal: 12,
    fontSize: 14,
    color: colors.textPrimary,
  },
  modalInputMultiline: {
    minHeight: 92,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ece8e8',
    backgroundColor: '#faf8f8',
    paddingHorizontal: 12,
    paddingTop: 10,
    fontSize: 14,
    color: colors.textPrimary,
    textAlignVertical: 'top',
  },
  modalSaveBtn: {
    marginTop: 16,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.maroon,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSaveBtnDisabled: { backgroundColor: '#c4b3b4' },
  modalSaveBtnText: { color: 'white', fontSize: 15, fontWeight: '700' },

  noteMethodRow: { flexDirection: 'row', gap: 8, marginTop: 6, marginBottom: 8 },
  noteMethodBtn: {
    flex: 1,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#f3f1f1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  noteMethodBtnActive: { backgroundColor: colors.maroon },
  noteMethodText: { fontSize: 12, color: colors.textSecondary, fontWeight: '700' },
  noteMethodTextActive: { color: 'white' },

  sourceRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  sourceChip: {
    flex: 1,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#f3f1f1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sourceChipActive: { backgroundColor: `${colors.maroon}15`, borderWidth: 1, borderColor: `${colors.maroon}40` },
  sourceChipText: { fontSize: 12, color: colors.textSecondary, fontWeight: '700' },
  sourceChipTextActive: { color: colors.maroon },
  filePickRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  filePickChip: {
    maxWidth: 180,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e1e1',
    backgroundColor: 'white',
  },
  filePickChipActive: { borderColor: colors.maroon, backgroundColor: `${colors.maroon}12` },
  filePickChipText: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
  filePickChipTextActive: { color: colors.maroon },
  phonePickBtn: {
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: `${colors.maroon}40`,
    backgroundColor: `${colors.maroon}10`,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  phonePickBtnText: { color: colors.maroon, fontSize: 12, fontWeight: '700' },
  sourceHint: { fontSize: 12, color: colors.textSecondary, marginTop: 8, lineHeight: 18 },

  mergeHint: { fontSize: 12, color: colors.textSecondary, lineHeight: 18, marginBottom: 10 },
  mergeList: { maxHeight: 220 },
  mergeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: '#f1eded',
  },
  mergeCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#d1caca',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mergeCheckboxActive: { borderColor: colors.maroon, backgroundColor: colors.maroon },
  mergeItemInfo: { flex: 1 },
  mergeItemTitle: { fontSize: 13, color: colors.textPrimary, fontWeight: '700' },
  mergeItemMeta: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  detailNoteTitle: { fontSize: 16, fontWeight: '800', color: colors.textPrimary, marginTop: 4 },
  detailNoteMeta: { fontSize: 12, color: colors.textSecondary, marginTop: 4 },
  detailNoteScroll: { marginTop: 10, maxHeight: 180, borderRadius: 12, backgroundColor: '#f8f6f6', padding: 12 },
  detailNoteBody: { fontSize: 13, color: colors.textPrimary, lineHeight: 20 },
  noteActionStatus: { marginTop: 10, fontSize: 12, color: '#047857', fontWeight: '700' },
  noteActionsRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  noteActionBtn: {
    flex: 1,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: `${colors.maroon}35`,
    backgroundColor: `${colors.maroon}10`,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    flexDirection: 'row',
  },
  noteActionText: { fontSize: 12, fontWeight: '700', color: colors.maroon },

  imagePickerBtn: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: `${colors.maroon}40`,
    backgroundColor: `${colors.maroon}10`,
  },
  imagePickerBtnText: { color: colors.maroon, fontSize: 13, fontWeight: '700' },
  editImagePreview: { marginTop: 8, width: '100%', height: 100, borderRadius: 12, backgroundColor: '#f0ecec' },

  inviteLabel: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
  codeCard: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f8f4f4',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  codeCardText: { fontSize: 20, letterSpacing: 1, fontWeight: '800', color: colors.maroon },
  copyStatus: { marginTop: 10, fontSize: 12, color: '#047857', fontWeight: '600' },
  inviteActions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  inviteActionBtn: {
    flex: 1,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#ece8e8',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  inviteActionText: { fontSize: 13, color: colors.maroon, fontWeight: '700' },
});
