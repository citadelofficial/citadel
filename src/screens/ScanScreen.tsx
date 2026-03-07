import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { BottomNav } from '../components/BottomNav';
import { colors } from '../theme';
import type { ClassData, FileData } from '../types';

interface Props {
  onHome: () => void;
  onFiles: () => void;
  onFriends: () => void;
  classes: ClassData[];
  onSaveScan: (classId: string, file: FileData) => void;
}

type ScanMode = 'notes' | 'document' | 'whiteboard';

type PendingScan = {
  uri: string;
  name: string;
  source: 'camera' | 'library' | 'document';
  pages: number;
  sizeBytes?: number;
};

function formatDate(date = new Date()) {
  return `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}/${date.getFullYear()}`;
}

function formatSize(sizeBytes?: number) {
  if (!sizeBytes) return '1.2MB';
  const mb = sizeBytes / (1024 * 1024);
  return `${Math.max(0.1, mb).toFixed(1)}MB`;
}

export function ScanScreen({ onHome, onFiles, onFriends, classes, onSaveScan }: Props) {
  const insets = useSafeAreaInsets();
  const [scanMode, setScanMode] = useState<ScanMode>('notes');
  const [flashOn, setFlashOn] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pending, setPending] = useState<PendingScan | null>(null);
  const [destinationClassId, setDestinationClassId] = useState(classes[0]?.id || '');

  const recentScans = useMemo(
    () =>
      classes
        .flatMap((cls) =>
          cls.files.map((file) => ({
            id: `${cls.id}-${file.id}`,
            title: file.name,
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

  const handleCameraCapture = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return;

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.9,
      mediaTypes: ['images'],
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setPending({
        uri: asset.uri,
        name: `Scan_${Date.now()}.jpg`,
        source: 'camera',
        pages: 1,
        sizeBytes: asset.fileSize,
      });
    }
  };

  const handlePickFromLibrary = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      quality: 0.9,
      mediaTypes: ['images'],
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setPending({
        uri: asset.uri,
        name: asset.fileName || `Library_${Date.now()}.jpg`,
        source: 'library',
        pages: 1,
        sizeBytes: asset.fileSize,
      });
    }
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

  const saveScan = () => {
    if (!pending || !destinationClassId) return;

    setSaving(true);
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
      previewTitle: pending.name.replace(/\.[^/.]+$/, ''),
      previewText:
        'Scanned content is ready. Add tags, move to a unit, and share with your study group to collaborate faster.',
      source: pending.source,
    };

    onSaveScan(destinationClassId, file);
    setSaving(false);
    setPending(null);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={onHome} style={styles.topBtn}>
            <Ionicons name="arrow-back" size={22} color="white" />
          </TouchableOpacity>
          <Text style={styles.topTitle}>Smart Scan</Text>
          <TouchableOpacity style={[styles.topBtn, flashOn && styles.flashOn]} onPress={() => setFlashOn(!flashOn)}>
            <Ionicons name="flash" size={20} color={flashOn ? '#111' : 'white'} />
          </TouchableOpacity>
        </View>

        <View style={styles.modeRow}>
          {(['notes', 'document', 'whiteboard'] as ScanMode[]).map((mode) => (
            <TouchableOpacity
              key={mode}
              style={[styles.modeBtn, scanMode === mode && styles.modeBtnActive]}
              onPress={() => setScanMode(mode)}
            >
              <Text style={[styles.modeText, scanMode === mode && styles.modeTextActive]}>
                {mode[0].toUpperCase() + mode.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {!pending ? (
          <View style={styles.capturePanel}>
            <Text style={styles.captureTitle}>Capture or Import</Text>
            <Text style={styles.captureSub}>Use your camera or bring files from your device.</Text>

            <View style={styles.captureActions}>
              <TouchableOpacity style={styles.captureCard} onPress={handleCameraCapture}>
                <View style={styles.captureIcon}><Ionicons name="camera" size={22} color={colors.maroon} /></View>
                <Text style={styles.captureCardTitle}>Camera</Text>
                <Text style={styles.captureCardSub}>Scan notes instantly</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.captureCard} onPress={handlePickFromLibrary}>
                <View style={styles.captureIcon}><Ionicons name="images" size={22} color={colors.maroon} /></View>
                <Text style={styles.captureCardTitle}>Photos</Text>
                <Text style={styles.captureCardSub}>Import from gallery</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.captureCard} onPress={handlePickDocument}>
                <View style={styles.captureIcon}><Ionicons name="folder-open" size={22} color={colors.maroon} /></View>
                <Text style={styles.captureCardTitle}>Files</Text>
                <Text style={styles.captureCardSub}>PDF, image, text</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.pendingPanel}>
            <View style={styles.pendingHeader}>
              <Ionicons name="checkmark-circle" size={24} color="#10b981" />
              <Text style={styles.pendingTitle}>Ready to Save</Text>
            </View>
            <Text style={styles.pendingFileName}>{pending.name}</Text>
            <Text style={styles.pendingMeta}>
              Source: {pending.source} • {pending.pages} page{pending.pages > 1 ? 's' : ''}
            </Text>

            <Text style={styles.destinationTitle}>Choose Destination Class</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.destinationRow}>
              {classes.map((cls) => (
                <TouchableOpacity
                  key={cls.id}
                  style={[styles.destinationChip, destinationClassId === cls.id && styles.destinationChipActive]}
                  onPress={() => setDestinationClassId(cls.id)}
                >
                  <Text style={[styles.destinationChipText, destinationClassId === cls.id && styles.destinationChipTextActive]}>
                    {cls.title}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.pendingActions}>
              <TouchableOpacity style={styles.secondaryBtn} onPress={() => setPending(null)}>
                <Text style={styles.secondaryBtnText}>Discard</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.primaryBtn} onPress={saveScan} disabled={saving || !destinationClassId}>
                <Text style={styles.primaryBtnText}>{saving ? 'Saving...' : 'Save to Class'}</Text>
                <Ionicons name="arrow-forward" size={16} color="white" />
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={styles.recentPanel}>
          <View style={styles.recentHeader}>
            <Text style={styles.recentTitle}>Recent Scans</Text>
            <TouchableOpacity onPress={onFiles}>
              <Text style={styles.recentLink}>Open Files</Text>
            </TouchableOpacity>
          </View>

          {recentScans.length === 0 ? (
            <Text style={styles.recentEmpty}>No scans yet. Capture your first file above.</Text>
          ) : (
            recentScans.map((scan) => (
              <View key={scan.id} style={styles.recentItem}>
                <View style={styles.recentIcon}>
                  <Ionicons name={scan.source === 'document' ? 'document-text' : 'image'} size={16} color={colors.maroon} />
                </View>
                <View style={styles.recentInfo}>
                  <Text style={styles.recentName}>{scan.title}</Text>
                  <Text style={styles.recentMeta}>{scan.date} • {scan.pages} pages</Text>
                </View>
                <Text style={styles.recentCourse}>{scan.course}</Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      <BottomNav active="scan" onHome={onHome} onFiles={onFiles} onScan={() => {}} onFriends={onFriends} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#120a0b' },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 120 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14 },
  topBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  flashOn: { backgroundColor: '#facc15' },
  topTitle: { fontSize: 20, fontWeight: '800', color: 'white' },
  modeRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  modeBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.08)' },
  modeBtnActive: { backgroundColor: colors.maroon },
  modeText: { fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: '600' },
  modeTextActive: { color: 'white' },

  capturePanel: { marginTop: 16, backgroundColor: 'white', borderRadius: 22, padding: 18 },
  captureTitle: { fontSize: 20, fontWeight: '800', color: colors.textPrimary },
  captureSub: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
  captureActions: { gap: 10, marginTop: 14 },
  captureCard: { backgroundColor: '#faf8f8', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#efebeb' },
  captureIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: `${colors.maroon}14`, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  captureCardTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  captureCardSub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },

  pendingPanel: { marginTop: 16, backgroundColor: 'white', borderRadius: 22, padding: 18 },
  pendingHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pendingTitle: { fontSize: 18, fontWeight: '800', color: colors.textPrimary },
  pendingFileName: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, marginTop: 10 },
  pendingMeta: { fontSize: 12, color: colors.textSecondary, marginTop: 3 },
  destinationTitle: { fontSize: 12, fontWeight: '700', color: colors.textSecondary, marginTop: 16, marginBottom: 8 },
  destinationRow: { gap: 8 },
  destinationChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, borderWidth: 1, borderColor: '#ebe6e6', backgroundColor: 'white' },
  destinationChipActive: { borderColor: colors.maroon, backgroundColor: `${colors.maroon}10` },
  destinationChipText: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
  destinationChipTextActive: { color: colors.maroon },
  pendingActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  secondaryBtn: { flex: 1, height: 44, borderRadius: 22, backgroundColor: '#f2f0f0', alignItems: 'center', justifyContent: 'center' },
  secondaryBtnText: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
  primaryBtn: { flex: 1, height: 44, borderRadius: 22, backgroundColor: colors.maroon, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  primaryBtnText: { fontSize: 13, fontWeight: '700', color: 'white' },

  recentPanel: { marginTop: 18, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 20, padding: 14 },
  recentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  recentTitle: { fontSize: 15, fontWeight: '700', color: 'white' },
  recentLink: { fontSize: 12, color: 'rgba(255,255,255,0.7)' },
  recentEmpty: { marginTop: 10, fontSize: 12, color: 'rgba(255,255,255,0.6)' },
  recentItem: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 14, padding: 10 },
  recentIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'white', alignItems: 'center', justifyContent: 'center' },
  recentInfo: { flex: 1 },
  recentName: { fontSize: 13, color: 'white', fontWeight: '600' },
  recentMeta: { fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  recentCourse: { fontSize: 10, color: 'rgba(255,255,255,0.7)', maxWidth: 92, textAlign: 'right' },
});
