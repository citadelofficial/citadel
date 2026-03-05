import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Shield, User, Camera, X, Eye, EyeOff } from 'lucide-react';

interface Props {
  onSignIn: (profilePicture: string | null, displayName?: string) => void;
  onBack: () => void;
  userName?: string;
}

export function SignInScreen({ onSignIn, onBack, userName }: Props) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signup');
  const [profilePicture, setProfilePicture] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [displayName, setDisplayName] = useState(userName || '');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfilePicture(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removePhoto = () => {
    setProfilePicture(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="h-full w-full flex flex-col bg-white">
      <div className="flex-1 overflow-y-auto hide-scrollbar px-8 pt-14 pb-8">
        {/* Back button */}
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          onClick={onBack}
          className="w-10 h-10 rounded-full bg-bg-secondary flex items-center justify-center mb-5"
        >
          <ArrowLeft className="w-5 h-5 text-text-primary" />
        </motion.button>

        {/* Logo */}
        <motion.div
          initial={{ y: -10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="flex items-center gap-2 mb-6"
        >
          <Shield className="w-6 h-6 text-maroon" strokeWidth={1.5} />
          <span className="font-display text-lg font-semibold text-maroon">Citadel</span>
        </motion.div>

        {/* Toggle Sign In / Sign Up */}
        <motion.div
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="flex items-center gap-1 bg-bg-secondary rounded-full p-1 mb-6"
        >
          <button
            onClick={() => setMode('signup')}
            className={`flex-1 py-2.5 rounded-full font-body text-sm font-semibold transition-all duration-300 ${
              mode === 'signup'
                ? 'bg-maroon text-white shadow-md shadow-maroon/20'
                : 'text-text-secondary'
            }`}
          >
            Sign Up
          </button>
          <button
            onClick={() => setMode('signin')}
            className={`flex-1 py-2.5 rounded-full font-body text-sm font-semibold transition-all duration-300 ${
              mode === 'signin'
                ? 'bg-maroon text-white shadow-md shadow-maroon/20'
                : 'text-text-secondary'
            }`}
          >
            Sign In
          </button>
        </motion.div>

        <AnimatePresence mode="wait">
          <motion.div
            key={mode}
            initial={{ opacity: 0, x: mode === 'signup' ? -30 : 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: mode === 'signup' ? 30 : -30 }}
            transition={{ duration: 0.25 }}
          >
            {/* Heading */}
            <h1 className="font-display text-[1.7rem] font-bold text-text-primary leading-tight">
              {mode === 'signup'
                ? `Create your account${userName ? `, ${userName}` : ''}`
                : `Welcome back${userName ? `, ${userName}` : ''}`}
            </h1>
            <p className="font-body text-text-secondary text-sm mt-1.5 mb-6">
              {mode === 'signup'
                ? 'Set up your profile to get started'
                : 'Sign in to continue your studies'}
            </p>

            {/* Profile Picture Upload (Sign Up only) */}
            {mode === 'signup' && (
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1 }}
                className="flex flex-col items-center mb-7"
              >
                <div className="relative">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-24 h-24 rounded-full overflow-hidden border-[3px] border-dashed border-maroon/25 flex items-center justify-center bg-bg-secondary transition-all hover:border-maroon/50 group"
                  >
                    {profilePicture ? (
                      <img
                        src={profilePicture}
                        alt="Profile"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center">
                        <User className="w-10 h-10 text-text-tertiary/60 group-hover:text-maroon/50 transition-colors" strokeWidth={1.2} />
                      </div>
                    )}
                  </button>

                  {/* Camera badge */}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-maroon flex items-center justify-center shadow-lg shadow-maroon/30 border-2 border-white"
                  >
                    <Camera className="w-3.5 h-3.5 text-white" />
                  </button>

                  {/* Remove photo */}
                  {profilePicture && (
                    <motion.button
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      onClick={removePhoto}
                      className="absolute -top-1 -right-1 w-7 h-7 rounded-full bg-red-500 flex items-center justify-center shadow-md border-2 border-white"
                    >
                      <X className="w-3.5 h-3.5 text-white" />
                    </motion.button>
                  )}
                </div>

                <p className="font-body text-xs text-text-tertiary mt-3">
                  {profilePicture ? 'Tap to change photo' : 'Upload a profile picture'}
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </motion.div>
            )}

            {/* Form fields */}
            <div className="flex flex-col gap-3.5">
              {mode === 'signup' && (
                <div>
                  <label className="font-body text-xs font-medium text-text-secondary mb-1.5 block">
                    Full Name
                  </label>
                  <input
                    type="text"
                    placeholder="Your name"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full h-[52px] px-5 bg-input-bg rounded-2xl font-body text-sm text-text-primary placeholder:text-text-tertiary outline-none focus:ring-2 focus:ring-maroon/20 transition-shadow"
                  />
                </div>
              )}

              <div>
                <label className="font-body text-xs font-medium text-text-secondary mb-1.5 block">
                  Email
                </label>
                <input
                  type="email"
                  placeholder="School Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-[52px] px-5 bg-input-bg rounded-2xl font-body text-sm text-text-primary placeholder:text-text-tertiary outline-none focus:ring-2 focus:ring-maroon/20 transition-shadow"
                />
              </div>

              <div>
                <label className="font-body text-xs font-medium text-text-secondary mb-1.5 block">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full h-[52px] px-5 pr-12 bg-input-bg rounded-2xl font-body text-sm text-text-primary placeholder:text-text-tertiary outline-none focus:ring-2 focus:ring-maroon/20 transition-shadow"
                  />
                  <button
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4.5 h-4.5 text-text-tertiary" />
                    ) : (
                      <Eye className="w-4.5 h-4.5 text-text-tertiary" />
                    )}
                  </button>
                </div>
              </div>

              {mode === 'signup' && (
                <div>
                  <label className="font-body text-xs font-medium text-text-secondary mb-1.5 block">
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    placeholder="Confirm Password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full h-[52px] px-5 bg-input-bg rounded-2xl font-body text-sm text-text-primary placeholder:text-text-tertiary outline-none focus:ring-2 focus:ring-maroon/20 transition-shadow"
                  />
                </div>
              )}

              {mode === 'signin' && (
                <button className="self-end font-body text-xs text-maroon font-medium mt-0.5">
                  Forgot Password?
                </button>
              )}
            </div>

            {/* Action button */}
            <button
              onClick={() => onSignIn(profilePicture, mode === 'signup' ? displayName.trim() : undefined)}
              className="w-full h-14 bg-maroon text-white font-body font-semibold text-base rounded-full mt-5 active:scale-[0.98] transition-transform shadow-lg shadow-maroon/25"
            >
              {mode === 'signup' ? 'Create Account' : 'Sign In'}
            </button>

            {/* Divider */}
            <div className="flex items-center gap-4 my-4">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="font-body text-xs text-text-tertiary">or</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>

            {/* Social login */}
            <button className="w-full h-13 bg-text-primary text-white font-body font-semibold text-sm rounded-full flex items-center justify-center gap-3 active:scale-[0.98] transition-transform">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
              </svg>
              Continue with Apple
            </button>

            <button className="w-full h-13 bg-white text-text-primary font-body font-semibold text-sm rounded-full flex items-center justify-center gap-3 active:scale-[0.98] transition-transform border border-gray-200 mt-2.5">
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Continue with Google
            </button>

            {/* Toggle mode text */}
            <p className="text-center text-text-tertiary text-xs font-body mt-5 pb-4">
              {mode === 'signup' ? (
                <>
                  Already have an account?{' '}
                  <button
                    onClick={() => setMode('signin')}
                    className="text-maroon font-semibold underline"
                  >
                    Sign In
                  </button>
                </>
              ) : (
                <>
                  Don&apos;t have an account?{' '}
                  <button
                    onClick={() => setMode('signup')}
                    className="text-maroon font-semibold underline"
                  >
                    Sign Up
                  </button>
                </>
              )}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
