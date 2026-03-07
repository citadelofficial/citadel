import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
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
}

const items: { id: TabId; icon: keyof typeof Ionicons.glyphMap; label: string }[] = [
  { id: 'home', icon: 'home', label: 'Home' },
  { id: 'scan', icon: 'camera', label: 'Scan' },
  { id: 'people', icon: 'people', label: 'People' },
  { id: 'files', icon: 'folder', label: 'Files' },
];

export function BottomNav({ active, onHome, onScan, onFriends, onFiles }: Props) {
  const insets = useSafeAreaInsets();
  const actions: Record<TabId, (() => void) | undefined> = {
    home: onHome,
    scan: onScan,
    people: onFriends,
    files: onFiles,
  };

  return (
    <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 12) + 12 }]}>
      <View style={styles.bar}>
        {items.map((item) => {
          const isActive = active === item.id;
          return (
            <TouchableOpacity
              key={item.id}
              onPress={actions[item.id]}
              style={[styles.item, isActive && styles.itemActive]}
              activeOpacity={0.8}
            >
              <Ionicons
                name={item.icon}
                size={22}
                color={isActive ? colors.maroon : 'rgba(255,255,255,0.8)'}
              />
            </TouchableOpacity>
          );
        })}
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
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.maroon,
    borderRadius: 28,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  item: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemActive: {
    backgroundColor: 'white',
  },
});
