import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield,
  BookOpen,
  Users,
  User,
  Award,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  School,
  Check,
  ChevronDown,
  Star,
  Heart,
} from 'lucide-react';

interface Props {
  onGetStarted: (userData: { name: string; grade: string; school: string }) => void;
}

const grades = [
  { label: '6th Grade' },
  { label: '7th Grade' },
  { label: '8th Grade' },
  { label: '9th Grade', short: 'Freshman' },
  { label: '10th Grade', short: 'Sophomore' },
  { label: '11th Grade', short: 'Junior' },
  { label: '12th Grade', short: 'Senior' },
  { label: 'College Freshman' },
  { label: 'College Sophomore' },
  { label: 'College Junior' },
  { label: 'College Senior' },
  { label: 'Graduate Student' },
];

// Confetti component for celebration
function Confetti({ show }: { show: boolean }) {
  if (!show) return null;
  const pieces = Array.from({ length: 30 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    color: ['#3D0C11', '#E8B4B8', '#FFD700', '#4CAF50', '#2196F3', '#FF6B6B'][
      Math.floor(Math.random() * 6)
    ],
    delay: Math.random() * 0.5,
    rotation: Math.random() * 360,
    size: Math.random() * 6 + 4,
  }));

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-50">
      {pieces.map((p) => (
        <motion.div
          key={p.id}
          initial={{ y: -20, x: `${p.x}%`, opacity: 1, rotate: 0 }}
          animate={{
            y: '120%',
            rotate: p.rotation + 720,
            opacity: [1, 1, 0],
          }}
          transition={{
            duration: 2 + Math.random(),
            delay: p.delay,
            ease: 'easeIn',
          }}
          className="absolute rounded-sm"
          style={{
            width: p.size,
            height: p.size * 0.6,
            backgroundColor: p.color,
          }}
        />
      ))}
    </div>
  );
}

export function OnboardingScreen({ onGetStarted }: Props) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [grade, setGrade] = useState('');
  const [school, setSchool] = useState('');
  const [direction, setDirection] = useState(1);
  const [showConfetti, setShowConfetti] = useState(false);
  const [gradeDropdownOpen, setGradeDropdownOpen] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const schoolInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Auto-focus inputs
  useEffect(() => {
    if (step === 1) {
      setTimeout(() => nameInputRef.current?.focus(), 400);
    }
    if (step === 3) {
      setTimeout(() => schoolInputRef.current?.focus(), 400);
    }
  }, [step]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setGradeDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const goNext = () => {
    setDirection(1);
    if (step === 3) {
      setShowConfetti(true);
      setTimeout(() => {
        onGetStarted({ name: name.trim(), grade, school: school.trim() });
      }, 1200);
    } else {
      setStep((s) => s + 1);
    }
  };

  const goBack = () => {
    setDirection(-1);
    setStep((s) => Math.max(0, s - 1));
  };

  const canProceed = () => {
    if (step === 0) return true;
    if (step === 1) return name.trim().length > 0;
    if (step === 2) return grade.length > 0;
    if (step === 3) return school.trim().length > 0;
    return false;
  };

  // Smart school suggestions that don't duplicate suffixes
  const getSchoolSuggestions = () => {
    const trimmed = school.trim();
    if (trimmed.length < 2) return [];

    const lowerInput = trimmed.toLowerCase();
    const suffixes = ['high school', 'academy', 'preparatory', 'prep', 'school', 'university', 'college', 'institute', 'middle'];
    const hasSuffix = suffixes.some((s) => lowerInput.includes(s));

    if (hasSuffix) {
      return [];
    }

    return [
      `${trimmed} High School`,
      `${trimmed} Academy`,
      `${trimmed} Preparatory School`,
    ];
  };

  const stepVariants = {
    enter: (d: number) => ({
      x: d > 0 ? 80 : -80,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (d: number) => ({
      x: d > 0 ? -80 : 80,
      opacity: 0,
    }),
  };

  const getStepTitle = () => {
    switch (step) {
      case 0: return "Let's Go";
      case 1: return 'Continue';
      case 2: return 'Continue';
      case 3: return showConfetti ? 'Welcome!' : 'Join Citadel';
      default: return 'Continue';
    }
  };

  return (
    <div className="h-full w-full flex flex-col bg-white relative">
      <Confetti show={showConfetti} />

      {/* Top bar with logo and progress */}
      <div className="px-7 pt-14 pb-3 z-10 shrink-0">
        <div className="flex items-center justify-between">
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="flex items-center gap-2.5"
          >
            {step > 0 && (
              <motion.button
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                onClick={goBack}
                className="w-9 h-9 rounded-full bg-bg-secondary flex items-center justify-center mr-1 active:scale-95 transition-transform"
              >
                <ArrowLeft className="w-4 h-4 text-text-primary" />
              </motion.button>
            )}
            <Shield className="w-7 h-7 text-maroon" strokeWidth={1.5} />
            <span className="font-display text-lg font-semibold text-maroon">Citadel</span>
          </motion.div>

          {/* Progress indicator */}
          {step > 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-2 bg-bg-secondary rounded-full px-3 py-1.5"
            >
              <span className="text-xs font-body font-semibold text-maroon">{step}/3</span>
              <div className="flex items-center gap-1">
                {[1, 2, 3].map((s) => (
                  <motion.div
                    key={s}
                    initial={false}
                    animate={{
                      width: s <= step ? 16 : 6,
                      backgroundColor: s <= step ? '#3D0C11' : '#E5E5E5',
                    }}
                    transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                    className="h-1.5 rounded-full"
                  />
                ))}
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 relative overflow-hidden min-h-0">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={step}
            custom={direction}
            variants={stepVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: 'tween', duration: 0.3, ease: 'easeInOut' }}
            className="absolute inset-0 flex flex-col overflow-y-auto hide-scrollbar"
          >
            {/* ==================== Step 0: Welcome / Intro ==================== */}
            {step === 0 && (
              <div className="px-7 pb-8 flex flex-col">
                <div className="mt-6">
                  {/* Shield icon instead of emoji */}
                  <motion.div
                    initial={{ scale: 0, rotate: -20 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: 'spring', stiffness: 200, damping: 12, delay: 0.2 }}
                    className="w-16 h-16 rounded-2xl bg-maroon/10 flex items-center justify-center mb-5"
                  >
                    <Shield className="w-8 h-8 text-maroon" strokeWidth={1.5} />
                  </motion.div>

                  <motion.h1
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="font-display text-[2.6rem] leading-[1.1] font-bold text-text-primary"
                  >
                    Master your{' '}
                    <span className="relative inline-block">
                      courses
                      <motion.div
                        initial={{ scaleX: 0 }}
                        animate={{ scaleX: 1 }}
                        transition={{ delay: 0.8, duration: 0.4 }}
                        className="absolute -bottom-1 left-0 right-0 h-[3px] bg-maroon rounded-full origin-left"
                      />
                    </span>
                    .
                  </motion.h1>

                  <motion.p
                    initial={{ y: 15, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="font-body text-text-secondary text-[15px] mt-4 leading-relaxed"
                  >
                    Your fortress for organized notes, seamless collaboration, and crushing every exam.
                  </motion.p>
                </div>

                <div className="flex flex-col gap-3.5 mt-10">
                  {[
                    {
                      icon: BookOpen,
                      title: 'Smart Notes',
                      desc: 'Scan, organize & find anything instantly',
                      color: 'bg-amber-50',
                      iconColor: 'text-amber-600',
                    },
                    {
                      icon: Users,
                      title: 'Study Together',
                      desc: 'Share notes & call classmates in real-time',
                      color: 'bg-blue-50',
                      iconColor: 'text-blue-600',
                    },
                    {
                      icon: Award,
                      title: 'Crush Your Exams',
                      desc: 'Track progress & never miss a deadline',
                      color: 'bg-green-50',
                      iconColor: 'text-green-600',
                    },
                  ].map((item, i) => (
                    <motion.div
                      key={item.title}
                      initial={{ x: -30, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      transition={{ delay: 0.6 + i * 0.15, type: 'spring', stiffness: 150 }}
                      className="flex items-center gap-4 bg-white rounded-2xl p-4 border border-gray-100 shadow-sm"
                    >
                      <div className={`w-12 h-12 rounded-xl ${item.color} flex items-center justify-center shrink-0`}>
                        <item.icon className={`w-5 h-5 ${item.iconColor}`} strokeWidth={1.8} />
                      </div>
                      <div className="flex-1">
                        <p className="font-body font-semibold text-text-primary text-sm">{item.title}</p>
                        <p className="font-body text-text-secondary text-xs mt-0.5">{item.desc}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>

                {/* Social proof */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1.2 }}
                  className="mt-8 flex items-center justify-center gap-2.5"
                >
                  <div className="flex -space-x-2">
                    {[
                      { bg: '#DBEAFE', fill: '#3B82F6' },
                      { bg: '#FCE7F3', fill: '#EC4899' },
                      { bg: '#D1FAE5', fill: '#10B981' },
                      { bg: '#FEF3C7', fill: '#F59E0B' },
                    ].map((c, i) => (
                      <div
                        key={i}
                        className="w-7 h-7 rounded-full border-2 border-white flex items-center justify-center"
                        style={{ backgroundColor: c.bg }}
                      >
                        <User className="w-3.5 h-3.5" style={{ color: c.fill }} strokeWidth={1.5} />
                      </div>
                    ))}
                  </div>
                  <p className="font-body text-xs text-text-tertiary">
                    Join your classmates on Citadel
                  </p>
                </motion.div>
              </div>
            )}

            {/* ==================== Step 1: Name ==================== */}
            {step === 1 && (
              <div className="px-7 pb-8 flex flex-col">
                <div className="mt-6">
                  <motion.div
                    initial={{ scale: 0, rotate: -20 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: 'spring', stiffness: 200, damping: 12 }}
                    className="w-16 h-16 rounded-2xl bg-maroon/10 flex items-center justify-center mb-5"
                  >
                    <Sparkles className="w-8 h-8 text-maroon" strokeWidth={1.5} />
                  </motion.div>

                  <h1 className="font-display text-[2.2rem] leading-tight font-bold text-text-primary">
                    What should we call you?
                  </h1>
                  <p className="font-body text-text-secondary text-[15px] mt-3 leading-relaxed">
                    We'll personalize everything just for you.
                  </p>
                </div>

                <div className="mt-8">
                  <label className="font-body text-xs font-semibold text-text-secondary tracking-wide uppercase mb-2.5 block flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3 text-maroon" />
                    Your First Name
                  </label>
                  <div className="relative">
                    <input
                      ref={nameInputRef}
                      type="text"
                      placeholder="Type your name..."
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && canProceed() && goNext()}
                      className="w-full h-[60px] px-6 bg-input-bg rounded-2xl font-body text-[17px] text-text-primary placeholder:text-text-tertiary outline-none focus:ring-2 focus:ring-maroon/20 transition-all"
                    />
                    {name.trim().length > 0 && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute right-4 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-green-100 flex items-center justify-center"
                      >
                        <Check className="w-3.5 h-3.5 text-green-600" />
                      </motion.div>
                    )}
                  </div>

                  {/* Greeting without "Great Name" */}
                  <AnimatePresence>
                    {name.trim().length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: 8, height: 0 }}
                        animate={{ opacity: 1, y: 0, height: 'auto' }}
                        exit={{ opacity: 0, y: -5, height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="mt-4 bg-maroon/5 rounded-2xl p-4 flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-maroon flex items-center justify-center text-white font-display font-bold text-lg">
                            {name.trim().charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-body text-sm font-semibold text-text-primary">
                              Hey {name.trim()}!
                            </p>
                            <p className="font-body text-xs text-text-secondary mt-0.5">
                              Let's set up your fortress.
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Benefits when empty */}
                  {!name.trim() && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.5 }}
                      className="mt-6 flex flex-col gap-3"
                    >
                      {[
                        { icon: Star, text: 'Personalized study plans', color: 'text-amber-500' },
                        { icon: Users, text: 'Connect with your classmates', color: 'text-blue-500' },
                        { icon: Award, text: 'Custom achievement badges', color: 'text-green-500' },
                      ].map((item, i) => (
                        <motion.div
                          key={i}
                          initial={{ x: -10, opacity: 0 }}
                          animate={{ x: 0, opacity: 1 }}
                          transition={{ delay: 0.6 + i * 0.1 }}
                          className="flex items-center gap-3 text-xs text-text-secondary font-body"
                        >
                          <div className="w-8 h-8 rounded-lg bg-bg-secondary flex items-center justify-center shrink-0">
                            <item.icon className={`w-4 h-4 ${item.color}`} />
                          </div>
                          {item.text}
                        </motion.div>
                      ))}
                    </motion.div>
                  )}
                </div>
              </div>
            )}

            {/* ==================== Step 2: Grade (Dropdown) ==================== */}
            {step === 2 && (
              <div className="px-7 pb-8 flex flex-col">
                <div className="mt-6">
                  <motion.div
                    initial={{ scale: 0, rotate: -20 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: 'spring', stiffness: 200, damping: 12 }}
                    className="w-16 h-16 rounded-2xl bg-maroon/10 flex items-center justify-center mb-5"
                  >
                    <BookOpen className="w-8 h-8 text-maroon" strokeWidth={1.5} />
                  </motion.div>

                  <h1 className="font-display text-[2.2rem] leading-tight font-bold text-text-primary">
                    What grade are you in{name.trim() ? `, ${name.trim()}` : ''}?
                  </h1>
                  <p className="font-body text-text-secondary text-[15px] mt-3 leading-relaxed">
                    We'll tailor content to your level.
                  </p>
                </div>

                <div className="mt-8" ref={dropdownRef}>
                  <label className="font-body text-xs font-semibold text-text-secondary tracking-wide uppercase mb-2.5 block flex items-center gap-1.5">
                    <School className="w-3 h-3 text-maroon" />
                    Your Grade
                  </label>

                  {/* Dropdown trigger */}
                  <button
                    onClick={() => setGradeDropdownOpen(!gradeDropdownOpen)}
                    className={`w-full h-[60px] px-6 rounded-2xl font-body text-[17px] text-left flex items-center justify-between transition-all ${
                      grade
                        ? 'bg-input-bg text-text-primary'
                        : 'bg-input-bg text-text-tertiary'
                    } ${gradeDropdownOpen ? 'ring-2 ring-maroon/20' : ''}`}
                  >
                    <span>{grade || 'Select your grade...'}</span>
                    <div className="flex items-center gap-2">
                      {grade && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center"
                        >
                          <Check className="w-3.5 h-3.5 text-green-600" />
                        </motion.div>
                      )}
                      <motion.div
                        animate={{ rotate: gradeDropdownOpen ? 180 : 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <ChevronDown className="w-5 h-5 text-text-tertiary" />
                      </motion.div>
                    </div>
                  </button>

                  {/* Dropdown list */}
                  <AnimatePresence>
                    {gradeDropdownOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: -8, height: 0 }}
                        animate={{ opacity: 1, y: 0, height: 'auto' }}
                        exit={{ opacity: 0, y: -8, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="mt-2 bg-white rounded-2xl border border-gray-100 shadow-lg shadow-black/8 max-h-[280px] overflow-y-auto hide-scrollbar">
                          {grades.map((g, i) => {
                            const isSelected = grade === g.label;
                            return (
                              <button
                                key={g.label}
                                onClick={() => {
                                  setGrade(g.label);
                                  setGradeDropdownOpen(false);
                                }}
                                className={`w-full flex items-center justify-between px-5 py-3.5 transition-colors border-b border-gray-50 last:border-b-0 ${
                                  isSelected
                                    ? 'bg-maroon/5'
                                    : 'hover:bg-bg-secondary active:bg-gray-100'
                                }`}
                              >
                                <div className="flex items-center gap-3">
                                  <motion.div
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ delay: i * 0.02 }}
                                    className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-body font-bold ${
                                      isSelected
                                        ? 'bg-maroon text-white'
                                        : 'bg-bg-secondary text-text-secondary'
                                    }`}
                                  >
                                    {g.label.startsWith('College') || g.label.startsWith('Graduate')
                                      ? g.label.charAt(0)
                                      : g.label.match(/\d+/)?.[0] || 'G'}
                                  </motion.div>
                                  <div className="text-left">
                                    <span className={`font-body text-sm ${isSelected ? 'font-semibold text-maroon' : 'text-text-primary'}`}>
                                      {g.label}
                                    </span>
                                    {g.short && (
                                      <span className="font-body text-xs text-text-tertiary ml-2">
                                        ({g.short})
                                      </span>
                                    )}
                                  </div>
                                </div>
                                {isSelected && (
                                  <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                  >
                                    <Check className="w-4 h-4 text-maroon" />
                                  </motion.div>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Selected grade card */}
                  <AnimatePresence>
                    {grade && !gradeDropdownOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        className="mt-5 bg-maroon/5 rounded-2xl p-4 flex items-center gap-3"
                      >
                        <div className="w-10 h-10 rounded-xl bg-maroon flex items-center justify-center text-white font-display font-bold text-lg">
                          {grade.startsWith('College') || grade.startsWith('Graduate')
                            ? grade.charAt(0)
                            : grade.match(/\d+/)?.[0] || 'G'}
                        </div>
                        <div>
                          <p className="font-body text-sm font-semibold text-text-primary">
                            {grade}
                          </p>
                          <p className="font-body text-xs text-text-secondary mt-0.5">
                            Content tailored for your level
                          </p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            )}

            {/* ==================== Step 3: School ==================== */}
            {step === 3 && (
              <div className="px-7 pb-8 flex flex-col">
                <div className="mt-6">
                  <motion.div
                    initial={{ scale: 0, rotate: -20 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: 'spring', stiffness: 200, damping: 12 }}
                    className="w-16 h-16 rounded-2xl bg-maroon/10 flex items-center justify-center mb-5"
                  >
                    <School className="w-8 h-8 text-maroon" strokeWidth={1.5} />
                  </motion.div>

                  <h1 className="font-display text-[2.2rem] leading-tight font-bold text-text-primary">
                    Where do you go to school?
                  </h1>
                  <p className="font-body text-text-secondary text-[15px] mt-3 leading-relaxed">
                    Find classmates and build your study crew.
                  </p>
                </div>

                <div className="mt-8">
                  <label className="font-body text-xs font-semibold text-text-secondary tracking-wide uppercase mb-2.5 block flex items-center gap-1.5">
                    <School className="w-3 h-3 text-maroon" />
                    School Name
                  </label>
                  <div className="relative">
                    <input
                      ref={schoolInputRef}
                      type="text"
                      placeholder="e.g. Academies of Loudoun"
                      value={school}
                      onChange={(e) => setSchool(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && canProceed() && goNext()}
                      className="w-full h-[60px] px-6 bg-input-bg rounded-2xl font-body text-[17px] text-text-primary placeholder:text-text-tertiary outline-none focus:ring-2 focus:ring-maroon/20 transition-all"
                    />
                    {school.trim().length > 0 && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute right-4 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-green-100 flex items-center justify-center"
                      >
                        <Check className="w-3.5 h-3.5 text-green-600" />
                      </motion.div>
                    )}
                  </div>

                  {/* Smart suggestions */}
                  <AnimatePresence>
                    {getSchoolSuggestions().length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: 5, height: 0 }}
                        animate={{ opacity: 1, y: 0, height: 'auto' }}
                        exit={{ opacity: 0, y: -5, height: 0 }}
                        className="mt-3 bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm"
                      >
                        {getSchoolSuggestions().map((suggestion, i) => (
                          <motion.button
                            key={i}
                            initial={{ x: -10, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            transition={{ delay: i * 0.05 }}
                            onClick={() => setSchool(suggestion)}
                            className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-bg-secondary transition-colors border-b border-gray-50 last:border-b-0 active:bg-gray-100"
                          >
                            <div className="w-8 h-8 rounded-lg bg-bg-secondary flex items-center justify-center shrink-0">
                              <School className="w-4 h-4 text-text-tertiary" />
                            </div>
                            <span className="font-body text-sm text-text-primary text-left flex-1">
                              {suggestion}
                            </span>
                            <ArrowRight className="w-3.5 h-3.5 text-text-tertiary" />
                          </motion.button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Summary card */}
                  <AnimatePresence>
                    {school.trim().length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ delay: 0.1 }}
                        className="mt-4 bg-gradient-to-r from-maroon/5 to-maroon/10 rounded-2xl p-4"
                      >
                        <p className="font-body text-xs text-text-secondary mb-3 flex items-center gap-1.5">
                          <Star className="w-3 h-3 text-maroon" />
                          Your Student Profile
                        </p>
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 rounded-xl bg-maroon flex items-center justify-center text-white font-display font-bold text-lg">
                            {(name.trim() || 'M').charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1">
                            <p className="font-body text-sm font-semibold text-text-primary">
                              {name.trim() || 'Student'}
                            </p>
                            <p className="font-body text-xs text-text-secondary mt-0.5">
                              {grade} · {school.trim()}
                            </p>
                          </div>
                          <motion.div
                            animate={{ scale: [1, 1.1, 1] }}
                            transition={{ duration: 1.5, repeat: Infinity }}
                          >
                            <Heart className="w-4 h-4 text-maroon" />
                          </motion.div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom action area */}
      <div className="px-7 pb-10 pt-3 z-10 shrink-0">
        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="flex flex-col gap-3"
        >
          <motion.button
            onClick={goNext}
            disabled={!canProceed()}
            whileTap={{ scale: 0.97 }}
            className={`w-full h-14 font-body font-semibold text-base rounded-full flex items-center justify-center gap-2.5 transition-all duration-300 ${
              canProceed()
                ? 'bg-maroon text-white shadow-lg shadow-maroon/25'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            <span>{getStepTitle()}</span>
            {step === 3 ? (
              <Shield className="w-4.5 h-4.5" strokeWidth={1.5} />
            ) : (
              <ArrowRight className="w-4.5 h-4.5" />
            )}
          </motion.button>

          {step === 0 && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1 }}
              className="text-center text-text-tertiary text-xs font-body"
            >
              Already have an account?{' '}
              <button
                onClick={() =>
                  onGetStarted({
                    name: '',
                    grade: '',
                    school: '',
                  })
                }
                className="text-maroon font-semibold underline"
              >
                Sign In
              </button>
            </motion.p>
          )}

          {step === 1 && (
            <button
              onClick={() => {
                setName('');
                goNext();
              }}
              className="text-center text-text-tertiary text-xs font-body py-1 hover:text-text-secondary transition-colors"
            >
              Skip for now
            </button>
          )}
        </motion.div>
      </div>
    </div>
  );
}
