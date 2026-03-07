# Citadel (React Native)

A study and learning app built with **React Native** and **Expo**. Organize notes, collaborate with classmates, and track your courses.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npx expo start
   ```

3. Run on a device or simulator:
   - **iOS**: Press `i` in the terminal or scan the QR code with the Expo Go app
   - **Android**: Press `a` in the terminal or scan the QR code with the Expo Go app

## Project structure

- `App.tsx` – Root component and screen navigation state
- `src/screens/` – Screens: Splash, Onboarding, Sign In, Home, Course Detail, Files, Scan, Friends
- `src/components/` – Reusable components (e.g. BottomNav)
- `src/theme.ts` – Colors and spacing
- `src/types.ts` – Shared TypeScript types
- `src/data/` – Default class/course data

## Features

- **Onboarding** – Name, grade, and school setup
- **Sign In / Sign Up** – Profile photo (image picker), email/password
- **Home** – Class carousel, shortcuts, search, add/remove classes
- **Course Detail** – Units, sections, notes
- **Files** – Per-class file list and document preview
- **Scan** – Scan modes (notes, document, whiteboard), recent scans
- **Friends** – Tabs (Friends, Requests, Sessions, Discover), friend list

## Tech stack

- React Native + Expo SDK 52
- TypeScript
- React Navigation (optional; current app uses in-App state for navigation)
- Expo Image Picker (profile/photo)
- Expo Clipboard (for invite codes; used in Course Detail flow)
