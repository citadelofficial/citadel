import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
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
  Dimensions,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { BottomNav } from '../components/BottomNav';
import { InlineTutorialCard } from '../components/InlineTutorialCard';
import { FormattedText } from '../components/FormattedText';
import { colors, fonts } from '../theme';
import { mergeNotesWithAI, generateNoteSummary } from '../lib/gemini';
import type { ClassData, FileData, UnitData } from '../types';

interface Props {
  classes: ClassData[];
  initialClassId: string;
  initialFileId?: number | null;
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

/** Checks if a thumbnail URL is a remote (HTTP) URL that can be loaded on any device */
function isRemoteUrl(uri?: string): boolean {
  if (!uri) return false;
  return uri.startsWith('http://') || uri.startsWith('https://');
}

export function FilesScreen({
  classes,
  initialClassId,
  initialFileId,
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

  // AI-generated summary state
  const [aiSummaryBullets, setAiSummaryBullets] = useState<string[]>([]);
  const [aiSummaryLoading, setAiSummaryLoading] = useState(false);
  const [aiSummaryError, setAiSummaryError] = useState<string | null>(null);
  const summaryCache = useRef<Record<number, string[]>>({});

  // Memoize page images for stable FlatList data
  const allPages = useMemo(() => {
    if (!selectedFile) return [];
    if (selectedFile.pageImages && selectedFile.pageImages.length > 0) return selectedFile.pageImages;
    if (selectedFile.source !== 'document' && selectedFile.thumbnail) return [selectedFile.thumbnail];
    return [];
  }, [selectedFile?.id, selectedFile?.pageImages, selectedFile?.thumbnail, selectedFile?.source]);

  // Batch select
  const [batchMode, setBatchMode] = useState(false);
  const [selectedFileIds, setSelectedFileIds] = useState<number[]>([]);
  // Image viewer
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const [viewerPageIndex, setViewerPageIndex] = useState(0);
  // Pages gallery
  const [showPagesGallery, setShowPagesGallery] = useState(false);
  // View mode
  const [viewMode, setViewMode] = useState<ViewMode>('organized');
  // Track broken thumbnails (e.g. local file:// URIs from other users' devices)
  const [failedThumbnails, setFailedThumbnails] = useState<Set<number>>(new Set());

  const onThumbnailError = useCallback((fileId: number) => {
    setFailedThumbnails(prev => {
      const next = new Set(prev);
      next.add(fileId);
      return next;
    });
  }, []);

  // Auto-select a specific file when navigating from another screen (e.g. Smart Scan recent scans)
  useEffect(() => {
    if (initialFileId != null) {
      // Find the file across the current class's files
      const targetFile = files.find(f => f.id === initialFileId);
      if (targetFile) {
        setSelectedFile(targetFile);
        setDetailTab('overview');
      }
    }
  }, [initialFileId]);

  // Fetch AI summary when the summary tab is selected
  const summaryFetchingRef = useRef(false);
  const selectedFileId = selectedFile?.id ?? null;
  const selectedFileTitle = selectedFile?.previewTitle || selectedFile?.name || '';
  const selectedFileText = selectedFile?.previewText || '';

  useEffect(() => {
    if (detailTab !== 'summary' || selectedFileId === null) return;

    // Use cached result if available
    if (summaryCache.current[selectedFileId]) {
      setAiSummaryBullets(summaryCache.current[selectedFileId]);
      setAiSummaryError(null);
      setAiSummaryLoading(false);
      return;
    }

    // Prevent duplicate concurrent fetches
    if (summaryFetchingRef.current) return;
    summaryFetchingRef.current = true;

    let cancelled = false;
    setAiSummaryLoading(true);
    setAiSummaryError(null);

    generateNoteSummary(selectedFileTitle, selectedFileText)
      .then((result) => {
        if (cancelled) return;
        if (result.success) {
          summaryCache.current[selectedFileId] = result.bullets;
          setAiSummaryBullets(result.bullets);
        } else {
          setAiSummaryError(result.error || 'Could not generate summary.');
        }
      })
      .catch(() => {
        if (!cancelled) setAiSummaryError('Something went wrong. Please try again.');
      })
      .finally(() => {
        if (!cancelled) setAiSummaryLoading(false);
        summaryFetchingRef.current = false;
      });

    return () => { cancelled = true; summaryFetchingRef.current = false; };
  }, [detailTab, selectedFileId]);

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
    title: 'Find what you save',
    body: 'Files collects scans, uploads, and merged notes in one searchable workspace. Next, jump to Scan so you can add something new.',
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
              nextLabel="Go to Scan"
            />
          )}

          {actionStatus.length > 0 && <Text style={styles.actionStatus}>{actionStatus}</Text>}

          {/* Page Preview — scrollable if multi-page */}
          {allPages.length > 0 && !failedThumbnails.has(selectedFile.id) && (
            <View style={{ marginBottom: 16 }}>
              <FlatList
                data={allPages}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                keyExtractor={(_, i) => `page-${i}`}
                onMomentumScrollEnd={(e) => {
                  const screenW = Dimensions.get('window').width;
                  const previewW = screenW - 48;
                  const idx = Math.round(e.nativeEvent.contentOffset.x / previewW);
                  setViewerPageIndex(idx);
                }}
                renderItem={({ item: uri, index }) => {
                  const screenW = Dimensions.get('window').width;
                  const previewW = screenW - 48;
                  return (
                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={() => {
                        setViewerPageIndex(index);
                        setViewingImage(uri);
                      }}
                      style={{ width: previewW }}
                    >
                      <Image
                        source={{ uri }}
                        style={{ width: previewW, height: 200, borderRadius: 20, backgroundColor: '#FFF5ED' }}
                        resizeMode="cover"
                        onError={() => onThumbnailError(selectedFile.id)}
                      />
                      <View style={[styles.imageExpandBadge, { bottom: 8, right: 8, width: 28, height: 28 }]}>
                        <Ionicons name="expand" size={14} color="white" />
                      </View>
                    </TouchableOpacity>
                  );
                }}
              />
              {allPages.length > 1 && (
                <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 5, marginTop: 8 }}>
                  {allPages.map((_, i) => (
                    <View
                      key={i}
                      style={{
                        width: viewerPageIndex === i ? 18 : 6,
                        height: 6,
                        borderRadius: 3,
                        backgroundColor: viewerPageIndex === i ? classAccent : '#E0D0C0',
                      }}
                    />
                  ))}
                </View>
              )}
            </View>
          )}

          {/* File Meta Card */}
          <View style={styles.fileInfoCard}>
            <View style={styles.fileMeta}>
              <Text style={styles.fileName}>{selectedFile.previewTitle || selectedFile.name}</Text>
              <Text style={styles.fileClass}>{currentClass?.title} • {currentClass?.block}</Text>
              <Text style={styles.fileDate}>Added {selectedFile.date}</Text>
            </View>
          </View>

          <View style={styles.chips}>
            <TouchableOpacity
              style={styles.chip}
              onPress={() => {
                if (allPages.length > 0) setShowPagesGallery(true);
              }}
            >
              <Ionicons name="document-text" size={12} color={classAccent} />
              <Text style={styles.chipText}>{selectedFile.pages} {selectedFile.pages === 1 ? 'Page' : 'Pages'}</Text>
              <Ionicons name="chevron-forward" size={10} color={colors.textTertiary} />
            </TouchableOpacity>
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
              <View style={{ marginTop: 8 }}>
                <FormattedText accentColor={classAccent}>{selectedFile.previewText}</FormattedText>
              </View>

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
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <Ionicons name="sparkles" size={16} color={classAccent} />
                <Text style={styles.detailSectionTitle}>AI Summary</Text>
              </View>
              {aiSummaryLoading && (
                <View style={{ alignItems: 'center', paddingVertical: 24 }}>
                  <ActivityIndicator size="small" color={classAccent} />
                  <Text style={[styles.summaryText, { marginTop: 8, textAlign: 'center' }]}>Generating summary…</Text>
                </View>
              )}
              {aiSummaryError && !aiSummaryLoading && (
                <View style={{ paddingVertical: 12 }}>
                  <Text style={[styles.summaryText, { color: '#DC2626' }]}>{aiSummaryError}</Text>
                  <TouchableOpacity
                    style={{ marginTop: 8 }}
                    onPress={() => {
                      // Clear cache to force re-fetch
                      if (selectedFile) delete summaryCache.current[selectedFile.id];
                      setAiSummaryError(null);
                      setDetailTab('overview');
                      setTimeout(() => setDetailTab('summary'), 50);
                    }}
                  >
                    <Text style={[styles.quickActionText, { color: classAccent }]}>Retry</Text>
                  </TouchableOpacity>
                </View>
              )}
              {!aiSummaryLoading && !aiSummaryError && aiSummaryBullets.map((bullet, idx) => (
                <View key={idx} style={styles.summaryRow}>
                  <Ionicons name="checkmark-circle" size={14} color={classAccent} />
                  <Text style={styles.summaryText}>{bullet}</Text>
                </View>
              ))}
            </View>
          )}

          {detailTab === 'activity' && (
            <View style={styles.detailSection}>
              <Text style={styles.detailSectionTitle}>File Activity</Text>
              <View style={styles.activityItem}>
                <Ionicons
                  name={selectedFile.source === 'camera' ? 'camera-outline' : selectedFile.source === 'document' ? 'document-attach-outline' : 'images-outline'}
                  size={16}
                  color={colors.textSecondary}
                />
                <Text style={styles.activityText}>
                  {selectedFile.source === 'camera' ? 'Scanned with camera' : selectedFile.source === 'document' ? 'Imported from document' : selectedFile.source === 'library' ? 'Added from photo library' : 'File added'}
                </Text>
                <Text style={styles.activityTime}>{selectedFile.date}</Text>
              </View>
              <View style={styles.activityItem}>
                <Ionicons name="sparkles-outline" size={16} color={colors.textSecondary} />
                <Text style={styles.activityText}>AI text extraction completed</Text>
                <Text style={styles.activityTime}>{selectedFile.date}</Text>
              </View>
              <View style={styles.activityItem}>
                <Ionicons name="document-text-outline" size={16} color={colors.textSecondary} />
                <Text style={styles.activityText}>{selectedFile.pages} {selectedFile.pages === 1 ? 'page' : 'pages'} • {selectedFile.size}</Text>
                <Text style={styles.activityTime}>{selectedFile.readTime}</Text>
              </View>
              {currentClass && (
                <View style={styles.activityItem}>
                  <Ionicons name="folder-outline" size={16} color={colors.textSecondary} />
                  <Text style={styles.activityText}>Filed under {currentClass.title}</Text>
                  <Text style={styles.activityTime}>{selectedFile.date}</Text>
                </View>
              )}
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

        {/* Full Image Viewer with pinch-to-zoom */}
        <Modal visible={!!viewingImage} transparent animationType="fade" onRequestClose={() => setViewingImage(null)}>
          <View style={styles.imageViewerBackdrop}>
            <TouchableOpacity style={styles.imageViewerClose} onPress={() => setViewingImage(null)}>
              <Ionicons name="close" size={28} color="white" />
            </TouchableOpacity>
            {viewingImage && (() => {
              const currentIdx = allPages.indexOf(viewingImage);
              const hasPrev = currentIdx > 0;
              const hasNext = currentIdx < allPages.length - 1;
              const screenW = Dimensions.get('window').width;
              const screenH = Dimensions.get('window').height;

              return (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', width: '100%' }}>
                  <ScrollView
                    contentContainerStyle={{ alignItems: 'center', justifyContent: 'center', minHeight: screenH * 0.75 }}
                    maximumZoomScale={5}
                    minimumZoomScale={1}
                    bouncesZoom
                    showsVerticalScrollIndicator={false}
                    showsHorizontalScrollIndicator={false}
                  >
                    <Image
                      source={{ uri: viewingImage }}
                      style={{ width: screenW * 0.92, height: screenH * 0.72, borderRadius: 12 }}
                      resizeMode="contain"
                    />
                  </ScrollView>
                  {/* Page counter */}
                  {allPages.length > 1 && (
                    <View style={{
                      position: 'absolute', bottom: 80,
                      backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 14,
                      paddingHorizontal: 14, paddingVertical: 6,
                    }}>
                      <Text style={{ color: 'white', fontFamily: fonts.bold, fontSize: 13 }}>
                        {currentIdx + 1} / {allPages.length}
                      </Text>
                    </View>
                  )}
                  {/* Prev / Next arrows */}
                  {hasPrev && (
                    <TouchableOpacity
                      style={{ position: 'absolute', left: 12, top: '50%', marginTop: -22, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' }}
                      onPress={() => {
                        const prev = allPages[currentIdx - 1];
                        setViewerPageIndex(currentIdx - 1);
                        setViewingImage(prev);
                      }}
                    >
                      <Ionicons name="chevron-back" size={24} color="white" />
                    </TouchableOpacity>
                  )}
                  {hasNext && (
                    <TouchableOpacity
                      style={{ position: 'absolute', right: 12, top: '50%', marginTop: -22, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' }}
                      onPress={() => {
                        const next = allPages[currentIdx + 1];
                        setViewerPageIndex(currentIdx + 1);
                        setViewingImage(next);
                      }}
                    >
                      <Ionicons name="chevron-forward" size={24} color="white" />
                    </TouchableOpacity>
                  )}
                </View>
              );
            })()}
          </View>
        </Modal>

        {/* Pages Gallery Modal */}
        <Modal visible={showPagesGallery} transparent animationType="slide" onRequestClose={() => setShowPagesGallery(false)}>
          <View style={{ flex: 1, backgroundColor: '#FFF8F2' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 60, paddingBottom: 16 }}>
              <Text style={{ fontSize: 22, fontFamily: fonts.bold, color: colors.textPrimary }}>All Pages</Text>
              <TouchableOpacity
                style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: 'white', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#F0E0D0' }}
                onPress={() => setShowPagesGallery(false)}
              >
                <Ionicons name="close" size={22} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ flexDirection: 'row', flexWrap: 'wrap', padding: 16, gap: 12 }}>
              {allPages.map((uri, i) => {
                const tileW = (Dimensions.get('window').width - 56) / 2;
                return (
                  <TouchableOpacity
                    key={i}
                    activeOpacity={0.8}
                    onPress={() => {
                      setShowPagesGallery(false);
                      setViewerPageIndex(i);
                      setViewingImage(uri);
                    }}
                    style={{ width: tileW, borderRadius: 16, overflow: 'hidden', borderWidth: 2, borderColor: '#F0E0D0', backgroundColor: 'white' }}
                  >
                    <Image source={{ uri }} style={{ width: tileW - 4, height: tileW * 1.3, borderRadius: 14 }} resizeMode="cover" />
                    <View style={{ padding: 8, alignItems: 'center' }}>
                      <Text style={{ fontSize: 12, fontFamily: fonts.bold, color: colors.textPrimary }}>Page {i + 1}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
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
            nextLabel="Go to Scan"
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
                          if (file.source === 'camera' && file.thumbnail && !batchMode && !failedThumbnails.has(file.id)) {
                            setViewingImage(file.thumbnail);
                          }
                        }}
                        disabled={batchMode || file.source !== 'camera' || failedThumbnails.has(file.id)}
                      >
                        {failedThumbnails.has(file.id) ? (
                          <View style={[styles.fileRowThumb, { alignItems: 'center', justifyContent: 'center', backgroundColor: '#F3F4F6' }]}>
                            <Ionicons name="document-text" size={18} color={colors.textTertiary} />
                          </View>
                        ) : (
                          <Image
                            source={{ uri: file.thumbnail }}
                            style={styles.fileRowThumb}
                            onError={() => onThumbnailError(file.id)}
                          />
                        )}
                        {file.source === 'camera' && !batchMode && !failedThumbnails.has(file.id) && (
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
                      if (file.source === 'camera' && file.thumbnail && !batchMode && !failedThumbnails.has(file.id)) {
                        setViewingImage(file.thumbnail);
                      }
                    }}
                    disabled={batchMode || file.source !== 'camera' || failedThumbnails.has(file.id)}
                  >
                    {failedThumbnails.has(file.id) ? (
                      <View style={[styles.fileRowThumb, { alignItems: 'center', justifyContent: 'center', backgroundColor: '#F3F4F6' }]}>
                        <Ionicons name="document-text" size={18} color={colors.textTertiary} />
                      </View>
                    ) : (
                      <Image
                        source={{ uri: file.thumbnail }}
                        style={styles.fileRowThumb}
                        onError={() => onThumbnailError(file.id)}
                      />
                    )}
                    {file.source === 'camera' && !batchMode && !failedThumbnails.has(file.id) && (
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
              <ScrollView
                contentContainerStyle={{ alignItems: 'center', justifyContent: 'center', minHeight: Dimensions.get('window').height * 0.75 }}
                maximumZoomScale={5}
                minimumZoomScale={1}
                bouncesZoom
                showsVerticalScrollIndicator={false}
                showsHorizontalScrollIndicator={false}
              >
                <Image
                  source={{ uri: viewingImage }}
                  style={{ width: Dimensions.get('window').width * 0.92, height: Dimensions.get('window').height * 0.72, borderRadius: 12 }}
                  resizeMode="contain"
                />
              </ScrollView>
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
