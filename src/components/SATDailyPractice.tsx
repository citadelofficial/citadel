import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, LayoutAnimation, Platform, UIManager } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts } from '../theme';
import { satReadingQuestions, satMathQuestions, type SATQuestion } from '../data/satQuestions';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Tab = 'reading' | 'math';
type Difficulty = 0 | 1 | 2; // 0=easy, 1=medium, 2=hard

const DIFFICULTY_LABELS: Record<Difficulty, string> = { 0: 'Easy', 1: 'Medium', 2: 'Hard' };
const DIFFICULTY_COLORS: Record<Difficulty, string> = { 0: '#059669', 1: '#b45309', 2: '#b91c1c' };

function pickQuestion(questions: SATQuestion[], difficulty: Difficulty, exclude?: number): SATQuestion {
  const total = questions.length;
  const tierSize = Math.ceil(total / 3);
  const start = difficulty * tierSize;
  const end = Math.min(start + tierSize, total);
  const pool = questions.slice(start, end).filter((q) => q.id !== exclude);
  if (pool.length === 0) return questions[Math.floor(Math.random() * total)];
  return pool[Math.floor(Math.random() * pool.length)];
}

export function SATDailyPractice() {
  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('reading');

  // Difficulty per tab
  const [readingDifficulty, setReadingDifficulty] = useState<Difficulty>(1);
  const [mathDifficulty, setMathDifficulty] = useState<Difficulty>(1);

  // Current questions per tab
  const [readingQ, setReadingQ] = useState<SATQuestion>(() => pickQuestion(satReadingQuestions, 1));
  const [mathQ, setMathQ] = useState<SATQuestion>(() => pickQuestion(satMathQuestions, 1));

  // Answer state per tab
  const [readingAnswer, setReadingAnswer] = useState<number | null>(null);
  const [readingRevealed, setReadingRevealed] = useState(false);
  const [mathAnswer, setMathAnswer] = useState<number | null>(null);
  const [mathRevealed, setMathRevealed] = useState(false);

  const question = activeTab === 'reading' ? readingQ : mathQ;
  const selectedAnswer = activeTab === 'reading' ? readingAnswer : mathAnswer;
  const revealed = activeTab === 'reading' ? readingRevealed : mathRevealed;
  const difficulty = activeTab === 'reading' ? readingDifficulty : mathDifficulty;

  const setSelected = activeTab === 'reading' ? setReadingAnswer : setMathAnswer;
  const setRevealed_ = activeTab === 'reading' ? setReadingRevealed : setMathRevealed;

  const toggleExpanded = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((prev) => !prev);
  }, []);

  const handleTabSwitch = (tab: Tab) => {
    setActiveTab(tab);
  };

  const handleSelect = (index: number) => {
    if (revealed) return;
    setSelected(index);
  };

  const handleReveal = () => {
    if (selectedAnswer === null) return;
    setRevealed_(true);
  };

  const loadNewQuestion = useCallback((dir: 'harder' | 'easier' | 'same') => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

    if (activeTab === 'reading') {
      let newDiff = readingDifficulty;
      if (dir === 'harder' && newDiff < 2) newDiff = (newDiff + 1) as Difficulty;
      if (dir === 'easier' && newDiff > 0) newDiff = (newDiff - 1) as Difficulty;
      setReadingDifficulty(newDiff);
      setReadingQ(pickQuestion(satReadingQuestions, newDiff, readingQ.id));
      setReadingAnswer(null);
      setReadingRevealed(false);
    } else {
      let newDiff = mathDifficulty;
      if (dir === 'harder' && newDiff < 2) newDiff = (newDiff + 1) as Difficulty;
      if (dir === 'easier' && newDiff > 0) newDiff = (newDiff - 1) as Difficulty;
      setMathDifficulty(newDiff);
      setMathQ(pickQuestion(satMathQuestions, newDiff, mathQ.id));
      setMathAnswer(null);
      setMathRevealed(false);
    }
  }, [activeTab, readingDifficulty, mathDifficulty, readingQ.id, mathQ.id]);

  const optionLetters = ['A', 'B', 'C', 'D'];
  const isCorrect = selectedAnswer === question.correctIndex;

  return (
    <View style={styles.container}>
      {/* Header — always visible, tappable */}
      <TouchableOpacity style={styles.header} onPress={toggleExpanded} activeOpacity={0.7}>
        <View style={styles.headerLeft}>
          <View style={styles.headerIcon}>
            <Ionicons name="school" size={18} color={colors.maroon} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Daily SAT Practice</Text>
            <Text style={styles.subtitle}>
              {expanded ? `${DIFFICULTY_LABELS[difficulty]} · ${activeTab === 'reading' ? 'Reading' : 'Math'}` : 'Tap to practice'}
            </Text>
          </View>
        </View>
        <View style={styles.chevronWrap}>
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textTertiary} />
        </View>
      </TouchableOpacity>

      {/* Content — only when expanded */}
      {expanded && (
        <View style={styles.content}>
          {/* Tab Toggle */}
          <View style={styles.tabRow}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'reading' && styles.tabActive]}
              onPress={() => handleTabSwitch('reading')}
            >
              <Ionicons name="book-outline" size={14} color={activeTab === 'reading' ? 'white' : colors.textSecondary} />
              <Text style={[styles.tabText, activeTab === 'reading' && styles.tabTextActive]}>Reading</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'math' && styles.tabActive]}
              onPress={() => handleTabSwitch('math')}
            >
              <Ionicons name="calculator-outline" size={14} color={activeTab === 'math' ? 'white' : colors.textSecondary} />
              <Text style={[styles.tabText, activeTab === 'math' && styles.tabTextActive]}>Math</Text>
            </TouchableOpacity>
          </View>

          {/* Difficulty badge */}
          <View style={styles.difficultyRow}>
            <View style={[styles.difficultyBadge, { backgroundColor: `${DIFFICULTY_COLORS[difficulty]}12` }]}>
              <Text style={[styles.difficultyText, { color: DIFFICULTY_COLORS[difficulty] }]}>{DIFFICULTY_LABELS[difficulty]}</Text>
            </View>
            <TouchableOpacity style={styles.reloadBtn} onPress={() => loadNewQuestion('same')}>
              <Ionicons name="refresh" size={14} color={colors.textTertiary} />
              <Text style={styles.reloadBtnText}>New Question</Text>
            </TouchableOpacity>
          </View>

          {/* Passage (Reading only) */}
          {question.passage ? (
            <View style={styles.passageBox}>
              <Text style={styles.passageText}>{question.passage}</Text>
            </View>
          ) : null}

          {/* Question */}
          <Text style={styles.questionText}>{question.question}</Text>

          {/* Options */}
          <View style={styles.optionsContainer}>
            {question.options.map((option, i) => {
              const isSelected = selectedAnswer === i;
              const isCorrectOption = i === question.correctIndex;
              const showCorrect = revealed && isCorrectOption;
              const showWrong = revealed && isSelected && !isCorrectOption;

              return (
                <TouchableOpacity
                  key={i}
                  style={[
                    styles.optionBtn,
                    isSelected && !revealed && styles.optionBtnSelected,
                    showCorrect && styles.optionBtnCorrect,
                    showWrong && styles.optionBtnWrong,
                  ]}
                  onPress={() => handleSelect(i)}
                  disabled={revealed}
                  activeOpacity={0.7}
                >
                  <View style={[
                    styles.optionLetter,
                    isSelected && !revealed && styles.optionLetterSelected,
                    showCorrect && styles.optionLetterCorrect,
                    showWrong && styles.optionLetterWrong,
                  ]}>
                    {showCorrect ? (
                      <Ionicons name="checkmark" size={13} color="white" />
                    ) : showWrong ? (
                      <Ionicons name="close" size={13} color="white" />
                    ) : (
                      <Text style={[
                        styles.optionLetterText,
                        isSelected && !revealed && styles.optionLetterTextSelected,
                      ]}>{optionLetters[i]}</Text>
                    )}
                  </View>
                  <Text style={[
                    styles.optionText,
                    isSelected && !revealed && styles.optionTextSelected,
                    showCorrect && styles.optionTextCorrect,
                    showWrong && styles.optionTextWrong,
                  ]}>{option}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Reveal / Result */}
          {!revealed ? (
            <TouchableOpacity
              style={[styles.revealBtn, selectedAnswer === null && { opacity: 0.5 }]}
              onPress={handleReveal}
              disabled={selectedAnswer === null}
            >
              <Text style={styles.revealBtnText}>Check Answer</Text>
              <Ionicons name="arrow-forward" size={16} color="white" />
            </TouchableOpacity>
          ) : (
            <>
              <View style={[styles.resultBox, isCorrect ? styles.resultBoxCorrect : styles.resultBoxWrong]}>
                <View style={styles.resultHeader}>
                  <View style={[styles.resultIcon, { backgroundColor: isCorrect ? '#D1FAE5' : '#FEE2E2' }]}>
                    <Ionicons
                      name={isCorrect ? 'checkmark-circle' : 'close-circle'}
                      size={18}
                      color={isCorrect ? '#059669' : '#EF4444'}
                    />
                  </View>
                  <Text style={[styles.resultTitle, { color: isCorrect ? '#059669' : '#b91c1c' }]}>
                    {isCorrect ? 'Correct!' : `Incorrect — Answer: ${optionLetters[question.correctIndex]}`}
                  </Text>
                </View>
                <Text style={styles.explanationText}>{question.explanation}</Text>
              </View>

              {/* Next question controls */}
              <View style={styles.nextRow}>
                <TouchableOpacity
                  style={[styles.nextBtn, styles.nextBtnEasier, difficulty === 0 && { opacity: 0.4 }]}
                  onPress={() => loadNewQuestion('easier')}
                  disabled={difficulty === 0}
                >
                  <Ionicons name="arrow-down" size={14} color="#059669" />
                  <Text style={[styles.nextBtnText, { color: '#059669' }]}>Easier</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.nextBtn, styles.nextBtnSame]}
                  onPress={() => loadNewQuestion('same')}
                >
                  <Ionicons name="refresh" size={14} color={colors.maroon} />
                  <Text style={[styles.nextBtnText, { color: colors.maroon }]}>Next</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.nextBtn, styles.nextBtnHarder, difficulty === 2 && { opacity: 0.4 }]}
                  onPress={() => loadNewQuestion('harder')}
                  disabled={difficulty === 2}
                >
                  <Ionicons name="arrow-up" size={14} color="#b91c1c" />
                  <Text style={[styles.nextBtnText, { color: '#b91c1c' }]}>Harder</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'white',
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#F0E0D0',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 18,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  headerIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: `${colors.maroon}14`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 17,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 11,
    fontFamily: fonts.regular,
    color: colors.textTertiary,
    marginTop: 1,
  },
  chevronWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#FFF5ED',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#F0E0D0',
  },
  content: {
    paddingHorizontal: 18,
    paddingBottom: 20,
  },
  tabRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: '#FFF5ED',
    borderWidth: 2,
    borderColor: '#F0E0D0',
  },
  tabActive: {
    backgroundColor: colors.maroon,
    borderColor: colors.maroon,
  },
  tabText: {
    fontSize: 13,
    fontFamily: fonts.semiBold,
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: 'white',
  },
  difficultyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  difficultyBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  difficultyText: {
    fontSize: 11,
    fontFamily: fonts.bold,
    letterSpacing: 0.3,
  },
  reloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: '#FFF5ED',
    borderWidth: 1.5,
    borderColor: '#F0E0D0',
  },
  reloadBtnText: {
    fontSize: 11,
    fontFamily: fonts.semiBold,
    color: colors.textTertiary,
  },
  passageBox: {
    backgroundColor: '#FFF5ED',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#F0E0D0',
    marginBottom: 14,
  },
  passageText: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    fontStyle: 'italic',
    lineHeight: 20,
  },
  questionText: {
    fontSize: 15,
    fontFamily: fonts.semiBold,
    color: colors.textPrimary,
    lineHeight: 22,
    marginBottom: 14,
  },
  optionsContainer: {
    gap: 8,
  },
  optionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E8E0D8',
    backgroundColor: '#FAFAF8',
  },
  optionBtnSelected: {
    borderColor: colors.maroon,
    backgroundColor: `${colors.maroon}0D`,
  },
  optionBtnCorrect: {
    borderColor: '#059669',
    backgroundColor: '#D1FAE5',
  },
  optionBtnWrong: {
    borderColor: '#EF4444',
    backgroundColor: '#FEE2E2',
  },
  optionLetter: {
    width: 28,
    height: 28,
    borderRadius: 10,
    backgroundColor: '#FFF5ED',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#E8E0D8',
  },
  optionLetterSelected: {
    backgroundColor: colors.maroon,
    borderColor: colors.maroon,
  },
  optionLetterCorrect: {
    backgroundColor: '#059669',
    borderColor: '#059669',
  },
  optionLetterWrong: {
    backgroundColor: '#EF4444',
    borderColor: '#EF4444',
  },
  optionLetterText: {
    fontSize: 12,
    fontFamily: fonts.bold,
    color: colors.textTertiary,
  },
  optionLetterTextSelected: {
    color: 'white',
  },
  optionText: {
    flex: 1,
    fontSize: 14,
    fontFamily: fonts.medium,
    color: colors.textPrimary,
    lineHeight: 20,
  },
  optionTextSelected: {
    color: colors.maroon,
    fontFamily: fonts.semiBold,
  },
  optionTextCorrect: {
    color: '#065f46',
    fontFamily: fonts.semiBold,
  },
  optionTextWrong: {
    color: '#991b1b',
    fontFamily: fonts.semiBold,
  },
  revealBtn: {
    marginTop: 14,
    height: 48,
    borderRadius: 18,
    backgroundColor: colors.maroon,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  revealBtnText: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: 'white',
  },
  resultBox: {
    marginTop: 14,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1.5,
  },
  resultBoxCorrect: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  resultBoxWrong: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  resultIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultTitle: {
    fontSize: 14,
    fontFamily: fonts.bold,
  },
  explanationText: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  nextRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  nextBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    height: 42,
    borderRadius: 14,
    borderWidth: 2,
  },
  nextBtnEasier: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  nextBtnSame: {
    backgroundColor: `${colors.maroon}0D`,
    borderColor: `${colors.maroon}25`,
  },
  nextBtnHarder: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  nextBtnText: {
    fontSize: 12,
    fontFamily: fonts.bold,
  },
});
