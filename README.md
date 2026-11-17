# Calorie Planner

A standalone, client-side weekly calorie distribution planner and Dirichlet distribution explorer.

## GitHub Pages

This repository is configured for a root-level GitHub Pages site. Enable Pages in **Settings → Pages** and select **Deploy from a branch → main → /(root)**.

## AdSense setup

A responsive, non-sticky ad placement is included at the bottom of the app. It stays hidden until both AdSense identifiers are configured.

1. In AdSense, add and verify your published GitHub Pages site.
2. Create a responsive display ad unit and copy its publisher ID (`ca-pub-...`) and ad slot ID.
3. In `index.html`, set:
   - `ADSENSE_PUBLISHER_ID`
   - `ADSENSE_SLOT_ID`
4. Commit the changes and wait for AdSense approval / ad serving.

The app intentionally does not contain placeholder publisher or slot IDs. Ads will not load until real IDs are supplied. Add the publisher's authorized seller record to `ads.txt` if AdSense instructs you to do so.
