import React from 'react';
import { View, TouchableOpacity, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme';

type TabId = 'home' | 'scan' | 'people' | 'files';

interface Props {
  active: TabId;
  onHome?: () => void;
  onScan?: () => void;
  onFriends?: () => void;
  onFiles?: () => void;
  onTabLayout?: (tabId: TabId, rect: { x: number; y: number; width: number; height: number }) => void;
  highlightedTab?: TabId;
  messageBadge?: number;
}

const items: { id: TabId; icon: keyof typeof Ionicons.glyphMap; label: string }[] = [
  { id: 'home', icon: 'home', label: 'Home' },
  { id: 'scan', icon: 'camera', label: 'Scan' },
  { id: 'people', icon: 'people', label: 'People' },
  { id: 'files', icon: 'folder', label: 'Files' },
];

export function BottomNav({ active, onHome, onScan, onFriends, onFiles, onTabLayout, highlightedTab, messageBadge = 0 }: Props) {
  const insets = useSafeAreaInsets();

  const actions: Record<TabId, (() => void) | undefined> = {
    home: onHome,
    scan: onScan,
    people: onFriends,
    files: onFiles,
  };

  return (
    <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 12) + 12 }]}>
      <View style={styles.barOuter}>
        {/* Tabs */}
        <View style={styles.tabRow}>
          {items.map((item) => (
            <TouchableOpacity
              key={item.id}
              onPress={actions[item.id]}
              activeOpacity={0.7}
              onLayout={(e) => {
                if (onTabLayout) {
                  e.target.measureInWindow((x: number, y: number, width: number, height: number) => {
                    onTabLayout(item.id, { x, y, width, height });
                  });
                }
              }}
            >
              <View
                style={[
                  styles.item,
                  highlightedTab === item.id && styles.highlightedItem,
                ]}
              >
                {highlightedTab === item.id && <View style={styles.highlightHalo} />}
                {active === item.id && <View style={styles.activePill} />}
                <Ionicons
                  name={item.icon}
                  size={22}
                  color={active === item.id ? colors.maroon : 'rgba(255,255,255,0.7)'}
                />
                {item.id === 'people' && messageBadge > 0 && (
                  <View style={{
                    position: 'absolute', top: 4, right: 4,
                    minWidth: 16, height: 16, borderRadius: 8,
                    backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center',
                    paddingHorizontal: 4,
                  }}>
                    <Text style={{ fontSize: 9, fontWeight: '800', color: 'white' }}>
                      {messageBadge > 9 ? '9+' : messageBadge}
                    </Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
  },
  barOuter: {
    borderRadius: 32,
    overflow: 'hidden',
    backgroundColor: colors.maroon,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  tabRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
    gap: 8,
  },
  item: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  highlightedItem: {
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  highlightHalo: {
    ...StyleSheet.absoluteFill,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: '#F3D3A7',
  },
  activePill: {
    ...StyleSheet.absoluteFill,
    borderRadius: 26,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
  },
});
