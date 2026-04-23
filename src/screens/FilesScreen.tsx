import React, { useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Image,
  StyleSheet,
  TextInput,
  Modal,
  Share,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { BottomNav } from '../components/BottomNav';
import { InlineTutorialCard } from '../components/InlineTutorialCard';
import { FormattedText } from '../components/FormattedText';
import { colors, fonts } from '../theme';
import { mergeNotesWithAI } from '../lib/gemini';
import type { ClassData, FileData, UnitData } from '../types';

interface Props {
  classes: ClassData[];
  initialClassId: string;
  onBack: () => void;
  onHome: () => void;
  onScan?: () => void;
  onFriends?: () => void;
  onUpdateClass: (updatedClass: ClassData) => void;
  tutorialStep?: number;
  onTutorialNext?: () => void;
  onTutorialBack?: () => void;
  onTutorialSkip?: () => void;
}

const TUTORIAL_TOTAL_STEPS = 7;

type FileFilter = 'all' | 'camera' | 'library' | 'document';
type DetailTab = 'overview' | 'summary' | 'activity';
type ViewMode = 'flat' | 'organized';

interface ClassNoteRef {
  key: string;
  unitId: number;
  subUnitId: string;
  title: string;
  author: string;
  content: string;
}

export function FilesScreen({
  classes,
  initialClassId,
  onBack,
  onHome,
  onScan,
  onFriends,
  onUpdateClass,
  tutorialStep = 0,
  onTutorialNext = () => { },
  onTutorialBack = () => { },
  onTutorialSkip = () => { },
}: Props) {
  const initialIndex = Math.max(0, classes.findIndex((c) => c.id === initialClassId));
  const [activeTab, setActiveTab] = useState(initialIndex);
  const [selectedFile, setSelectedFile] = useState<FileData | null>(null);
  const [fileQuery, setFileQuery] = useState('');
  const [fileFilter, setFileFilter] = useState<FileFilter>('all');
  const [detailTab, setDetailTab] = useState<DetailTab>('overview');

  const [showMoveModal, setShowMoveModal] = useState(false);
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [showMenuModal, setShowMenuModal] = useState(false);
  const [renameDraft, setRenameDraft] = useState('');

  const [moveUnitId, setMoveUnitId] = useState<number | null>(null);
  const [moveSubUnitId, setMoveSubUnitId] = useState<string | null>(null);

  const [mergeUnitId, setMergeUnitId] = useState<number | null>(null);
  const [mergeSubUnitId, setMergeSubUnitId] = useState<string | null>(null);
  const [selectedMergeNotes, setSelectedMergeNotes] = useState<string[]>([]);

  const [actionStatus, setActionStatus] = useState('');
  const [isMerging, setIsMerging] = useState(false);
  const [mergedResult, setMergedResult] = useState<{ title: string; content: string } | null>(null);
  const [showMergedViewer, setShowMergedViewer] = useState(false);

  const currentClass = classes[activeTab] || classes[0];
  const classAccent = currentClass?.color || colors.maroon;
  const files = currentClass?.files || [];

  // Batch select
  const [batchMode, setBatchMode] = useState(false);
  const [selectedFileIds, setSelectedFileIds] = useState<number[]>([]);
  // Image viewer
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  // View mode
  const [viewMode, setViewMode] = useState<ViewMode>('organized');

  const toggleBatchSelect = (id: number) => {
    setSelectedFileIds((prev) =>
      prev.includes(id) ? prev.filter((fid) => fid !== id) : [...prev, id]
    );
  };

  const batchDeleteFiles = () => {
    if (selectedFileIds.length === 0) return;
    const count = selectedFileIds.length;
    Alert.alert(
      'Delete Files',
      `Delete ${count} selected file${count > 1 ? 's' : ''}? This will also remove any linked notes from your units.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            const filesToDelete = files.filter((f) => selectedFileIds.includes(f.id));
            const titlesToRemove = new Set(filesToDelete.map((f) => f.previewTitle));
            const namesToRemove = new Set(filesToDelete.map((f) => f.name.replace(/\.[^/.]+$/, '')));

            updateCurrentClass((cls) => ({
              ...cls,
              files: cls.files.filter((f) => !selectedFileIds.includes(f.id)),
              documents: Math.max(0, cls.documents - count),
              units: cls.units.map((unit) => ({
                ...unit,
                subUnits: unit.subUnits.map((sub) => ({
                  ...sub,
                  notes: sub.notes.filter((note) =>
                    !titlesToRemove.has(note.title) && !namesToRemove.has(note.title)
                  ),
                })),
              })),
            }));
            setSelectedFileIds([]);
            setBatchMode(false);
            setStatus(`${count} file${count > 1 ? 's' : ''} and linked notes deleted.`);
          },
        },
      ]
    );
  };

  // Group files by unit/section for organized view
  const organizedFiles = useMemo(() => {
    if (!currentClass) return [];
    const q = fileQuery.trim().toLowerCase();

    const groups: { unitTitle: string; sectionTitle: string; files: FileData[] }[] = [];
    const assignedFileIds = new Set<number>();

    // Walk each unit/section and find files whose previewTitle matches note titles
    for (const unit of currentClass.units) {
      for (const sub of unit.subUnits) {
        const sectionFiles = files.filter((file) => {
          if (assignedFileIds.has(file.id)) return false;
          // Match by note title or file name containing section info
          const isMatch = sub.notes.some(
            (note) =>
              file.previewTitle === note.title ||
              file.name.includes(note.title) ||
              note.title.includes(file.previewTitle)
          );
          return isMatch;
        });

        if (sectionFiles.length > 0) {
          const filtered = sectionFiles.filter((file) => {
            const matchesQuery = `${file.name} ${file.previewTitle}`.toLowerCase().includes(q);
            const matchesFilter = fileFilter === 'all' ? true : (file.source || 'library') === fileFilter;
            return matchesQuery && matchesFilter;
          });
          if (filtered.length > 0) {
            groups.push({ unitTitle: unit.title, sectionTitle: sub.title, files: filtered });
          }
          sectionFiles.forEach((f) => assignedFileIds.add(f.id));
        }
      }
    }

    // Unassigned files
    const unassigned = files.filter((f) => !assignedFileIds.has(f.id)).filter((file) => {
      const matchesQuery = `${file.name} ${file.previewTitle}`.toLowerCase().includes(q);
      const matchesFilter = fileFilter === 'all' ? true : (file.source || 'library') === fileFilter;
      return matchesQuery && matchesFilter;
    });
    if (unassigned.length > 0) {
      groups.push({ unitTitle: 'Unsorted', sectionTitle: 'General', files: unassigned });
    }

    return groups;
  }, [currentClass, files, fileQuery, fileFilter]);
  const tutorialGuide = tutorialStep === 4 ? {
    step: 4,
    title: 'Your files live here',
    body: 'This workspace keeps scans, uploads, and merged notes organized by class so you can review them quickly. Tap Scan below when you want to add something new.',
  } : null;

  const filteredFiles = useMemo(() => {
    const q = fileQuery.trim().toLowerCase();
    return files.filter((file) => {
      const matchesQuery = `${file.name} ${file.previewTitle}`.toLowerCase().includes(q);
      const matchesFilter = fileFilter === 'all' ? true : (file.source || 'library') === fileFilter;
      return matchesQuery && matchesFilter;
    });
  }, [fileFilter, fileQuery, files]);

  const classNotes = useMemo<ClassNoteRef[]>(() => {
    if (!currentClass) return [];
    return currentClass.units.flatMap((unit) =>
      unit.subUnits.flatMap((subUnit) =>
        subUnit.notes.map((note) => ({
          key: `${unit.id}-${subUnit.id}-${note.id}`,
          unitId: unit.id,
          subUnitId: subUnit.id,
          title: note.title,
          author: note.author,
          content: note.content,
        }))
      )
    );
  }, [currentClass]);

  const setStatus = (text: string) => {
    setActionStatus(text);
    setTimeout(() => setActionStatus(''), 1600);
  };

  const updateCurrentClass = (updater: (cls: ClassData) => ClassData) => {
    if (!currentClass) return;
    onUpdateClass(updater(currentClass));
  };

  const openMoveToUnit = () => {
    if (!currentClass || !selectedFile) return;
    const firstUnit = currentClass.units[0];
    setMoveUnitId(firstUnit?.id || null);
    setMoveSubUnitId(firstUnit?.subUnits[0]?.id || null);
    setShowMoveModal(true);
  };

  const executeMoveToUnit = () => {
    if (!selectedFile || !currentClass || !moveUnitId || !moveSubUnitId) return;

    updateCurrentClass((cls) => ({
      ...cls,
      units: cls.units.map((unit) =>
        unit.id === moveUnitId
          ? {
            ...unit,
            subUnits: unit.subUnits.map((sub) =>
              sub.id === moveSubUnitId
                ? {
                  ...sub,
                  notes: [
                    ...sub.notes,
                    {
                      id: Date.now(),
                      title: `From File: ${selectedFile.name}`,
                      author: 'You',
                      date: new Date().toLocaleDateString('en-US'),
                      pages: Math.max(1, selectedFile.pages),
                      content: selectedFile.previewText,
                    },
                  ],
                }
                : sub
            ),
          }
          : unit
      ),
    }));

    setShowMoveModal(false);
    setStatus('Moved into selected unit section.');
  };

  const openMergeModal = () => {
    if (!currentClass || !selectedFile) return;
    const firstUnit = currentClass.units[0];
    setMergeUnitId(firstUnit?.id || null);
    setMergeSubUnitId(firstUnit?.subUnits[0]?.id || null);
    setSelectedMergeNotes([]);
    setShowMergeModal(true);
  };

  const toggleMergeNote = (key: string) => {
    setSelectedMergeNotes((prev) => (prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]));
  };

  const executeMerge = async () => {
    if (!selectedFile || !currentClass || !mergeUnitId || !mergeSubUnitId || selectedMergeNotes.length < 2) return;

    const selectedNotes = classNotes.filter((note) => selectedMergeNotes.includes(note.key));
    setIsMerging(true);

    const result = await mergeNotesWithAI(
      selectedNotes.map((n) => ({ title: n.title, content: n.content, author: n.author }))
    );

    setIsMerging(false);

    if (!result.success) {
      setShowMergeModal(false);
      setStatus(result.content);
      return;
    }

    const mergedNote = {
      id: Date.now(),
      title: result.title,
      author: 'Citadel AI',
      date: new Date().toLocaleDateString('en-US'),
      pages: 1,
      content: result.content,
    };

    updateCurrentClass((cls) => ({
      ...cls,
      units: cls.units.map((unit) =>
        unit.id === mergeUnitId
          ? {
            ...unit,
            subUnits: unit.subUnits.map((sub) =>
              sub.id === mergeSubUnitId
                ? { ...sub, notes: [...sub.notes, mergedNote] }
                : sub
            ),
          }
          : unit
      ),
    }));

    setShowMergeModal(false);
    setMergedResult({ title: result.title, content: result.content });
    setShowMergedViewer(true);
  };

  const downloadMergedToDevice = async () => {
    if (!mergedResult) return;
    try {
      const fileName = mergedResult.title.replace(/[^a-zA-Z0-9 ]/g, '').replace(/\s+/g, '_');
      const fileUri = `${FileSystem.documentDirectory}${fileName}.txt`;
      await FileSystem.writeAsStringAsync(fileUri, `${mergedResult.title}\n\n${mergedResult.content}`);

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/plain',
          dialogTitle: `Save ${mergedResult.title}`,
        });
      } else {
        setStatus('Sharing not available on this device.');
      }
    } catch {
      setStatus('Could not save to device.');
    }
  };

  const shareFile = async () => {
    if (!selectedFile || !currentClass) return;
    await Share.share({
      message: `${selectedFile.name} (${currentClass.title})\n${selectedFile.previewText}`,
      title: selectedFile.name,
    });
  };

  const openFileMenu = () => {
    if (!selectedFile) return;
    setRenameDraft(selectedFile.name);
    setShowMenuModal(true);
  };

  const renameSelectedFile = () => {
    if (!selectedFile || !currentClass) return;
    const newName = renameDraft.trim();
    if (!newName) return;

    updateCurrentClass((cls) => ({
      ...cls,
      files: cls.files.map((file) => (file.id === selectedFile.id ? { ...file, name: newName } : file)),
    }));

    setSelectedFile({ ...selectedFile, name: newName });
    setStatus('File renamed.');
    setShowMenuModal(false);
  };

  const duplicateSelectedFile = () => {
    if (!selectedFile || !currentClass) return;

    const duplicate: FileData = {
      ...selectedFile,
      id: Date.now(),
      name: `${selectedFile.name.replace(/(\.[^.]+)?$/, '')} (Copy)${selectedFile.name.match(/\.[^.]+$/)?.[0] || ''}`,
      date: new Date().toLocaleDateString('en-US'),
    };

    updateCurrentClass((cls) => ({
      ...cls,
      files: [duplicate, ...cls.files],
      documents: cls.documents + 1,
    }));

    setStatus('Duplicate created.');
    setShowMenuModal(false);
  };

  const deleteSelectedFile = () => {
    if (!selectedFile || !currentClass) return;

    Alert.alert(
      'Delete File',
      'This will also remove any linked notes from your units. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            updateCurrentClass((cls) => ({
              ...cls,
              files: cls.files.filter((file) => file.id !== selectedFile.id),
              documents: Math.max(0, cls.documents - 1),
              units: cls.units.map((unit) => ({
                ...unit,
                subUnits: unit.subUnits.map((sub) => ({
                  ...sub,
                  notes: sub.notes.filter((note) =>
                    note.title !== selectedFile.previewTitle &&
                    note.title !== selectedFile.name.replace(/\.[^/.]+$/, '')
                  ),
                })),
              })),
            }));
            setSelectedFile(null);
            setStatus('File and linked notes deleted.');
            setShowMenuModal(false);
          },
        },
      ]
    );
  };

  if (selectedFile) {
    const summaryBullets = selectedFile.previewText
      .split('. ')
      .filter(Boolean)
      .slice(0, 4)
      .map((text) => (text.endsWith('.') ? text : `${text}.`));

    const mergeSubUnits = currentClass?.units.flatMap((unit) => unit.subUnits.map((sub) => ({ unit, sub }))) || [];

    return (
      <View style={styles.container}>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => setSelectedFile(null)} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
            </TouchableOpacity>
            <View style={styles.headerRight}>
              <TouchableOpacity style={styles.iconBtn} onPress={shareFile}>
                <Ionicons name="share-outline" size={20} color={colors.textPrimary} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconBtn} onPress={openFileMenu}>
                <Ionicons name="ellipsis-horizontal" size={20} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>
          </View>

          {tutorialGuide && (
            <InlineTutorialCard
              step={tutorialGuide.step}
              totalSteps={TUTORIAL_TOTAL_STEPS}
              title={tutorialGuide.title}
              body={tutorialGuide.body}
              onDismiss={onTutorialSkip}
              onPrevious={onTutorialBack}
              onNext={onTutorialNext}
            />
          )}

          {actionStatus.length > 0 && <Text style={styles.actionStatus}>{actionStatus}</Text>}

          <View style={styles.fileInfoCard}>
            <TouchableOpacity
              onPress={() => {
                if (selectedFile.source === 'camera' && selectedFile.thumbnail) {
                  setViewingImage(selectedFile.thumbnail);
                }
              }}
              disabled={selectedFile.source !== 'camera'}
            >
              <Image source={{ uri: selectedFile.thumbnail }} style={styles.fileThumb} />
              {selectedFile.source === 'camera' && (
                <View style={[styles.imageExpandBadge, { bottom: 4, right: 4, width: 22, height: 22 }]}>
                  <Ionicons name="expand" size={12} color="white" />
                </View>
              )}
            </TouchableOpacity>
            <View style={styles.fileMeta}>
              <Text style={styles.fileName}>{selectedFile.previewTitle || selectedFile.name}</Text>
              <Text style={styles.fileClass}>{currentClass?.title} • {currentClass?.block}</Text>
              <Text style={styles.fileDate}>Added {selectedFile.date}</Text>
            </View>
          </View>

          <View style={styles.chips}>
            <View style={styles.chip}><Ionicons name="document-text" size={12} color={classAccent} /><Text style={styles.chipText}>{selectedFile.pages} Pages</Text></View>
            <View style={styles.chip}><Ionicons name="hardware-chip-outline" size={12} color="#2563eb" /><Text style={styles.chipText}>{selectedFile.size}</Text></View>
            <View style={styles.chip}><Ionicons name="time-outline" size={12} color="#059669" /><Text style={styles.chipText}>{selectedFile.readTime}</Text></View>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.detailTabs}>
            {(['overview', 'summary', 'activity'] as DetailTab[]).map((tab) => (
              <TouchableOpacity
                key={tab}
                style={[styles.detailTab, detailTab === tab && [styles.detailTabActive, { backgroundColor: classAccent }]]}
                onPress={() => setDetailTab(tab)}
              >
                <Text style={[styles.detailTabText, detailTab === tab && styles.detailTabTextActive]}>
                  {tab[0].toUpperCase() + tab.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {detailTab === 'overview' && (
            <View style={styles.detailSection}>
              <Text style={styles.previewHeading}>{selectedFile.previewTitle}</Text>
              <Text style={styles.previewBody}>{selectedFile.previewText}</Text>

              <View style={styles.quickActionsRow}>
                <TouchableOpacity style={styles.quickActionBtn} onPress={openMoveToUnit}>
                  <Ionicons name="albums" size={16} color={classAccent} />
                  <Text style={[styles.quickActionText, { color: classAccent }]}>Move to Unit</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.quickActionBtn} onPress={openMergeModal}>
                  <Ionicons name="git-merge" size={16} color={classAccent} />
                  <Text style={[styles.quickActionText, { color: classAccent }]}>Merge</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {detailTab === 'summary' && (
            <View style={styles.detailSection}>
              <Text style={styles.detailSectionTitle}>Key Summary</Text>
              {summaryBullets.map((bullet, idx) => (
                <View key={idx} style={styles.summaryRow}>
                  <Ionicons name="sparkles" size={14} color={classAccent} />
                  <Text style={styles.summaryText}>{bullet}</Text>
                </View>
              ))}
              <Text style={styles.detailSectionTitle}>Suggested Next Step</Text>
              <Text style={styles.previewBody}>Create 3 flashcards from this file and attach them to your active unit before your next study session.</Text>
            </View>
          )}

          {detailTab === 'activity' && (
            <View style={styles.detailSection}>
              <Text style={styles.detailSectionTitle}>File Activity</Text>
              <View style={styles.activityItem}>
                <Ionicons name="download-outline" size={16} color={colors.textSecondary} />
                <Text style={styles.activityText}>Downloaded for offline reading.</Text>
                <Text style={styles.activityTime}>2h ago</Text>
              </View>
              <View style={styles.activityItem}>
                <Ionicons name="git-merge-outline" size={16} color={colors.textSecondary} />
                <Text style={styles.activityText}>Ready to merge with class notes.</Text>
                <Text style={styles.activityTime}>Today</Text>
              </View>
              <View style={styles.activityItem}>
                <Ionicons name="create-outline" size={16} color={colors.textSecondary} />
                <Text style={styles.activityText}>Notes annotated.</Text>
                <Text style={styles.activityTime}>2d ago</Text>
              </View>
            </View>
          )}

          <Modal visible={showMoveModal} transparent animationType="fade" onRequestClose={() => setShowMoveModal(false)}>
            <View style={styles.modalBackdrop}>
              <View style={styles.modalCard}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Move to Unit</Text>
                  <TouchableOpacity onPress={() => setShowMoveModal(false)}>
                    <Ionicons name="close" size={22} color={colors.textPrimary} />
                  </TouchableOpacity>
                </View>

                <Text style={styles.modalLabel}>Select Unit</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.modalRow}>
                  {(currentClass?.units || []).map((unit) => (
                    <TouchableOpacity
                      key={unit.id}
                      style={[styles.modalChip, moveUnitId === unit.id && [styles.modalChipActive, { backgroundColor: classAccent }]]}
                      onPress={() => {
                        setMoveUnitId(unit.id);
                        setMoveSubUnitId(unit.subUnits[0]?.id || null);
                      }}
                    >
                      <Text style={[styles.modalChipText, moveUnitId === unit.id && styles.modalChipTextActive]}>{unit.title}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <Text style={styles.modalLabel}>Select Section</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.modalRow}>
                  {(currentClass?.units.find((unit) => unit.id === moveUnitId)?.subUnits || []).map((sub) => (
                    <TouchableOpacity
                      key={sub.id}
                      style={[styles.modalChip, moveSubUnitId === sub.id && [styles.modalChipActive, { backgroundColor: classAccent }]]}
                      onPress={() => setMoveSubUnitId(sub.id)}
                    >
                      <Text style={[styles.modalChipText, moveSubUnitId === sub.id && styles.modalChipTextActive]}>{sub.title}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <TouchableOpacity style={[styles.modalSaveBtn, { backgroundColor: classAccent }]} onPress={executeMoveToUnit}>
                  <Text style={styles.modalSaveBtnText}>Move File Context</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

          <Modal visible={showMergeModal} transparent animationType="fade" onRequestClose={() => setShowMergeModal(false)}>
            <View style={styles.modalBackdrop}>
              <View style={styles.modalCardLarge}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Merge Notes</Text>
                  <TouchableOpacity onPress={() => setShowMergeModal(false)}>
                    <Ionicons name="close" size={22} color={colors.textPrimary} />
                  </TouchableOpacity>
                </View>

                <Text style={styles.modalLabel}>Destination Unit</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.modalRow}>
                  {(currentClass?.units || []).map((unit) => (
                    <TouchableOpacity
                      key={unit.id}
                      style={[styles.modalChip, mergeUnitId === unit.id && [styles.modalChipActive, { backgroundColor: classAccent }]]}
                      onPress={() => {
                        setMergeUnitId(unit.id);
                        setMergeSubUnitId(unit.subUnits[0]?.id || null);
                      }}
                    >
                      <Text style={[styles.modalChipText, mergeUnitId === unit.id && styles.modalChipTextActive]}>{unit.title}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <Text style={styles.modalLabel}>Destination Section</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.modalRow}>
                  {mergeSubUnits
                    .filter((item) => item.unit.id === mergeUnitId)
                    .map((item) => (
                      <TouchableOpacity
                        key={`${item.unit.id}-${item.sub.id}`}
                        style={[styles.modalChip, mergeSubUnitId === item.sub.id && [styles.modalChipActive, { backgroundColor: classAccent }]]}
                        onPress={() => setMergeSubUnitId(item.sub.id)}
                      >
                        <Text style={[styles.modalChipText, mergeSubUnitId === item.sub.id && styles.modalChipTextActive]}>
                          {item.sub.title}
                        </Text>
                      </TouchableOpacity>
                    ))}
                </ScrollView>

                <Text style={styles.modalLabel}>Select Notes to Merge (2+)</Text>
                <ScrollView style={styles.mergeList}>
                  {classNotes.map((note) => {
                    const selected = selectedMergeNotes.includes(note.key);
                    return (
                      <TouchableOpacity key={note.key} style={styles.mergeRow} onPress={() => toggleMergeNote(note.key)}>
                        <View style={[styles.mergeCheck, selected && [styles.mergeCheckActive, { borderColor: classAccent, backgroundColor: classAccent }]]}>
                          {selected && <Ionicons name="checkmark" size={14} color="white" />}
                        </View>
                        <View style={styles.mergeInfo}>
                          <Text style={styles.mergeTitle}>{note.title}</Text>
                          <Text style={styles.mergeMeta}>{note.author}</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                <TouchableOpacity
                  style={[styles.modalSaveBtn, { backgroundColor: classAccent }, (selectedMergeNotes.length < 2 || isMerging) && styles.modalSaveBtnDisabled]}
                  onPress={executeMerge}
                  disabled={selectedMergeNotes.length < 2 || isMerging}
                >
                  {isMerging ? (
                    <View style={styles.mergingRow}>
                      <ActivityIndicator size="small" color="white" />
                      <Text style={styles.modalSaveBtnText}>  AI Merging…</Text>
                    </View>
                  ) : (
                    <Text style={styles.modalSaveBtnText}>✨ Merge with AI</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

          {/* Merged Note Viewer */}
          <Modal visible={showMergedViewer} transparent animationType="slide" onRequestClose={() => setShowMergedViewer(false)}>
            <View style={styles.viewerBackdrop}>
              <View style={styles.viewerCard}>
                <View style={styles.viewerHeader}>
                  <View style={styles.viewerHeaderLeft}>
                    <View style={[styles.viewerBadge, { backgroundColor: classAccent }]}>
                      <Ionicons name="sparkles" size={14} color="white" />
                    </View>
                    <Text style={styles.viewerLabel}>AI Merged Note</Text>
                  </View>
                  <TouchableOpacity onPress={() => setShowMergedViewer(false)} style={styles.viewerCloseBtn}>
                    <Ionicons name="close" size={22} color={colors.textPrimary} />
                  </TouchableOpacity>
                </View>

                {mergedResult && (
                  <>
                    <Text style={styles.viewerTitle}>{mergedResult.title}</Text>
                    <View style={styles.viewerMetaRow}>
                      <Ionicons name="document-text" size={12} color={colors.textTertiary} />
                      <Text style={styles.viewerMeta}>
                        {mergedResult.content.trim().split(/\s+/).length} words • {currentClass?.title}
                      </Text>
                    </View>

                    <ScrollView style={styles.viewerScroll} showsVerticalScrollIndicator={false}>
                      <FormattedText accentColor={classAccent}>{mergedResult.content}</FormattedText>
                    </ScrollView>

                    <View style={styles.viewerActions}>
                      <TouchableOpacity
                        style={[styles.viewerActionBtn, { backgroundColor: `${classAccent}12`, borderColor: `${classAccent}30` }]}
                        onPress={downloadMergedToDevice}
                      >
                        <Ionicons name="download-outline" size={15} color={classAccent} />
                        <Text style={[styles.viewerActionText, { color: classAccent }]}>Download</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.viewerActionBtn, { backgroundColor: `${classAccent}12`, borderColor: `${classAccent}30` }]}
                        onPress={async () => {
                          if (!mergedResult) return;
                          await Share.share({ title: mergedResult.title, message: `${mergedResult.title}\n\n${mergedResult.content}` });
                        }}
                      >
                        <Ionicons name="share-social-outline" size={15} color={classAccent} />
                        <Text style={[styles.viewerActionText, { color: classAccent }]}>Share</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </View>
            </View>
          </Modal>

          <Modal visible={showMenuModal} transparent animationType="fade" onRequestClose={() => setShowMenuModal(false)}>
            <View style={styles.modalBackdrop}>
              <View style={styles.modalCard}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>File Actions</Text>
                  <TouchableOpacity onPress={() => setShowMenuModal(false)}>
                    <Ionicons name="close" size={22} color={colors.textPrimary} />
                  </TouchableOpacity>
                </View>

                <Text style={styles.modalLabel}>Rename</Text>
                <TextInput style={styles.modalInput} value={renameDraft} onChangeText={setRenameDraft} />

                <TouchableOpacity style={[styles.modalSaveBtn, { backgroundColor: classAccent }]} onPress={renameSelectedFile}>
                  <Text style={styles.modalSaveBtnText}>Save Name</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.menuActionBtn} onPress={duplicateSelectedFile}>
                  <Text style={styles.menuActionText}>Duplicate File</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.menuActionBtn, styles.menuActionDanger]} onPress={deleteSelectedFile}>
                  <Text style={styles.menuActionDangerText}>Delete File</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
        </ScrollView>

        {/* Full Image Viewer (detail view) */}
        <Modal visible={!!viewingImage} transparent animationType="fade" onRequestClose={() => setViewingImage(null)}>
          <View style={styles.imageViewerBackdrop}>
            <TouchableOpacity style={styles.imageViewerClose} onPress={() => setViewingImage(null)}>
              <Ionicons name="close" size={28} color="white" />
            </TouchableOpacity>
            {viewingImage && (
              <Image source={{ uri: viewingImage }} style={styles.imageViewerImage} resizeMode="contain" />
            )}
          </View>
        </Modal>

        <BottomNav active="files" onHome={onHome} onScan={onScan} onFriends={onFriends} onFiles={() => { }} highlightedTab={tutorialStep === 4 ? 'scan' : undefined} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={onBack} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
          </TouchableOpacity>
          <View style={styles.titleCenter}>
            <Text style={styles.pageTitle}>Files Workspace</Text>
            <Text style={styles.pageSub}>Organize, review, and merge notes</Text>
          </View>
          <TouchableOpacity style={styles.backBtn}>
            <Ionicons name="cloud-done-outline" size={22} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        {tutorialGuide && (
          <InlineTutorialCard
            step={tutorialGuide.step}
            totalSteps={TUTORIAL_TOTAL_STEPS}
            title={tutorialGuide.title}
            body={tutorialGuide.body}
            onDismiss={onTutorialSkip}
            onPrevious={onTutorialBack}
            onNext={onTutorialNext}
          />
        )}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
          {classes.map((cls, i) => (
            <TouchableOpacity key={cls.id} style={[styles.tab, activeTab === i && [styles.tabActive, { backgroundColor: cls.color || classAccent }]]} onPress={() => setActiveTab(i)}>
              <Text style={[styles.tabText, activeTab === i && styles.tabTextActive]} numberOfLines={1}>
                {cls.title.length > 14 ? `${cls.title.slice(0, 14)}...` : cls.title}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <Ionicons name="search" size={16} color={colors.textTertiary} />
            <TextInput
              style={styles.searchInput}
              value={fileQuery}
              onChangeText={setFileQuery}
              placeholder="Search files in this class"
              placeholderTextColor={colors.textTertiary}
            />
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {(['all', 'camera', 'library', 'document'] as FileFilter[]).map((filter) => (
            <TouchableOpacity
              key={filter}
              style={[styles.filterChip, fileFilter === filter && [styles.filterChipActive, { backgroundColor: classAccent }]]}
              onPress={() => setFileFilter(filter)}
            >
              <Text style={[styles.filterChipText, fileFilter === filter && styles.filterChipTextActive]}>
                {filter[0].toUpperCase() + filter.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Header row with title, view toggle, and batch select */}
        <View style={styles.listHeaderRow}>
          <View>
            <Text style={styles.sectionTitle}>{currentClass?.title || 'No Class'}</Text>
            <Text style={styles.sectionSub}>
              {currentClass?.block} • {filteredFiles.length} file{filteredFiles.length !== 1 ? 's' : ''}
            </Text>
          </View>
          <View style={styles.listHeaderActions}>
            <TouchableOpacity
              style={[styles.viewToggleBtn, { borderColor: `${classAccent}40` }]}
              onPress={() => setViewMode((v) => v === 'flat' ? 'organized' : 'flat')}
            >
              <Ionicons name={viewMode === 'organized' ? 'list' : 'albums'} size={16} color={classAccent} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.viewToggleBtn, batchMode && { backgroundColor: classAccent, borderColor: classAccent }]}
              onPress={() => { setBatchMode(!batchMode); setSelectedFileIds([]); }}
            >
              <Ionicons name="checkmark-circle-outline" size={16} color={batchMode ? 'white' : classAccent} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Batch delete bar */}
        {batchMode && selectedFileIds.length > 0 && (
          <View style={[styles.batchBar, { borderColor: `${classAccent}40` }]}>
            <Text style={styles.batchBarText}>{selectedFileIds.length} selected</Text>
            <TouchableOpacity
              style={[styles.batchBarBtn, { backgroundColor: '#dc2626' }]}
              onPress={batchDeleteFiles}
            >
              <Ionicons name="trash-outline" size={14} color="white" />
              <Text style={styles.batchBarBtnText}>Delete</Text>
            </TouchableOpacity>
          </View>
        )}

        {viewMode === 'organized' ? (
          /* Organized by unit/section */
          organizedFiles.length > 0 ? (
            <View style={styles.fileList}>
              {organizedFiles.map((group, gi) => (
                <View key={`${group.unitTitle}-${group.sectionTitle}-${gi}`}>
                  <View style={styles.groupHeader}>
                    <Ionicons name="folder-open" size={14} color={classAccent} />
                    <Text style={[styles.groupTitle, { color: classAccent }]}>{group.unitTitle}</Text>
                    <Text style={styles.groupSeparator}>›</Text>
                    <Text style={styles.groupSection}>{group.sectionTitle}</Text>
                    <Text style={styles.groupCount}>{group.files.length}</Text>
                  </View>
                  {group.files.map((file) => (
                    <TouchableOpacity
                      key={file.id}
                      style={[styles.fileRow, batchMode && selectedFileIds.includes(file.id) && { borderColor: classAccent, backgroundColor: `${classAccent}08` }]}
                      onPress={() => {
                        if (batchMode) {
                          toggleBatchSelect(file.id);
                        } else {
                          setSelectedFile(file);
                          setDetailTab('overview');
                        }
                      }}
                      onLongPress={() => {
                        if (!batchMode) {
                          setBatchMode(true);
                          setSelectedFileIds([file.id]);
                        }
                      }}
                    >
                      {batchMode && (
                        <View style={[styles.batchCheckbox, selectedFileIds.includes(file.id) && { backgroundColor: classAccent, borderColor: classAccent }]}>
                          {selectedFileIds.includes(file.id) && <Ionicons name="checkmark" size={12} color="white" />}
                        </View>
                      )}
                      <TouchableOpacity
                        onPress={() => {
                          if (file.source === 'camera' && file.thumbnail && !batchMode) {
                            setViewingImage(file.thumbnail);
                          }
                        }}
                        disabled={batchMode || file.source !== 'camera'}
                      >
                        <Image source={{ uri: file.thumbnail }} style={styles.fileRowThumb} />
                        {file.source === 'camera' && !batchMode && (
                          <View style={styles.imageExpandBadge}>
                            <Ionicons name="expand" size={10} color="white" />
                          </View>
                        )}
                      </TouchableOpacity>
                      <View style={styles.fileRowInfo}>
                        <Text style={styles.fileRowDate}>{file.date}</Text>
                        <Text style={styles.fileRowName} numberOfLines={1}>{file.previewTitle || file.name}</Text>
                        <Text style={styles.fileRowMeta}>{file.pages} pages • {file.size}</Text>
                      </View>
                      {!batchMode && <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />}
                    </TouchableOpacity>
                  ))}
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.empty}>
              <Ionicons name="folder-open" size={28} color={colors.textTertiary} />
              <Text style={styles.emptyTitle}>No Files Match</Text>
              <Text style={styles.emptyText}>Try changing filters or scan a new file for {currentClass?.title || 'this class'}.</Text>
              <TouchableOpacity style={[styles.uploadBtn, { backgroundColor: classAccent }]} onPress={onScan}>
                <Text style={styles.uploadBtnText}>Open Scan</Text>
              </TouchableOpacity>
            </View>
          )
        ) : (
          /* Flat list view */
          filteredFiles.length > 0 ? (
            <View style={styles.fileList}>
              {filteredFiles.map((file) => (
                <TouchableOpacity
                  key={file.id}
                  style={[styles.fileRow, batchMode && selectedFileIds.includes(file.id) && { borderColor: classAccent, backgroundColor: `${classAccent}08` }]}
                  onPress={() => {
                    if (batchMode) {
                      toggleBatchSelect(file.id);
                    } else {
                      setSelectedFile(file);
                      setDetailTab('overview');
                    }
                  }}
                  onLongPress={() => {
                    if (!batchMode) {
                      setBatchMode(true);
                      setSelectedFileIds([file.id]);
                    }
                  }}
                >
                  {batchMode && (
                    <View style={[styles.batchCheckbox, selectedFileIds.includes(file.id) && { backgroundColor: classAccent, borderColor: classAccent }]}>
                      {selectedFileIds.includes(file.id) && <Ionicons name="checkmark" size={12} color="white" />}
                    </View>
                  )}
                  <TouchableOpacity
                    onPress={() => {
                      if (file.source === 'camera' && file.thumbnail && !batchMode) {
                        setViewingImage(file.thumbnail);
                      }
                    }}
                    disabled={batchMode || file.source !== 'camera'}
                  >
                    <Image source={{ uri: file.thumbnail }} style={styles.fileRowThumb} />
                    {file.source === 'camera' && !batchMode && (
                      <View style={styles.imageExpandBadge}>
                        <Ionicons name="expand" size={10} color="white" />
                      </View>
                    )}
                  </TouchableOpacity>
                  <View style={styles.fileRowInfo}>
                    <Text style={styles.fileRowDate}>{file.date}</Text>
                    <Text style={styles.fileRowName} numberOfLines={1}>{file.previewTitle || file.name}</Text>
                    <Text style={styles.fileRowMeta}>{file.pages} pages • {file.size}</Text>
                  </View>
                  {!batchMode && <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />}
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <View style={styles.empty}>
              <Ionicons name="folder-open" size={28} color={colors.textTertiary} />
              <Text style={styles.emptyTitle}>No Files Match</Text>
              <Text style={styles.emptyText}>Try changing filters or scan a new file for {currentClass?.title || 'this class'}.</Text>
              <TouchableOpacity style={[styles.uploadBtn, { backgroundColor: classAccent }]} onPress={onScan}>
                <Text style={styles.uploadBtnText}>Open Scan</Text>
              </TouchableOpacity>
            </View>
          )
        )}

        {/* Full Image Viewer */}
        <Modal visible={!!viewingImage} transparent animationType="fade" onRequestClose={() => setViewingImage(null)}>
          <View style={styles.imageViewerBackdrop}>
            <TouchableOpacity style={styles.imageViewerClose} onPress={() => setViewingImage(null)}>
              <Ionicons name="close" size={28} color="white" />
            </TouchableOpacity>
            {viewingImage && (
              <Image source={{ uri: viewingImage }} style={styles.imageViewerImage} resizeMode="contain" />
            )}
          </View>
        </Modal>

      </ScrollView>

      <BottomNav active="files" onHome={onHome} onScan={onScan} onFriends={onFriends} onFiles={() => { }} highlightedTab={tutorialStep === 4 ? 'scan' : undefined} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF8F2' },
  scroll: { flex: 1 },
  scrollContent: { paddingTop: 56, paddingHorizontal: 24, paddingBottom: 120 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  backBtn: { width: 42, height: 42, borderRadius: 16, backgroundColor: 'white', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#F0E0D0' },
  titleCenter: { alignItems: 'center' },
  pageTitle: { fontSize: 20, fontFamily: fonts.bold, color: colors.textPrimary, letterSpacing: -0.3 },
  pageSub: { fontSize: 11, color: colors.textTertiary, marginTop: 2, fontFamily: fonts.regular },
  tabs: { flexDirection: 'row', gap: 8, marginTop: 16 },
  tab: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 16, backgroundColor: 'white', borderWidth: 2, borderColor: '#F0E0D0' },
  tabActive: { backgroundColor: colors.maroon, borderColor: colors.maroon },
  tabText: { fontSize: 14, fontFamily: fonts.medium, color: colors.textSecondary },
  tabTextActive: { color: 'white' },
  searchRow: { marginTop: 12 },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'white', borderRadius: 18, paddingHorizontal: 14, height: 50, borderWidth: 2, borderColor: '#F0E0D0' },
  searchInput: { flex: 1, fontSize: 13, color: colors.textPrimary, paddingVertical: 0, fontFamily: fonts.medium },
  filters: { flexDirection: 'row', gap: 8, marginTop: 10 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 14, backgroundColor: 'white', borderWidth: 2, borderColor: '#F0E0D0' },
  filterChipActive: { backgroundColor: colors.maroon, borderColor: colors.maroon },
  filterChipText: { fontSize: 12, color: colors.textSecondary, fontFamily: fonts.semiBold },
  filterChipTextActive: { color: 'white' },

  listHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 20 },
  listHeaderActions: { flexDirection: 'row', gap: 8 },
  viewToggleBtn: {
    width: 36, height: 36, borderRadius: 12, borderWidth: 2, borderColor: '#F0E0D0',
    backgroundColor: 'white', alignItems: 'center', justifyContent: 'center',
  },

  sectionTitle: { fontSize: 22, fontFamily: fonts.bold, color: colors.textPrimary, letterSpacing: -0.3 },
  sectionSub: { fontSize: 12, color: colors.textSecondary, marginTop: 4, fontFamily: fonts.regular },

  batchBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: 'white', borderRadius: 16, padding: 12, marginTop: 12,
    borderWidth: 2,
  },
  batchBarText: { fontSize: 13, fontFamily: fonts.semiBold, color: colors.textPrimary },
  batchBarBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12,
  },
  batchBarBtnText: { fontSize: 12, fontFamily: fonts.bold, color: 'white' },
  batchCheckbox: {
    width: 22, height: 22, borderRadius: 8, borderWidth: 2, borderColor: '#E0D0C0',
    alignItems: 'center', justifyContent: 'center',
  },

  groupHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 8, marginTop: 14, marginBottom: 4,
  },
  groupTitle: { fontSize: 13, fontFamily: fonts.bold },
  groupSeparator: { fontSize: 14, color: colors.textTertiary, fontFamily: fonts.regular },
  groupSection: { fontSize: 13, fontFamily: fonts.semiBold, color: colors.textSecondary },
  groupCount: {
    fontSize: 10, fontFamily: fonts.bold, color: 'white',
    backgroundColor: colors.textTertiary, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2,
    overflow: 'hidden', marginLeft: 'auto',
  },

  fileList: { marginTop: 8, gap: 10 },
  fileRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', borderRadius: 22, padding: 14, gap: 12, borderWidth: 2, borderColor: '#F0E0D0' },
  fileRowThumb: { width: 60, height: 48, borderRadius: 14, backgroundColor: '#FFF5ED' },
  fileRowInfo: { flex: 1 },
  fileRowDate: { fontSize: 11, color: colors.textTertiary, fontFamily: fonts.regular },
  fileRowName: { fontSize: 14, fontFamily: fonts.bold, color: colors.textPrimary, marginTop: 2 },
  fileRowMeta: { fontSize: 11, color: colors.textSecondary, marginTop: 2, fontFamily: fonts.regular },
  imageExpandBadge: {
    position: 'absolute', bottom: 2, right: 2,
    backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 6,
    width: 18, height: 18, alignItems: 'center', justifyContent: 'center',
  },

  empty: { backgroundColor: 'white', borderRadius: 28, padding: 32, alignItems: 'center', marginTop: 24, borderWidth: 2, borderColor: '#F0E0D0' },
  emptyTitle: { fontSize: 16, fontFamily: fonts.bold, color: colors.textPrimary, marginTop: 16 },
  emptyText: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginTop: 8, fontFamily: fonts.regular },
  uploadBtn: { marginTop: 16, height: 44, paddingHorizontal: 20, backgroundColor: colors.maroon, borderRadius: 18, justifyContent: 'center' },
  uploadBtnText: { fontSize: 14, fontFamily: fonts.bold, color: 'white' },

  imageViewerBackdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center', alignItems: 'center',
  },
  imageViewerClose: {
    position: 'absolute', top: 50, right: 20, zIndex: 10,
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  imageViewerImage: { width: '92%', height: '75%', borderRadius: 12 },

  storage: { backgroundColor: 'white', borderRadius: 24, padding: 20, marginTop: 24, borderWidth: 2, borderColor: '#F0E0D0' },
  storageRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  storageLabel: { fontSize: 14, fontFamily: fonts.medium, color: colors.textPrimary },
  storageValue: { fontSize: 12, color: colors.textTertiary, fontFamily: fonts.regular },
  storageBar: { height: 7, backgroundColor: '#F0E0D0', borderRadius: 4, overflow: 'hidden' },
  storageFill: { height: '100%', backgroundColor: colors.maroon, borderRadius: 4 },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  headerRight: { flexDirection: 'row', gap: 8 },
  iconBtn: { width: 42, height: 42, borderRadius: 16, backgroundColor: 'white', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#F0E0D0' },
  actionStatus: { marginBottom: 8, color: '#047857', fontFamily: fonts.bold, fontSize: 12 },
  fileInfoCard: { flexDirection: 'row', gap: 16, marginBottom: 16, backgroundColor: 'white', borderRadius: 24, padding: 16, borderWidth: 2, borderColor: '#F0E0D0' },
  fileThumb: { width: 72, height: 72, borderRadius: 16, backgroundColor: '#FFF5ED' },
  fileMeta: { flex: 1 },
  fileName: { fontSize: 18, fontFamily: fonts.bold, color: colors.textPrimary },
  fileClass: { fontSize: 12, color: colors.textSecondary, marginTop: 4, fontFamily: fonts.regular },
  fileDate: { fontSize: 11, color: colors.textTertiary, marginTop: 2, fontFamily: fonts.regular },
  chips: { flexDirection: 'row', gap: 8, marginBottom: 16, flexWrap: 'wrap' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'white', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 14, borderWidth: 2, borderColor: '#F0E0D0' },
  chipText: { fontSize: 11, fontFamily: fonts.semiBold, color: colors.textPrimary },
  detailTabs: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  detailTab: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 14, backgroundColor: 'white', borderWidth: 2, borderColor: '#F0E0D0' },
  detailTabActive: { backgroundColor: colors.maroon, borderColor: colors.maroon },
  detailTabText: { fontSize: 12, color: colors.textSecondary, fontFamily: fonts.semiBold },
  detailTabTextActive: { color: 'white' },
  detailSection: { backgroundColor: 'white', borderRadius: 24, padding: 18, borderWidth: 2, borderColor: '#F0E0D0' },
  detailSectionTitle: { fontSize: 16, fontFamily: fonts.bold, color: colors.textPrimary, marginBottom: 10 },
  previewHeading: { fontSize: 16, fontFamily: fonts.bold, color: colors.textPrimary },
  previewBody: { fontSize: 14, color: colors.textSecondary, lineHeight: 22, marginTop: 8, fontFamily: fonts.regular },
  quickActionsRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  quickActionBtn: {
    flex: 1,
    minHeight: 46,
    borderWidth: 2,
    borderColor: '#F0E0D0',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    flexDirection: 'row',
  },
  quickActionText: { fontSize: 12, color: colors.maroon, fontFamily: fonts.bold, flexShrink: 1, textAlign: 'center' },
  summaryRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 10 },
  summaryText: { flex: 1, fontSize: 13, color: colors.textSecondary, lineHeight: 19, fontFamily: fonts.regular },
  activityItem: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F0E0D0' },
  activityText: { flex: 1, fontSize: 13, color: colors.textPrimary, fontFamily: fonts.medium },
  activityTime: { fontSize: 11, color: colors.textTertiary, fontFamily: fonts.regular },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center', padding: 18 },
  modalCard: { width: '100%', backgroundColor: '#FFF8F2', borderRadius: 28, padding: 22 },
  modalCardLarge: { width: '100%', backgroundColor: '#FFF8F2', borderRadius: 28, padding: 22, maxHeight: '88%' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  modalTitle: { fontSize: 20, fontFamily: fonts.bold, color: colors.textPrimary, letterSpacing: -0.3 },
  modalLabel: { fontSize: 12, color: colors.textSecondary, fontFamily: fonts.bold, marginBottom: 6, marginTop: 8 },
  modalRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  modalChip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 14, backgroundColor: '#FFF5ED', borderWidth: 2, borderColor: '#F0E0D0' },
  modalChipActive: { backgroundColor: colors.maroon, borderColor: colors.maroon },
  modalChipText: { fontSize: 12, color: colors.textSecondary, fontFamily: fonts.semiBold },
  modalChipTextActive: { color: 'white' },
  modalInput: { height: 48, borderRadius: 18, borderWidth: 2, borderColor: '#F0E0D0', backgroundColor: 'white', paddingHorizontal: 14, fontSize: 14, color: colors.textPrimary, fontFamily: fonts.medium },
  modalSaveBtn: { marginTop: 14, height: 50, borderRadius: 20, backgroundColor: colors.maroon, alignItems: 'center', justifyContent: 'center' },
  modalSaveBtnDisabled: { backgroundColor: '#D8C8B8' },
  modalSaveBtnText: { fontSize: 14, color: 'white', fontFamily: fonts.bold },
  mergeList: { maxHeight: 190 },
  mergeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F0E0D0' },
  mergeCheck: { width: 22, height: 22, borderRadius: 10, borderWidth: 2, borderColor: '#E0D0C0', alignItems: 'center', justifyContent: 'center' },
  mergeCheckActive: { borderColor: colors.maroon, backgroundColor: colors.maroon },
  mergeInfo: { flex: 1 },
  mergeTitle: { fontSize: 13, color: colors.textPrimary, fontFamily: fonts.bold },
  mergeMeta: { fontSize: 11, color: colors.textSecondary, marginTop: 2, fontFamily: fonts.regular },
  menuActionBtn: { marginTop: 10, height: 44, borderRadius: 16, backgroundColor: '#FFF5ED', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#F0E0D0' },
  menuActionText: { fontSize: 13, color: colors.textPrimary, fontFamily: fonts.bold },
  menuActionDanger: { backgroundColor: '#fef2f2', borderColor: '#fecaca' },
  menuActionDangerText: { fontSize: 13, color: '#dc2626', fontFamily: fonts.bold },

  mergingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },

  // Merged Note Viewer
  viewerBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  viewerCard: { backgroundColor: '#FFF8F2', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 22, paddingBottom: 40, maxHeight: '92%' },
  viewerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  viewerHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  viewerBadge: { width: 28, height: 28, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  viewerLabel: { fontSize: 14, fontFamily: fonts.bold, color: colors.textSecondary },
  viewerCloseBtn: { width: 36, height: 36, borderRadius: 14, backgroundColor: 'white', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#F0E0D0' },
  viewerTitle: { fontSize: 22, fontFamily: fonts.bold, color: colors.textPrimary, letterSpacing: -0.3, marginBottom: 6 },
  viewerMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14 },
  viewerMeta: { fontSize: 12, fontFamily: fonts.regular, color: colors.textTertiary },
  viewerScroll: { maxHeight: 380, marginBottom: 16 },
  viewerBody: { fontSize: 15, fontFamily: fonts.regular, color: colors.textPrimary, lineHeight: 24 },
  viewerActions: { flexDirection: 'row', gap: 8 },
  viewerActionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 46, borderRadius: 16, borderWidth: 2 },
  viewerActionText: { fontSize: 12, fontFamily: fonts.bold },
});
