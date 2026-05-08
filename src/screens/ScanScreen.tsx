import React, { useMemo, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ScrollView,
  Image,
  Modal,
  Alert,
  Dimensions,
  PanResponder,
  GestureResponderEvent,
  PanResponderGestureState,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as DocumentPicker from 'expo-document-picker';
import { BottomNav } from '../components/BottomNav';
import { AnimatedPressable } from '../components/AnimatedPressable';
import { InlineTutorialCard } from '../components/InlineTutorialCard';
import { colors, fonts } from '../theme';
import type { ClassData, FileData } from '../types';
import { extractTextFromImage, extractTextFromMultipleImages } from '../lib/gemini';
import * as FileSystem from 'expo-file-system/legacy';

interface Props {
  onHome: () => void;
  onFiles: () => void;
  onFriends: () => void;
  classes: ClassData[];
  onSaveScan: (classId: string, file: FileData) => void;
  onAddClass?: (newClass: ClassData) => void;
  onOpenFile?: (classId: string, fileId: number) => void;
  tutorialStep?: number;
  onTutorialNext?: () => void;
  onTutorialBack?: () => void;
  onTutorialSkip?: () => void;
}

type ScanMode = 'notes' | 'document' | 'whiteboard';

type PendingScan = {
  uri: string;
  name: string;
  source: 'camera' | 'library' | 'document';
  pages: number;
  sizeBytes?: number;
  base64?: string;
  ocrTitle?: string;
  ocrText?: string;
};

type ScannedPage = {
  uri: string;
  base64: string;
  mimeType: string;
};

function formatDate(date = new Date()) {
  return `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}/${date.getFullYear()}`;
}

function formatSize(sizeBytes?: number) {
  if (!sizeBytes) return '1.2MB';
  const mb = sizeBytes / (1024 * 1024);
  return `${Math.max(0.1, mb).toFixed(1)}MB`;
}

const MODE_CONFIG: Record<ScanMode, { title: string; subtitle: string; badge: string }> = {
  notes: {
    title: 'Scan Notes',
    subtitle: 'Point your camera at handwritten or printed notes.',
    badge: 'Notes scan',
  },
  document: {
    title: 'Import Document',
    subtitle: 'Upload PDFs, images, or text files from your device.',
    badge: 'Document import',
  },
  whiteboard: {
    title: 'Capture Whiteboard',
    subtitle: 'Photograph a whiteboard — auto-enhances contrast & readability.',
    badge: 'Whiteboard capture',
  },
};

const MODE_PREFIX: Record<ScanMode, string> = {
  notes: 'Notes',
  document: 'Doc',
  whiteboard: 'Whiteboard',
};

const TUTORIAL_TOTAL_STEPS = 7;

export function ScanScreen({
  onHome,
  onFiles,
  onFriends,
  classes,
  onSaveScan,
  onAddClass,
  onOpenFile,
  tutorialStep = 0,
  onTutorialNext = () => { },
  onTutorialBack = () => { },
  onTutorialSkip = () => { },
}: Props) {
  const insets = useSafeAreaInsets();
  const [scanMode, setScanMode] = useState<ScanMode>('notes');
  const [saving, setSaving] = useState(false);
  const [pending, setPending] = useState<PendingScan | null>(null);
  const [scannedPages, setScannedPages] = useState<ScannedPage[]>([]);
  const [destinationClassId, setDestinationClassId] = useState(classes[0]?.id || '');
  const [showCreateClass, setShowCreateClass] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [newClassTeacher, setNewClassTeacher] = useState('');
  const [newClassBlock, setNewClassBlock] = useState('');
  const tutorialGuide = tutorialStep === 5 ? {
    step: 5,
    title: 'Capture the next handout',
    body: 'Scan paper notes, whiteboards, or worksheets and save them directly to a class. Next, head to People so sharing has somewhere to go.',
  } : null;

  const recentScans = useMemo(
    () =>
      classes
        .flatMap((cls) =>
          cls.files.map((file) => ({
            id: `${cls.id}-${file.id}`,
            classId: cls.id,
            fileId: file.id,
            title: file.previewTitle || file.name,
            date: file.date,
            pages: file.pages,
            course: cls.title,
            source: file.source || 'library',
          }))
        )
        .sort((a, b) => Number(b.id.split('-').pop()) - Number(a.id.split('-').pop()))
        .slice(0, 4),
    [classes]
  );

  const runOcrOnImage = async (base64: string, mimeType: string = 'image/jpeg') => {
    setOcrProcessing(true);
    try {
      const result = await extractTextFromImage(base64, mimeType);
      if (result.success) {
        setPending(prev => prev ? { ...prev, ocrTitle: result.title, ocrText: result.text } : null);
      } else {
        Alert.alert('OCR Notice', result.text || 'Could not extract text from this image.');
      }
    } catch (e) {
      console.log('OCR error:', e);
      Alert.alert('OCR Error', 'Failed to analyze the image. Please try again or use a clearer photo.');
    }
    setOcrProcessing(false);
  };

  const runOcrOnMultiplePages = async (pages: ScannedPage[]) => {
    setOcrProcessing(true);
    try {
      const result = await extractTextFromMultipleImages(
        pages.map(p => ({ base64: p.base64, mimeType: p.mimeType }))
      );
      if (result.success) {
        setPending(prev => prev ? { ...prev, ocrTitle: result.title, ocrText: result.text } : null);
      } else {
        Alert.alert('OCR Notice', result.text || 'Could not extract text from these images.');
      }
    } catch (e) {
      console.log('Multi-page OCR error:', e);
      Alert.alert('OCR Error', 'Failed to analyze the pages. Please try again.');
    }
    setOcrProcessing(false);
  };

  const addPageFromCamera = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.7,
      mediaTypes: ['images'],
      base64: true,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      let base64Data = asset.base64 || undefined;
      if (!base64Data && asset.uri) {
        try {
          base64Data = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.Base64 });
        } catch { /* fallback */ }
      }
      if (base64Data) {
        const mimeType = asset.uri?.toLowerCase().includes('.png') ? 'image/png' : 'image/jpeg';
        setScannedPages(prev => [...prev, { uri: asset.uri, base64: base64Data!, mimeType }]);
      }
    }
  };

  const addPageFromLibrary = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      quality: 0.7,
      mediaTypes: ['images'],
      base64: true,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      let base64Data = asset.base64 || undefined;
      if (!base64Data && asset.uri) {
        try {
          base64Data = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.Base64 });
        } catch { /* fallback */ }
      }
      if (base64Data) {
        const mimeType = asset.uri?.toLowerCase().includes('.png') ? 'image/png' : 'image/jpeg';
        setScannedPages(prev => [...prev, { uri: asset.uri, base64: base64Data!, mimeType }]);
      }
    }
  };

  const removePage = (index: number) => {
    setScannedPages(prev => prev.filter((_, i) => i !== index));
  };

  const finalizeMultiPageScan = () => {
    if (scannedPages.length === 0) return;
    const newPending: PendingScan = {
      uri: scannedPages[0].uri,
      name: `${MODE_PREFIX[scanMode]}_${Date.now()}.jpg`,
      source: 'camera',
      pages: scannedPages.length,
      base64: scannedPages[0].base64,
    };
    setPending(newPending);
    if (scannedPages.length === 1) {
      runOcrOnImage(scannedPages[0].base64, scannedPages[0].mimeType);
    } else {
      runOcrOnMultiplePages(scannedPages);
    }
  };

  const handleCameraCapture = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return;

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.7,
      mediaTypes: ['images'],
      base64: true,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      let base64Data = asset.base64 || undefined;
      if (!base64Data && asset.uri) {
        try {
          base64Data = await FileSystem.readAsStringAsync(asset.uri, {
            encoding: FileSystem.EncodingType.Base64,
          });
        } catch { /* fallback */ }
      }
      if (base64Data) {
        const mimeType = asset.uri?.toLowerCase().includes('.png') ? 'image/png' : 'image/jpeg';
        // Add as first page of multi-page scan
        setScannedPages([{ uri: asset.uri, base64: base64Data, mimeType }]);
      }
    }
  };

  const handlePickFromLibrary = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      quality: 0.7,
      mediaTypes: ['images'],
      base64: true,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      let base64Data = asset.base64 || undefined;
      if (!base64Data && asset.uri) {
        try {
          base64Data = await FileSystem.readAsStringAsync(asset.uri, {
            encoding: FileSystem.EncodingType.Base64,
          });
        } catch (e) {
          console.log('Failed to read base64 from URI:', e);
        }
      }
      if (base64Data) {
        const mimeType = asset.uri?.toLowerCase().includes('.png') ? 'image/png' : 'image/jpeg';
        // Add as first page of multi-page scan
        setScannedPages([{ uri: asset.uri, base64: base64Data, mimeType }]);
      }
    }
  };

  // ── Crop modal state ──
  const [showCropModal, setShowCropModal] = useState(false);
  const [cropRegion, setCropRegion] = useState({ x: 40, y: 80, w: 250, h: 350 });
  const [imageLayout, setImageLayout] = useState({ w: 0, h: 0, naturalW: 0, naturalH: 0 });
  const activeCorner = useRef<string | null>(null);
  const startCrop = useRef({ x: 0, y: 0, w: 0, h: 0 });
  const startTouch = useRef({ x: 0, y: 0 });

  const MIN_CROP = 60;

  const handleCropPending = () => {
    if (!pending) return;
    // Get image dimensions to set up proper crop region
    Image.getSize(pending.uri, (naturalW, naturalH) => {
      const screenW = Dimensions.get('window').width - 32;
      const scale = screenW / naturalW;
      const displayH = Math.min(naturalH * scale, Dimensions.get('window').height * 0.6);
      const displayW = screenW;
      setImageLayout({ w: displayW, h: displayH, naturalW, naturalH });
      // Default crop: 80% of visible area, centered
      const margin = 0.1;
      setCropRegion({
        x: displayW * margin,
        y: displayH * margin,
        w: displayW * (1 - 2 * margin),
        h: displayH * (1 - 2 * margin),
      });
      setShowCropModal(true);
    }, () => {
      // fallback if getSize fails
      const screenW = Dimensions.get('window').width - 32;
      setImageLayout({ w: screenW, h: 400, naturalW: screenW, naturalH: 400 });
      setCropRegion({ x: 30, y: 30, w: screenW - 60, h: 340 });
      setShowCropModal(true);
    });
  };

  const onCornerMove = useCallback((corner: string, dx: number, dy: number) => {
    const s = startCrop.current;
    setCropRegion(() => {
      let { x, y, w, h } = { ...s };
      if (corner === 'tl') { x += dx; y += dy; w -= dx; h -= dy; }
      else if (corner === 'tr') { y += dy; w += dx; h -= dy; }
      else if (corner === 'bl') { x += dx; w -= dx; h += dy; }
      else if (corner === 'br') { w += dx; h += dy; }
      else if (corner === 'move') { x += dx; y += dy; }
      // Clamp
      if (w < MIN_CROP) w = MIN_CROP;
      if (h < MIN_CROP) h = MIN_CROP;
      if (x < 0) x = 0;
      if (y < 0) y = 0;
      if (x + w > imageLayout.w) x = imageLayout.w - w;
      if (y + h > imageLayout.h) y = imageLayout.h - h;
      return { x, y, w, h };
    });
  }, [imageLayout]);

  const applyCrop = async () => {
    if (!pending || !imageLayout.naturalW) return;
    const scaleX = imageLayout.naturalW / imageLayout.w;
    const scaleY = imageLayout.naturalH / imageLayout.h;
    const originX = Math.max(0, Math.round(cropRegion.x * scaleX));
    const originY = Math.max(0, Math.round(cropRegion.y * scaleY));
    const width = Math.min(imageLayout.naturalW - originX, Math.max(1, Math.round(cropRegion.w * scaleX)));
    const height = Math.min(imageLayout.naturalH - originY, Math.max(1, Math.round(cropRegion.h * scaleY)));

    try {
      const result = await ImageManipulator.manipulateAsync(
        pending.uri,
        [{ crop: { originX, originY, width, height } }],
        { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG }
      );
      setPending(prev => prev ? { ...prev, uri: result.uri } : null);
    } catch (e) {
      console.log('Crop error:', e);
    }
    setShowCropModal(false);
  };

  const handlePickDocument = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      multiple: false,
      type: ['application/pdf', 'image/*', 'text/plain'],
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const pages = asset.mimeType === 'application/pdf' ? 3 : 1;
      setPending({
        uri: asset.uri,
        name: asset.name,
        source: 'document',
        pages,
        sizeBytes: asset.size,
      });
    }
  };

  const [ocrProcessing, setOcrProcessing] = useState(false);

  const saveScan = async () => {
    if (!pending) return;

    // If no class is selected, prompt to create one
    if (!destinationClassId) {
      if (onAddClass) {
        setShowCreateClass(true);
        Alert.alert(
          'No Class Selected',
          'Create a class first so your scan has a home.',
        );
      }
      return;
    }

    setSaving(true);

    // Use pre-analyzed OCR results if available
    const previewTitle = pending.ocrTitle || pending.name.replace(/\.[^/.]+$/, '');
    const previewText = pending.ocrText || 'Scanned content is ready. Add tags, move to a unit, and share with your study group to collaborate faster.';

    const file: FileData = {
      id: Date.now(),
      name: pending.name,
      date: formatDate(),
      thumbnail:
        pending.source === 'document'
          ? 'https://images.unsplash.com/photo-1517842645767-c639042777db?w=120&h=80&fit=crop'
          : pending.uri,
      pages: pending.pages,
      size: formatSize(pending.sizeBytes),
      readTime: `${Math.max(2, pending.pages * 2)} Min Read`,
      previewTitle,
      previewText,
      source: pending.source,
    };

    onSaveScan(destinationClassId, file);
    setSaving(false);
    setPending(null);
    setScannedPages([]);
  };

  const modeIcon = (mode: ScanMode): keyof typeof Ionicons.glyphMap => {
    if (mode === 'notes') return 'document-text-outline';
    if (mode === 'document') return 'folder-outline';
    return 'easel-outline';
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.topBar}>
          <AnimatedPressable onPress={onHome} style={styles.backBtn} scaleDown={0.88}>
            <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
          </AnimatedPressable>
          <Text style={styles.topTitle}>Smart Scan</Text>
          <View style={{ width: 42 }} />
        </View>

        {tutorialGuide && (
          <View style={styles.tutorialCardWrap}>
            <InlineTutorialCard
              step={tutorialGuide.step}
              totalSteps={TUTORIAL_TOTAL_STEPS}
              title={tutorialGuide.title}
              body={tutorialGuide.body}
              onDismiss={onTutorialSkip}
              onPrevious={onTutorialBack}
              onNext={onTutorialNext}
              nextLabel="Go to People"
            />
          </View>
        )}

        {/* Mode selector */}
        <View style={styles.modeRow}>
          {(['notes', 'document', 'whiteboard'] as ScanMode[]).map((mode) => (
            <TouchableOpacity
              key={mode}
              style={[styles.modeBtn, scanMode === mode && styles.modeBtnActive]}
              onPress={() => setScanMode(mode)}
            >
              <Ionicons name={modeIcon(mode)} size={16} color={scanMode === mode ? 'white' : colors.textSecondary} />
              <Text style={[styles.modeText, scanMode === mode && styles.modeTextActive]}>
                {mode[0].toUpperCase() + mode.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {!pending && scannedPages.length === 0 ? (
          <View style={styles.capturePanel}>
            <Text style={styles.captureTitle}>{MODE_CONFIG[scanMode].title}</Text>
            <Text style={styles.captureSub}>{MODE_CONFIG[scanMode].subtitle}</Text>

            <View style={styles.captureActions}>
              {/* Camera — available in Notes & Whiteboard */}
              {(scanMode === 'notes' || scanMode === 'whiteboard') && (
                <AnimatedPressable style={styles.captureCard} onPress={handleCameraCapture} scaleDown={0.96}>
                  <View style={styles.captureIcon}><Ionicons name="camera" size={22} color={colors.maroon} /></View>
                  <View>
                    <Text style={styles.captureCardTitle}>Camera</Text>
                    <Text style={styles.captureCardSub}>
                      {scanMode === 'whiteboard' ? 'Snap a whiteboard photo' : 'Scan notes instantly'}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} style={{ marginLeft: 'auto' }} />
                </AnimatedPressable>
              )}

              {/* Photos — available in Notes & Document */}
              {(scanMode === 'notes' || scanMode === 'document') && (
                <AnimatedPressable style={styles.captureCard} onPress={handlePickFromLibrary} scaleDown={0.96}>
                  <View style={styles.captureIcon}><Ionicons name="images" size={22} color={colors.maroon} /></View>
                  <View>
                    <Text style={styles.captureCardTitle}>Photos</Text>
                    <Text style={styles.captureCardSub}>Import from gallery</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} style={{ marginLeft: 'auto' }} />
                </AnimatedPressable>
              )}

              {/* Files — available in Document only */}
              {scanMode === 'document' && (
                <AnimatedPressable style={styles.captureCard} onPress={handlePickDocument} scaleDown={0.96}>
                  <View style={styles.captureIcon}><Ionicons name="folder-open" size={22} color={colors.maroon} /></View>
                  <View>
                    <Text style={styles.captureCardTitle}>Files</Text>
                    <Text style={styles.captureCardSub}>PDF, image, text</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} style={{ marginLeft: 'auto' }} />
                </AnimatedPressable>
              )}
            </View>
          </View>
        ) : !pending && scannedPages.length > 0 ? (
          /* ── Multi-Page Staging ── */
          <View style={styles.capturePanel}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <Text style={styles.captureTitle}>
                {scannedPages.length} Page{scannedPages.length > 1 ? 's' : ''} Scanned
              </Text>
              <TouchableOpacity onPress={() => setScannedPages([])} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={{ fontSize: 13, fontFamily: fonts.medium, color: colors.textTertiary }}>Clear All</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.captureSub}>Add more pages or tap "Analyze" when ready. AI will combine all pages into one note.</Text>

            {/* Page thumbnails */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingVertical: 12 }}>
              {scannedPages.map((page, idx) => (
                <View key={idx} style={{ position: 'relative' }}>
                  <Image source={{ uri: page.uri }} style={{ width: 80, height: 110, borderRadius: 10, backgroundColor: '#F3F4F6' }} />
                  <TouchableOpacity
                    onPress={() => removePage(idx)}
                    style={{
                      position: 'absolute', top: -6, right: -6,
                      width: 22, height: 22, borderRadius: 11,
                      backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center',
                      borderWidth: 2, borderColor: 'white',
                    }}
                  >
                    <Ionicons name="close" size={12} color="white" />
                  </TouchableOpacity>
                  <View style={{
                    position: 'absolute', bottom: 4, left: 4,
                    backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 6,
                    paddingHorizontal: 6, paddingVertical: 2,
                  }}>
                    <Text style={{ fontSize: 10, fontFamily: fonts.bold, color: 'white' }}>P{idx + 1}</Text>
                  </View>
                </View>
              ))}
            </ScrollView>

            {/* Add more pages */}
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
              <TouchableOpacity
                style={{
                  flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
                  paddingVertical: 12, borderRadius: 12, borderWidth: 1.5, borderColor: '#E5E7EB', borderStyle: 'dashed',
                }}
                onPress={addPageFromCamera}
              >
                <Ionicons name="camera-outline" size={18} color={colors.maroon} />
                <Text style={{ fontSize: 13, fontFamily: fonts.medium, color: colors.textPrimary }}>Add Page</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
                  paddingVertical: 12, borderRadius: 12, borderWidth: 1.5, borderColor: '#E5E7EB', borderStyle: 'dashed',
                }}
                onPress={addPageFromLibrary}
              >
                <Ionicons name="images-outline" size={18} color={colors.maroon} />
                <Text style={{ fontSize: 13, fontFamily: fonts.medium, color: colors.textPrimary }}>From Gallery</Text>
              </TouchableOpacity>
            </View>

            {/* Analyze button */}
            <TouchableOpacity
              style={{
                marginTop: 16, backgroundColor: colors.maroon, borderRadius: 14,
                paddingVertical: 14, alignItems: 'center', flexDirection: 'row',
                justifyContent: 'center', gap: 8,
              }}
              onPress={finalizeMultiPageScan}
            >
              <Ionicons name="sparkles" size={18} color="white" />
              <Text style={{ fontSize: 15, fontFamily: fonts.bold, color: 'white' }}>
                Analyze {scannedPages.length} Page{scannedPages.length > 1 ? 's' : ''} as One Note
              </Text>
            </TouchableOpacity>
          </View>
        ) : pending ? (
          <View style={styles.pendingPanel}>
            <View style={styles.pendingHeader}>
              <View style={styles.pendingCheckIcon}>
                <Ionicons name={ocrProcessing ? 'sparkles' : 'checkmark-circle'} size={20} color={ocrProcessing ? colors.maroon : '#059669'} />
              </View>
              <Text style={styles.pendingTitle}>{ocrProcessing ? 'AI Analyzing...' : 'Ready to Save'}</Text>
            </View>
            <View style={styles.modeBadge}>
              <Ionicons name={modeIcon(scanMode)} size={12} color={colors.maroon} />
              <Text style={styles.modeBadgeText}>{MODE_CONFIG[scanMode].badge}</Text>
            </View>
            <Text style={styles.pendingFileName}>{pending.ocrTitle || pending.name}</Text>
            <Text style={styles.pendingMeta}>
              Source: {pending.source} • {pending.pages} page{pending.pages > 1 ? 's' : ''}
              {ocrProcessing ? ' • extracting text…' : pending.ocrText ? ' • text extracted ✓' : ''}
            </Text>

            <Text style={styles.destinationTitle}>Choose Destination Class</Text>
            {classes.length > 0 ? (
              <View style={styles.destinationRow}>
                {classes.map((cls) => (
                  <TouchableOpacity
                    key={cls.id}
                    style={[styles.destinationChip, destinationClassId === cls.id && styles.destinationChipActive]}
                    onPress={() => setDestinationClassId(cls.id)}
                  >
                    <Ionicons
                      name={destinationClassId === cls.id ? 'book' : 'book-outline'}
                      size={13}
                      color={destinationClassId === cls.id ? colors.maroon : colors.textTertiary}
                    />
                    <Text style={[styles.destinationChipText, destinationClassId === cls.id && styles.destinationChipTextActive]}>
                      {cls.title}
                    </Text>
                  </TouchableOpacity>
                ))}
                {onAddClass && (
                  <TouchableOpacity
                    style={styles.destinationChipNew}
                    onPress={() => setShowCreateClass(true)}
                  >
                    <Ionicons name="add-circle-outline" size={14} color={colors.maroon} />
                    <Text style={styles.destinationChipNewText}>New Class</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : showCreateClass ? null : (
              <TouchableOpacity
                style={scanExtraStyles.createClassPrompt}
                onPress={() => setShowCreateClass(true)}
              >
                <View style={scanExtraStyles.createClassIcon}>
                  <Ionicons name="add-circle" size={22} color={colors.maroon} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={scanExtraStyles.createClassPromptTitle}>Create Your First Class</Text>
                  <Text style={scanExtraStyles.createClassPromptSub}>Add a class to save this scan into</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
              </TouchableOpacity>
            )}

            {showCreateClass && (
              <View style={scanExtraStyles.inlineCreateCard}>
                <Text style={scanExtraStyles.inlineCreateTitle}>Quick Create Class</Text>
                <TextInput
                  style={scanExtraStyles.inlineCreateInput}
                  placeholder="Class name (e.g. AP World)"
                  placeholderTextColor={colors.textTertiary}
                  value={newClassName}
                  onChangeText={setNewClassName}
                  autoFocus
                />
                <TextInput
                  style={scanExtraStyles.inlineCreateInput}
                  placeholder="Teacher (e.g. Mr. Smith)"
                  placeholderTextColor={colors.textTertiary}
                  value={newClassTeacher}
                  onChangeText={setNewClassTeacher}
                />
                <Text style={scanExtraStyles.inlineCreateLabel}>Block</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((num) => {
                    const blockVal = `Block ${num}`;
                    const selected = newClassBlock === blockVal;
                    return (
                      <TouchableOpacity
                        key={num}
                        style={[scanExtraStyles.blockPickerBtn, selected && scanExtraStyles.blockPickerBtnActive]}
                        onPress={() => setNewClassBlock(selected ? '' : blockVal)}
                      >
                        <Text style={[scanExtraStyles.blockPickerBtnText, selected && scanExtraStyles.blockPickerBtnTextActive]}>{num}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
                <View style={scanExtraStyles.inlineCreateActions}>
                  <TouchableOpacity
                    style={scanExtraStyles.inlineCreateCancel}
                    onPress={() => { setShowCreateClass(false); setNewClassName(''); setNewClassTeacher(''); setNewClassBlock(''); }}
                  >
                    <Text style={scanExtraStyles.inlineCreateCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[scanExtraStyles.inlineCreateBtn, (!newClassName.trim() || !newClassTeacher.trim()) && { opacity: 0.5 }]}
                    disabled={!newClassName.trim() || !newClassTeacher.trim()}
                    onPress={() => {
                      if (onAddClass && newClassName.trim() && newClassTeacher.trim()) {
                        const classId = Date.now().toString();
                        const classCode = newClassName.trim().replace(/\s+/g, '').toUpperCase().slice(0, 6) + Math.floor(Math.random() * 900 + 100);
                        const newClass: ClassData = {
                          id: classId,
                          title: newClassName.trim(),
                          block: newClassBlock.trim(),
                          classCode,
                          image: 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=600&h=500&fit=crop',
                          classmates: 1,
                          documents: 0,
                          color: colors.maroon,
                          description: newClassName.trim(),
                          files: [],
                          units: [],
                          teacher: newClassTeacher.trim(),
                        };
                        onAddClass(newClass);
                        setDestinationClassId(classId);
                        setShowCreateClass(false);
                        setNewClassName('');
                        setNewClassTeacher('');
                        setNewClassBlock('');
                      }
                    }}
                  >
                    <Ionicons name="checkmark" size={16} color="white" />
                    <Text style={scanExtraStyles.inlineCreateBtnText}>Create & Select</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            <View style={styles.pendingActions}>
              <TouchableOpacity style={styles.secondaryBtn} onPress={() => setPending(null)}>
                <Text style={styles.secondaryBtnText}>Discard</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.cropBtn} onPress={handleCropPending}>
                <Ionicons name="crop" size={16} color={colors.maroon} />
                <Text style={styles.cropBtnText}>Crop</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.primaryBtn, (saving || ocrProcessing) && { opacity: 0.6 }]} onPress={saveScan} disabled={saving || ocrProcessing}>
                {saving && <ActivityIndicator size="small" color="white" style={{ marginRight: 4 }} />}
                <Text style={styles.primaryBtnText}>{saving ? 'Saving...' : 'Save'}</Text>
                {!saving && <Ionicons name="arrow-forward" size={16} color="white" />}
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        {/* Recent Scans */}
        <Text style={styles.recentSectionTitle}>Recent Scans</Text>
        <View style={styles.recentPanel}>
          {recentScans.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <Ionicons name="scan-outline" size={28} color={colors.textTertiary} />
              </View>
              <Text style={styles.emptyTitle}>No scans yet</Text>
              <Text style={styles.emptySub}>Capture your first file above to get started.</Text>
            </View>
          ) : (
            recentScans.map((scan) => (
              <TouchableOpacity
                key={scan.id}
                style={styles.recentItem}
                onPress={() => onOpenFile?.(scan.classId, scan.fileId)}
                activeOpacity={0.7}
              >
                <View style={styles.recentIcon}>
                  <Ionicons name={scan.source === 'document' ? 'document-text' : 'image'} size={16} color={colors.maroon} />
                </View>
                <View style={styles.recentInfo}>
                  <Text style={styles.recentName}>{scan.title}</Text>
                  <Text style={styles.recentMeta}>{scan.date} • {scan.pages} pages</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Text style={styles.recentCourse}>{scan.course}</Text>
                  <Ionicons name="chevron-forward" size={14} color={colors.textTertiary} />
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>

      <BottomNav active="scan" onHome={onHome} onFiles={onFiles} onScan={() => { }} onFriends={onFriends} highlightedTab={tutorialStep === 5 ? 'people' : undefined} />

      {/* ── Crop Modal ── */}
      <Modal visible={showCropModal} animationType="slide" statusBarTranslucent>
        <View style={cropStyles.container}>
          <View style={cropStyles.header}>
            <Text style={cropStyles.title}>Crop Image</Text>
            <Text style={cropStyles.subtitle}>Drag corners to adjust</Text>
          </View>

          <View style={cropStyles.imageWrap}>
            <View style={{ width: imageLayout.w, height: imageLayout.h }}>
              <Image
                source={{ uri: pending?.uri }}
                style={{ width: imageLayout.w, height: imageLayout.h, borderRadius: 8 }}
                resizeMode="cover"
              />
              {/* Dark overlay - top */}
              <View style={[cropStyles.overlay, { top: 0, left: 0, right: 0, height: cropRegion.y }]} />
              {/* Dark overlay - bottom */}
              <View style={[cropStyles.overlay, { top: cropRegion.y + cropRegion.h, left: 0, right: 0, bottom: 0 }]} />
              {/* Dark overlay - left */}
              <View style={[cropStyles.overlay, { top: cropRegion.y, left: 0, width: cropRegion.x, height: cropRegion.h }]} />
              {/* Dark overlay - right */}
              <View style={[cropStyles.overlay, { top: cropRegion.y, left: cropRegion.x + cropRegion.w, right: 0, height: cropRegion.h }]} />

              {/* Crop border */}
              <View style={[cropStyles.cropBorder, {
                left: cropRegion.x, top: cropRegion.y,
                width: cropRegion.w, height: cropRegion.h,
              }]}
                onStartShouldSetResponder={() => true}
                onMoveShouldSetResponder={() => true}
                onResponderGrant={(e) => {
                  startCrop.current = { ...cropRegion };
                  startTouch.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY };
                  activeCorner.current = 'move';
                }}
                onResponderMove={(e) => {
                  const dx = e.nativeEvent.pageX - startTouch.current.x;
                  const dy = e.nativeEvent.pageY - startTouch.current.y;
                  onCornerMove('move', dx, dy);
                }}
              />

              {/* Corner handles */}
              {(['tl', 'tr', 'bl', 'br'] as const).map((corner) => {
                const isLeft = corner.includes('l');
                const isTop = corner.includes('t');
                const posX = isLeft ? cropRegion.x - 14 : cropRegion.x + cropRegion.w - 14;
                const posY = isTop ? cropRegion.y - 14 : cropRegion.y + cropRegion.h - 14;
                return (
                  <View
                    key={corner}
                    style={[cropStyles.handle, { left: posX, top: posY }]}
                    onStartShouldSetResponder={() => true}
                    onMoveShouldSetResponder={() => true}
                    onResponderGrant={(e) => {
                      startCrop.current = { ...cropRegion };
                      startTouch.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY };
                      activeCorner.current = corner;
                    }}
                    onResponderMove={(e) => {
                      const dx = e.nativeEvent.pageX - startTouch.current.x;
                      const dy = e.nativeEvent.pageY - startTouch.current.y;
                      onCornerMove(corner, dx, dy);
                    }}
                  />
                );
              })}
            </View>
          </View>

          <View style={cropStyles.actions}>
            <TouchableOpacity style={cropStyles.cancelBtn} onPress={() => setShowCropModal(false)}>
              <Text style={cropStyles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={cropStyles.applyBtn} onPress={applyCrop}>
              <Ionicons name="checkmark" size={18} color="white" />
              <Text style={cropStyles.applyText}>Apply Crop</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF8F2' },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 24, paddingBottom: 120 },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    marginBottom: 4,
  },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 16,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#F0E0D0',
  },
  topTitle: {
    fontSize: 20,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
  },
  tutorialCardWrap: {
    marginTop: -12,
    marginBottom: 18,
  },

  modeRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  modeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: '#F0E0D0',
  },
  modeBtnActive: { backgroundColor: colors.maroon, borderColor: colors.maroon },
  modeText: { fontSize: 12, color: colors.textSecondary, fontFamily: fonts.semiBold },
  modeTextActive: { color: 'white' },

  capturePanel: {
    backgroundColor: 'white',
    borderRadius: 24,
    padding: 20,
    borderWidth: 2,
    borderColor: '#F0E0D0',
  },
  captureTitle: { fontSize: 20, fontFamily: fonts.bold, color: colors.textPrimary, letterSpacing: -0.3 },
  captureSub: { fontSize: 13, color: colors.textSecondary, marginTop: 4, fontFamily: fonts.regular },
  captureActions: { gap: 10, marginTop: 16 },
  captureCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#FFF5ED',
    borderRadius: 18,
    padding: 16,
    borderWidth: 2,
    borderColor: '#F0E0D0',
  },
  captureIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: `${colors.maroon}12`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureCardTitle: { fontSize: 15, fontFamily: fonts.bold, color: colors.textPrimary },
  captureCardSub: { fontSize: 12, color: colors.textSecondary, marginTop: 2, fontFamily: fonts.regular },

  pendingPanel: {
    backgroundColor: 'white',
    borderRadius: 24,
    padding: 20,
    borderWidth: 2,
    borderColor: '#F0E0D0',
  },
  pendingHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pendingCheckIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#D1FAE5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingTitle: { fontSize: 18, fontFamily: fonts.bold, color: colors.textPrimary },
  modeBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    alignSelf: 'flex-start' as const,
    gap: 5,
    marginTop: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: `${colors.maroon}12`,
  },
  modeBadgeText: { fontSize: 11, fontFamily: fonts.semiBold, color: colors.maroon },
  pendingFileName: { fontSize: 15, fontFamily: fonts.bold, color: colors.textPrimary, marginTop: 8 },
  pendingMeta: { fontSize: 12, color: colors.textSecondary, marginTop: 3, fontFamily: fonts.regular },
  destinationTitle: { fontSize: 11, fontFamily: fonts.bold, color: colors.textTertiary, marginTop: 16, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.8 },
  destinationRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  destinationChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#E8E0D8',
    backgroundColor: '#FAFAF8',
  },
  destinationChipActive: {
    borderColor: colors.maroon,
    backgroundColor: `${colors.maroon}0D`,
  },
  destinationChipText: { fontSize: 13, color: colors.textSecondary, fontFamily: fonts.medium },
  destinationChipTextActive: { color: colors.maroon, fontFamily: fonts.bold },
  destinationChipNew: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: `${colors.maroon}30`,
    borderStyle: 'dashed' as any,
    backgroundColor: `${colors.maroon}06`,
  },
  destinationChipNewText: { fontSize: 13, color: colors.maroon, fontFamily: fonts.semiBold },
  noClassesHint: { fontSize: 12, color: colors.textTertiary, fontFamily: fonts.regular },
  pendingActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  secondaryBtn: {
    flex: 1,
    height: 48,
    borderRadius: 18,
    backgroundColor: '#FFF5ED',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#F0E0D0',
  },
  secondaryBtnText: { fontSize: 13, fontFamily: fonts.bold, color: colors.textSecondary },
  primaryBtn: {
    flex: 1,
    height: 48,
    borderRadius: 18,
    backgroundColor: colors.maroon,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  primaryBtnText: { fontSize: 13, fontFamily: fonts.bold, color: 'white' },
  cropBtn: {
    height: 48,
    paddingHorizontal: 16,
    borderRadius: 18,
    backgroundColor: `${colors.maroon}10`,
    borderWidth: 2,
    borderColor: colors.maroon,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 5,
  },
  cropBtnText: { fontSize: 13, fontFamily: fonts.bold, color: colors.maroon },

  recentSectionTitle: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: colors.textSecondary,
    letterSpacing: 0.5,
    marginTop: 24,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  recentPanel: {
    backgroundColor: 'white',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#F0E0D0',
    overflow: 'hidden',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 20,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 20,
    backgroundColor: '#FFF5ED',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: { fontSize: 15, fontFamily: fonts.bold, color: colors.textPrimary },
  emptySub: { fontSize: 12, color: colors.textSecondary, marginTop: 4, fontFamily: fonts.regular, textAlign: 'center' },
  recentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#FFF5ED',
  },
  recentIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#FFF5ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recentInfo: { flex: 1 },
  recentName: { fontSize: 13, color: colors.textPrimary, fontFamily: fonts.semiBold },
  recentMeta: { fontSize: 11, color: colors.textSecondary, marginTop: 2, fontFamily: fonts.regular },
  recentCourse: { fontSize: 10, color: colors.textTertiary, maxWidth: 92, textAlign: 'right', fontFamily: fonts.medium },
});

const cropStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    justifyContent: 'space-between',
  },
  header: {
    paddingTop: 60,
    paddingBottom: 16,
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontFamily: fonts.bold,
    color: 'white',
  },
  subtitle: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: '#999',
    marginTop: 4,
  },
  imageWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  overlay: {
    position: 'absolute',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  cropBorder: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: 'white',
    borderStyle: 'dashed',
  },
  handle: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'white',
    borderWidth: 3,
    borderColor: colors.maroon,
    zIndex: 10,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 24,
    paddingBottom: 48,
    paddingTop: 20,
  },
  cancelBtn: {
    flex: 1,
    height: 52,
    borderRadius: 18,
    backgroundColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    fontSize: 15,
    fontFamily: fonts.bold,
    color: '#ccc',
  },
  applyBtn: {
    flex: 1,
    height: 52,
    borderRadius: 18,
    backgroundColor: colors.maroon,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  applyText: {
    fontSize: 15,
    fontFamily: fonts.bold,
    color: 'white',
  },
});

const scanExtraStyles = StyleSheet.create({
  createClassPrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: `${colors.maroon}08`,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: `${colors.maroon}25`,
    padding: 14,
    marginTop: 4,
  },
  createClassIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: `${colors.maroon}12`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createClassPromptTitle: {
    fontSize: 14,
    fontFamily: fonts.semiBold,
    color: colors.textPrimary,
  },
  createClassPromptSub: {
    fontSize: 11,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    marginTop: 1,
  },
  inlineCreateCard: {
    backgroundColor: '#FFF8F3',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#F0E0D0',
    padding: 16,
    marginTop: 8,
    gap: 10,
  },
  inlineCreateTitle: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
  },
  inlineCreateInput: {
    fontSize: 14,
    fontFamily: fonts.medium,
    color: colors.textPrimary,
    backgroundColor: 'white',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E8D8D0',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  inlineCreateActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  inlineCreateCancel: {
    flex: 1,
    height: 42,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E0D0C8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inlineCreateCancelText: {
    fontSize: 13,
    fontFamily: fonts.semiBold,
    color: colors.textSecondary,
  },
  inlineCreateBtn: {
    flex: 2,
    height: 42,
    borderRadius: 12,
    backgroundColor: colors.maroon,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  inlineCreateBtnText: {
    fontSize: 13,
    fontFamily: fonts.bold,
    color: 'white',
  },
  inlineCreateLabel: {
    fontSize: 12,
    fontFamily: fonts.bold,
    color: colors.textSecondary,
    marginTop: 2,
  },
  blockPickerBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E8E0D8',
    backgroundColor: '#FAFAF8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  blockPickerBtnActive: {
    borderColor: colors.maroon,
    backgroundColor: `${colors.maroon}12`,
  },
  blockPickerBtnText: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: colors.textTertiary,
  },
  blockPickerBtnTextActive: {
    color: colors.maroon,
  },
});
