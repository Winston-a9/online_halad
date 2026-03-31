# ✝ Church Offering System — Deployment Guide

## Architecture
```
GitHub Pages (Frontend)  ──►  Firebase Cloud Functions (API)  ──►  Firestore (Database)
index.html / styles.css / app.js    functions/index.js              offerings collection
```

---

## Step 1 — Firebase Setup

### 1a. Install Firebase CLI
```bash
npm install -g firebase-tools
firebase login
```

### 1b. Initialize Firebase in this project folder
```bash
firebase use --add
# Select your project: online-halad
# Give it alias: default
```

### 1c. Install function dependencies
```bash
cd functions
npm install
cd ..
```

### 1d. Deploy Firestore rules + indexes + Cloud Functions
```bash
firebase deploy
```

After deploying, copy your function URL — it looks like:
```
https://asia-southeast1-online-halad.cloudfunctions.net/api
```

---

## Step 2 — Update Frontend API URL

Open `public/app.js` and update line 10:
```js
const API_BASE = 'https://asia-southeast1-online-halad.cloudfunctions.net/api';
```
(Replace with your actual URL if it differs.)

---

## Step 3 — GitHub Pages Setup

### 3a. Create a GitHub repository
```bash
git init
git add .
git commit -m "Initial commit — Church Offering System"
git remote add origin https://github.com/YOUR_USERNAME/church-offering.git
git push -u origin main
```

### 3b. Enable GitHub Pages
1. Go to your repo on GitHub
2. **Settings → Pages**
3. Under **Source**, select **GitHub Actions**
4. Push any change to `main` — the workflow deploys automatically

Your site will be live at:
```
https://YOUR_USERNAME.github.io/church-offering/
```

---

## Project Structure
```
church-offering/
├── public/                  ← GitHub Pages (frontend)
│   ├── index.html
│   ├── styles.css
│   └── app.js
├── functions/               ← Firebase Cloud Functions (backend)
│   ├── index.js
│   └── package.json
├── .github/
│   └── workflows/
│       └── deploy.yml       ← Auto-deploy to GitHub Pages on push
├── firebase.json
├── firestore.rules
├── firestore.indexes.json
└── README.md
```

---

## Local Development (optional)
```bash
# Start Firebase emulators (functions + firestore)
firebase emulators:start

# In public/app.js, temporarily change API_BASE to:
const API_BASE = 'http://localhost:5001/online-halad/asia-southeast1/api';

# Open public/index.html in your browser (use Live Server or similar)
```

---

## Updating the app
- **Frontend changes** → edit files in `public/`, push to `main` → GitHub Actions auto-deploys
- **Backend changes** → edit `functions/index.js`, run `firebase deploy --only functions`
