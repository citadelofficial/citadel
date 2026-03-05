import { motion } from 'framer-motion';

const particles = Array.from({ length: 20 }, (_, i) => ({
  id: i,
  x: Math.random() * 100,
  y: Math.random() * 100,
  size: Math.random() * 3 + 1,
  delay: Math.random() * 2,
  duration: Math.random() * 3 + 2,
}));

export function SplashScreen() {
  return (
    <div className="h-full w-full flex flex-col items-center justify-center bg-maroon relative overflow-hidden">
      {/* Animated radial glow */}
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1.5, opacity: 0.15 }}
        transition={{ duration: 2, ease: 'easeOut' }}
        className="absolute w-[300px] h-[300px] rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(255,255,255,0.4) 0%, transparent 70%)',
        }}
      />

      {/* Floating particles */}
      {particles.map((p) => (
        <motion.div
          key={p.id}
          initial={{ opacity: 0, y: 0 }}
          animate={{
            opacity: [0, 0.6, 0],
            y: [-20, -80],
            x: [0, (Math.random() - 0.5) * 40],
          }}
          transition={{
            duration: p.duration,
            delay: p.delay + 0.5,
            repeat: Infinity,
            ease: 'easeOut',
          }}
          className="absolute rounded-full bg-white"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
          }}
        />
      ))}

      {/* Animated rings */}
      <motion.div
        initial={{ scale: 0, opacity: 0.3 }}
        animate={{ scale: 3, opacity: 0 }}
        transition={{ duration: 2.5, delay: 0.3, ease: 'easeOut' }}
        className="absolute w-24 h-24 rounded-full border border-white/20"
      />
      <motion.div
        initial={{ scale: 0, opacity: 0.2 }}
        animate={{ scale: 4, opacity: 0 }}
        transition={{ duration: 3, delay: 0.6, ease: 'easeOut' }}
        className="absolute w-24 h-24 rounded-full border border-white/15"
      />

      {/* Main content */}
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        className="flex flex-col items-center gap-5 z-10"
      >
        {/* Shield icon - custom SVG for a more premium fortress look */}
        <motion.div
          initial={{ y: -10, rotateY: 90 }}
          animate={{ y: 0, rotateY: 0 }}
          transition={{ duration: 0.8, delay: 0.2, ease: 'easeOut' }}
          className="relative"
        >
          <motion.div
            animate={{ boxShadow: ['0 0 20px rgba(255,255,255,0.1)', '0 0 40px rgba(255,255,255,0.25)', '0 0 20px rgba(255,255,255,0.1)'] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            className="w-28 h-28 flex items-center justify-center"
          >
            <svg width="88" height="88" viewBox="0 0 88 88" fill="none" xmlns="http://www.w3.org/2000/svg">
              {/* Shield outline */}
              <motion.path
                d="M44 8L14 22V42C14 60.5 26.5 77.5 44 82C61.5 77.5 74 60.5 74 42V22L44 8Z"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 1.5, delay: 0.3, ease: 'easeInOut' }}
              />
              {/* Fortress towers */}
              <motion.g
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1, duration: 0.5 }}
              >
                {/* Left tower */}
                <rect x="28" y="34" width="8" height="20" rx="1" stroke="white" strokeWidth="1.5" fill="none" />
                <rect x="29" y="32" width="2" height="3" rx="0.5" fill="white" />
                <rect x="33" y="32" width="2" height="3" rx="0.5" fill="white" />
                {/* Center tower (taller) */}
                <rect x="40" y="28" width="8" height="26" rx="1" stroke="white" strokeWidth="1.5" fill="none" />
                <rect x="41" y="26" width="2" height="3" rx="0.5" fill="white" />
                <rect x="45" y="26" width="2" height="3" rx="0.5" fill="white" />
                {/* Right tower */}
                <rect x="52" y="34" width="8" height="20" rx="1" stroke="white" strokeWidth="1.5" fill="none" />
                <rect x="53" y="32" width="2" height="3" rx="0.5" fill="white" />
                <rect x="57" y="32" width="2" height="3" rx="0.5" fill="white" />
                {/* Wall connecting towers */}
                <line x1="36" y1="44" x2="40" y2="44" stroke="white" strokeWidth="1.5" />
                <line x1="48" y1="44" x2="52" y2="44" stroke="white" strokeWidth="1.5" />
                {/* Gate */}
                <path d="M42 54V48C42 46.9 42.9 46 44 46C45.1 46 46 46.9 46 48V54" stroke="white" strokeWidth="1.5" fill="none" />
              </motion.g>
            </svg>
          </motion.div>
        </motion.div>

        {/* App Name */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.6 }}
          className="flex flex-col items-center gap-2"
        >
          <h1 className="font-display text-white text-5xl font-bold tracking-wide">
            Citadel
          </h1>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: 60 }}
            transition={{ delay: 1, duration: 0.5 }}
            className="h-[1px] bg-white/30"
          />
        </motion.div>

        {/* Tagline */}
        <motion.p
          initial={{ y: 15, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.9, duration: 0.6 }}
          className="font-body text-white/70 text-[15px] tracking-[0.15em] uppercase font-light"
        >
          The Fortress for Your Learning
        </motion.p>
      </motion.div>

      {/* Bottom loading indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.4, duration: 0.8 }}
        className="absolute bottom-16 flex flex-col items-center gap-3 z-10"
      >
        <div className="flex items-center gap-1.5">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              animate={{
                scale: [1, 1.4, 1],
                opacity: [0.3, 1, 0.3],
              }}
              transition={{
                duration: 1,
                delay: i * 0.2,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
              className="w-2 h-2 rounded-full bg-white"
            />
          ))}
        </div>
      </motion.div>

      {/* Decorative bottom gradient */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black/10 to-transparent" />
    </div>
  );
}
