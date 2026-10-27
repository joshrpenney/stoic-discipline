# STOIC — Discipline Journal

A mobile-first React + Vite app using Firebase Authentication and Cloud Firestore. This is a separate project; do not reuse Hollie Tracker's Firebase project or credentials.

## 1. Create a GitHub repository

1. Sign in at https://github.com/new
2. Repository name: `stoic-discipline`
3. Choose **Public** if you want to publish it with GitHub Pages, or **Private** if you prefer. Note: GitHub Pages availability for private repositories depends on your plan.
4. Tick **Add a README file**.
5. Create the repository, then upload the files in this starter folder (including the `src` folder) to the repository root. Do not upload `.env.local`.

## 2. Create a NEW Firebase project

1. Go to https://console.firebase.google.com/
2. Create a project named `stoic-discipline` (or a unique variant).
3. In Project settings → General, add a Web app and copy its Firebase config.
4. In Build → Authentication → Get started → Sign-in method, enable **Email/Password**.
5. In Build → Firestore Database, create a database. Choose a region appropriate for your users; region choice is difficult to change later.
6. Open Firestore → Rules, paste the contents of `firestore.rules`, and publish them.
7. Keep the project in test/development until you have tested sign-up, sign-in, data ownership and rules. The included rules deny access to all data outside a user's own `/users/{uid}` tree.

## 3. Add Firebase configuration

1. Copy `.env.example` to `.env.local`.
2. Fill each value using the Web app config from your new Firebase project.
3. Never add service-account JSON, private keys, passwords, or `.env.local` to GitHub.
4. Firebase web config is not a server secret, but Firestore rules and Authentication settings are essential security controls.

## 4. Run on a computer

Install Node.js LTS from https://nodejs.org/

In the project folder, run:

```bash
npm install
npm run dev
```

Open the local address Vite prints. For a production build:

```bash
npm run build
```

## 5. Publish the web app

GitHub Pages can host the frontend, but the deployment must build the Vite project and publish the generated `dist` folder. Configure GitHub Pages with a GitHub Actions workflow suitable for Vite, and set the correct Vite `base` path if deploying to a project URL such as `https://USERNAME.github.io/stoic-discipline/`.

For a simpler first deployment, Firebase Hosting is also a good fit for a Vite app and supports a custom domain. Either hosting choice uses the same separate Firebase Auth and Firestore project.

## 6. Install on Android

Open the deployed HTTPS address in Chrome on Android → browser menu (⋮) → **Add to Home screen** or **Install app** when available. The manifest is included. A production-ready PWA should also include generated 192px and 512px icons and a service worker before claiming offline support.

## Current foundation

- Email/password account creation and sign-in
- User-specific Firestore paths and rules
- Realtime saved habit list and today's completion record
- Create and archive habits
- Starter commitments for a new account
- Mobile-first dark charcoal / muted gold design

## Important next improvements

- Password reset and email verification
- Historical streak calculation from saved daily logs (the current streak display is explicitly a placeholder)
- Tests, loading/error polish and robust first-account seeding
- PWA icons and service worker
- Training, reading deadlines, and Stoic journal modules
- Review Firebase security rules against every data shape before wider use
