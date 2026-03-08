import React, { useMemo, useState } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BottomNav } from '../components/BottomNav';
import { colors, fonts } from '../theme';
import type { ClassData, FileData, UnitData } from '../types';

interface Props {
  classes: ClassData[];
  initialClassId: string;
  onBack: () => void;
  onHome: () => void;
  onScan?: () => void;
  onFriends?: () => void;
  onUpdateClass: (updatedClass: ClassData) => void;
}

type FileFilter = 'all' | 'camera' | 'library' | 'document';
type DetailTab = 'overview' | 'summary' | 'activity';

interface ClassNoteRef {
  key: string;
  unitId: number;
  subUnitId: string;
  title: string;
  author: string;
  content: string;
}

export function FilesScreen({ classes, initialClassId, onBack, onHome, onScan, onFriends, onUpdateClass }: Props) {
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

  const currentClass = classes[activeTab] || classes[0];
  const classAccent = currentClass?.color || colors.maroon;
  const files = currentClass?.files || [];

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

  const executeMerge = () => {
    if (!selectedFile || !currentClass || !mergeUnitId || !mergeSubUnitId || selectedMergeNotes.length < 2) return;

    const selectedNotes = classNotes.filter((note) => selectedMergeNotes.includes(note.key));
    const mergedText = selectedNotes.map((note) => `${note.title}: ${note.content}`).join(' ');

    updateCurrentClass((cls) => ({
      ...cls,
      units: cls.units.map((unit) =>
        unit.id === mergeUnitId
          ? {
            ...unit,
            subUnits: unit.subUnits.map((sub) =>
              sub.id === mergeSubUnitId
                ? {
                  ...sub,
                  notes: [
                    ...sub.notes,
                    {
                      id: Date.now(),
                      title: `Merged: ${selectedFile.name}`,
                      author: 'Citadel Merge',
                      date: new Date().toLocaleDateString('en-US'),
                      pages: 1,
                      content: `Merged with file context: ${mergedText}`.slice(0, 700),
                    },
                  ],
                }
                : sub
            ),
          }
          : unit
      ),
    }));

    setShowMergeModal(false);
    setStatus('Merged note created in selected section.');
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

    updateCurrentClass((cls) => ({
      ...cls,
      files: cls.files.filter((file) => file.id !== selectedFile.id),
      documents: Math.max(0, cls.documents - 1),
    }));

    setSelectedFile(null);
    setStatus('File deleted.');
    setShowMenuModal(false);
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

          {actionStatus.length > 0 && <Text style={styles.actionStatus}>{actionStatus}</Text>}

          <View style={styles.fileInfoCard}>
            <Image source={{ uri: selectedFile.thumbnail }} style={styles.fileThumb} />
            <View style={styles.fileMeta}>
              <Text style={styles.fileName}>{selectedFile.name}</Text>
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
                  style={[styles.modalSaveBtn, { backgroundColor: classAccent }, selectedMergeNotes.length < 2 && styles.modalSaveBtnDisabled]}
                  onPress={executeMerge}
                  disabled={selectedMergeNotes.length < 2}
                >
                  <Text style={styles.modalSaveBtnText}>Merge</Text>
                </TouchableOpacity>
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

        <BottomNav active="files" onHome={onHome} onScan={onScan} onFriends={onFriends} onFiles={() => { }} />
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

        <Text style={styles.sectionTitle}>{currentClass?.title || 'No Class'}</Text>
        <Text style={styles.sectionSub}>
          {currentClass?.block} • {filteredFiles.length} file{filteredFiles.length !== 1 ? 's' : ''}
        </Text>

        {filteredFiles.length > 0 ? (
          <View style={styles.fileList}>
            {filteredFiles.map((file) => (
              <TouchableOpacity key={file.id} style={styles.fileRow} onPress={() => { setSelectedFile(file); setDetailTab('overview'); }}>
                <Image source={{ uri: file.thumbnail }} style={styles.fileRowThumb} />
                <View style={styles.fileRowInfo}>
                  <Text style={styles.fileRowDate}>{file.date}</Text>
                  <Text style={styles.fileRowName} numberOfLines={1}>{file.name}</Text>
                  <Text style={styles.fileRowMeta}>{file.pages} pages • {file.size}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
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
        )}

        <View style={styles.storage}>
          <View style={styles.storageRow}>
            <Text style={styles.storageLabel}>Storage Used</Text>
            <Text style={styles.storageValue}>{files.reduce((a, f) => a + parseFloat(f.size), 0).toFixed(1)} MB / 1 GB</Text>
          </View>
          <View style={styles.storageBar}>
            <View style={[styles.storageFill, { width: `${Math.min(files.length * 5, 100)}%`, backgroundColor: classAccent }]} />
          </View>
        </View>
      </ScrollView>

      <BottomNav active="files" onHome={onHome} onScan={onScan} onFriends={onFriends} onFiles={() => { }} />
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

  sectionTitle: { fontSize: 22, fontFamily: fonts.bold, color: colors.textPrimary, marginTop: 20, letterSpacing: -0.3 },
  sectionSub: { fontSize: 12, color: colors.textSecondary, marginTop: 4, fontFamily: fonts.regular },
  fileList: { marginTop: 16, gap: 12 },
  fileRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', borderRadius: 22, padding: 14, gap: 12, borderWidth: 2, borderColor: '#F0E0D0' },
  fileRowThumb: { width: 60, height: 48, borderRadius: 14, backgroundColor: '#FFF5ED' },
  fileRowInfo: { flex: 1 },
  fileRowDate: { fontSize: 11, color: colors.textTertiary, fontFamily: fonts.regular },
  fileRowName: { fontSize: 14, fontFamily: fonts.bold, color: colors.textPrimary, marginTop: 2 },
  fileRowMeta: { fontSize: 11, color: colors.textSecondary, marginTop: 2, fontFamily: fonts.regular },

  empty: { backgroundColor: 'white', borderRadius: 28, padding: 32, alignItems: 'center', marginTop: 24, borderWidth: 2, borderColor: '#F0E0D0' },
  emptyTitle: { fontSize: 16, fontFamily: fonts.bold, color: colors.textPrimary, marginTop: 16 },
  emptyText: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginTop: 8, fontFamily: fonts.regular },
  uploadBtn: { marginTop: 16, height: 44, paddingHorizontal: 20, backgroundColor: colors.maroon, borderRadius: 18, justifyContent: 'center' },
  uploadBtnText: { fontSize: 14, fontFamily: fonts.bold, color: 'white' },

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
});
