# Limb Align — Project Context

## What this is
A React + Vite + Three.js web tool for orienting prosthetic limb scans. Users upload an STL/OBJ scan, auto-orient it along anatomical axes (PCA-based), correct the anterior direction, and export an oriented STL. Deployed on GitHub Pages.

## Live site
https://michaelposcente-creator.github.io/Limb_Align/

## GitHub repo
https://github.com/michaelposcente-creator/Limb_Align

## Key files
- `src/lib/meshAnalysis.js` — PCA-based limb orientation logic
- `src/lib/markerDetection.js` — detects the physical scan marker within an uploaded mesh; swap `MARKER_URL` or replace `detectMarkerInScan()` to update detection
- `src/lib/pca.js` — power-iteration PCA (only returns dominant axis; extend if full 3-axis decomposition needed)
- `src/lib/loaders.js` — loads STL/OBJ from File objects
- `src/components/Viewport3D.jsx` — Three.js scene; accepts `markerRegion` prop to show orange highlight
- `src/components/LeftPanel.jsx` — left sidebar: instructions modal, marker download, file upload, auto-orient controls
- `src/App.jsx` — top-level state and wiring

## Marker STL
Physical marker printed and attached to patient before scanning. Hosted at:
`https://raw.githubusercontent.com/michaelposcente-creator/Limb_Align/main/public/Marker.STL`
To swap the design: update `MARKER_URL` in `markerDetection.js` and upload new file to `public/`.

## Deployment
GitHub Actions workflow at `.github/workflows/deploy.yml` — auto-builds and deploys to GitHub Pages on every push to `main`. Source is `dist/` output of `vite build`.

## Intended workflow (full pipeline)
1. User downloads marker STL → prints → attaches to patient
2. Patient is scanned (scan includes marker)
3. User uploads scan → auto-orient detects marker + orients limb
4. User corrects anterior direction → exports oriented STL

## Tech stack
- React 18, Vite 5, Three.js 0.160
- No backend — fully client-side
- `base: '/Limb_Align/'` in vite.config.js (required for GitHub Pages subfolder)

## Git / deploy notes
- Auth via Personal Access Token (needs `repo` + `workflow` scopes)
- File paths on GitHub Pages are case-sensitive (Linux) — `Marker.STL` not `marker.stl`
