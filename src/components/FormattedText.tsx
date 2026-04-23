import React from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { colors, fonts } from '../theme';

interface FormattedTextProps {
  children: string;
  baseStyle?: object;
  accentColor?: string;
}

interface ParsedSegment {
  text: string;
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
}

function parseInline(line: string): ParsedSegment[] {
  const segments: ParsedSegment[] = [];
  // Regex to match: **bold**, *italic*, `code`
  const pattern = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(line)) !== null) {
    // Text before this match
    if (match.index > lastIndex) {
      segments.push({ text: line.slice(lastIndex, match.index) });
    }

    if (match[2] !== undefined) {
      // **bold**
      segments.push({ text: match[2], bold: true });
    } else if (match[3] !== undefined) {
      // *italic*
      segments.push({ text: match[3], italic: true });
    } else if (match[4] !== undefined) {
      // `code`
      segments.push({ text: match[4], code: true });
    }

    lastIndex = match.index + match[0].length;
  }

  // Remaining text
  if (lastIndex < line.length) {
    segments.push({ text: line.slice(lastIndex) });
  }

  if (segments.length === 0) {
    segments.push({ text: line });
  }

  return segments;
}

function InlineText({ segments, baseStyle, accentColor }: { segments: ParsedSegment[]; baseStyle: object; accentColor: string }) {
  return (
    <Text style={baseStyle}>
      {segments.map((seg, i) => {
        if (seg.code) {
          return (
            <Text
              key={i}
              style={[styles.codeInline, { backgroundColor: `${accentColor}12`, color: accentColor }]}
            >
              {seg.text}
            </Text>
          );
        }
        return (
          <Text
            key={i}
            style={[
              seg.bold && styles.bold,
              seg.italic && styles.italic,
            ]}
          >
            {seg.text}
          </Text>
        );
      })}
    </Text>
  );
}

export function FormattedText({ children, baseStyle = {}, accentColor = colors.maroon }: FormattedTextProps) {
  if (!children) return null;

  const lines = children.split('\n');
  const elements: React.ReactNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = raw.trim();

    // Empty line → spacer
    if (trimmed === '') {
      elements.push(<View key={i} style={styles.spacer} />);
      continue;
    }

    // Horizontal rule
    if (/^[-—]{3,}$/.test(trimmed) || /^\*{3,}$/.test(trimmed)) {
      elements.push(<View key={i} style={[styles.hr, { borderBottomColor: `${accentColor}25` }]} />);
      continue;
    }

    // Heading: ## or ###
    if (trimmed.startsWith('###')) {
      const text = trimmed.replace(/^###\s*/, '');
      elements.push(
        <Text key={i} style={[styles.h3, baseStyle]}>
          <InlineText segments={parseInline(text)} baseStyle={styles.h3} accentColor={accentColor} />
        </Text>
      );
      continue;
    }

    if (trimmed.startsWith('##')) {
      const text = trimmed.replace(/^##\s*/, '');
      elements.push(
        <Text key={i} style={[styles.h2, { color: accentColor }]}>
          <InlineText segments={parseInline(text)} baseStyle={[styles.h2, { color: accentColor }]} accentColor={accentColor} />
        </Text>
      );
      continue;
    }

    if (trimmed.startsWith('#')) {
      const text = trimmed.replace(/^#\s*/, '');
      elements.push(
        <Text key={i} style={[styles.h1, { color: accentColor }]}>
          <InlineText segments={parseInline(text)} baseStyle={[styles.h1, { color: accentColor }]} accentColor={accentColor} />
        </Text>
      );
      continue;
    }

    // Bullet: • or - or *  (but not ** which is bold)
    const bulletMatch = trimmed.match(/^(?:[•\-\*])\s+(.+)/);
    if (bulletMatch && !trimmed.startsWith('**')) {
      elements.push(
        <View key={i} style={styles.bulletRow}>
          <Text style={[styles.bulletDot, { color: accentColor }]}>•</Text>
          <View style={styles.bulletContent}>
            <InlineText segments={parseInline(bulletMatch[1])} baseStyle={[styles.body, baseStyle]} accentColor={accentColor} />
          </View>
        </View>
      );
      continue;
    }

    // Numbered list: 1. or 1)
    const numberedMatch = trimmed.match(/^(\d+)[.)]\s+(.+)/);
    if (numberedMatch) {
      elements.push(
        <View key={i} style={styles.bulletRow}>
          <Text style={[styles.numberedLabel, { color: accentColor }]}>{numberedMatch[1]}.</Text>
          <View style={styles.bulletContent}>
            <InlineText segments={parseInline(numberedMatch[2])} baseStyle={[styles.body, baseStyle]} accentColor={accentColor} />
          </View>
        </View>
      );
      continue;
    }

    // Indented sub-bullet (2+ spaces then bullet)
    const subBulletMatch = trimmed.match(/^\s{2,}[•\-\*]\s+(.+)/);
    if (subBulletMatch) {
      elements.push(
        <View key={i} style={[styles.bulletRow, { paddingLeft: 18 }]}>
          <Text style={[styles.bulletDot, { color: `${accentColor}80`, fontSize: 10 }]}>◦</Text>
          <View style={styles.bulletContent}>
            <InlineText segments={parseInline(subBulletMatch[1])} baseStyle={[styles.body, baseStyle, { fontSize: 12.5 }]} accentColor={accentColor} />
          </View>
        </View>
      );
      continue;
    }

    // Regular paragraph text
    elements.push(
      <InlineText key={i} segments={parseInline(trimmed)} baseStyle={[styles.body, baseStyle]} accentColor={accentColor} />
    );
  }

  return <View style={styles.container}>{elements}</View>;
}

const styles = StyleSheet.create({
  container: {},
  body: {
    fontSize: 13.5,
    lineHeight: 21,
    color: colors.textPrimary,
    fontFamily: fonts.regular,
  },
  bold: {
    fontFamily: fonts.bold,
  },
  italic: {
    fontStyle: 'italic',
  },
  codeInline: {
    fontFamily: 'Courier',
    fontSize: 12.5,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    overflow: 'hidden',
  },
  h1: {
    fontSize: 18,
    fontFamily: fonts.bold,
    marginTop: 14,
    marginBottom: 4,
    lineHeight: 24,
  },
  h2: {
    fontSize: 15,
    fontFamily: fonts.bold,
    marginTop: 12,
    marginBottom: 3,
    lineHeight: 21,
  },
  h3: {
    fontSize: 14,
    fontFamily: fonts.semiBold,
    color: colors.textPrimary,
    marginTop: 10,
    marginBottom: 2,
    lineHeight: 20,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingLeft: 4,
    marginTop: 3,
  },
  bulletDot: {
    fontSize: 14,
    lineHeight: 21,
    fontFamily: fonts.bold,
    width: 16,
  },
  bulletContent: {
    flex: 1,
  },
  numberedLabel: {
    fontSize: 13,
    lineHeight: 21,
    fontFamily: fonts.bold,
    width: 22,
  },
  spacer: {
    height: 8,
  },
  hr: {
    borderBottomWidth: 1,
    marginVertical: 10,
  },
});
