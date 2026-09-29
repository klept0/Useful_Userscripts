# SponsorBlock + Ad Skipper Enhanced Userscript

This is a lightweight yet powerful userscript that automatically skips:

- ✅ YouTube **sponsor segments** (via the [SponsorBlock API](https://sponsor.ajay.app))
- ✅ YouTube's **video ads** (pre-roll, mid-roll)
- ✅ Multiple segment types (intro, outro, self-promo, etc.)

## 🔧 Features

- **Real-time segment skipping** using official SponsorBlock API
- **Ad skipping** based on DOM detection (`ad-showing` class on the player), clicking **Skip** when offered
- **Per-category toggles** in a panel above the on/off button
- **Private lookups**: segments are fetched by a 4-character hash prefix of the video ID, so the SponsorBlock server never learns which video you're watching
- **API response caching** per video
- **Keyboard toggle** (Shift + S) to enable/disable skipping on the fly
- **Persistent settings** (on/off and categories) using `localStorage`
- **Clickable GUI** in bottom-right corner of the page
- Fully compatible with **YouTube's SPA navigation** (instant page loads)

## 📦 Installation

Install with a userscript manager like:

- [Tampermonkey (recommended)](https://tampermonkey.net/)
- Violentmonkey
- Greasemonkey

**Install URL:** [https://raw.githubusercontent.com/klept0/Useful_Userscripts/master/Ad%20Blocking/sponsorblock-ad-skipper.user.js](https://raw.githubusercontent.com/klept0/Useful_Userscripts/master/Ad%20Blocking/sponsorblock-ad-skipper.user.js)

Installing from this link enables automatic updates.

## 🧠 Segment Categories Skipped

- `sponsor` – Sponsored content
- `intro` – Intro sequences
- `outro` – Outro sequences
- `interaction` – Prompts to like/subscribe/comment
- `selfpromo` – Channel promotion
- `music_offtopic` – Irrelevant music clips

Each category can be switched on or off from the panel in the bottom-right corner. All are on by default.

## ⌨️ Controls

- **Shift + S** → Toggle skipping (on/off); ignored while typing in a text field
- **Click GUI toggle box** in bottom-right corner to toggle skipping
- **Click a category button** to include/exclude that category
- **Userscript manager menu → Show/hide on-screen controls** to hide both panels (skipping and Shift + S keep working; use the same menu entry to bring them back)

## 💾 Persistent State

Your on/off, category and show/hide preferences are saved automatically using `localStorage`.

## 📜 Credits

- Original author: [74th](https://greasyfork.org/en/users/874399-74th)
- Based on: [Simple Sponsor Skipper](https://greasyfork.org/en/scripts/453320-simple-sponsor-skipper)
- Uses: [SponsorBlock API](https://sponsor.ajay.app/)
- Enhanced and maintained by: [klept0](https://klept0.com)

## 🛠️ Future Enhancements (Planned or Available on Request)

- Tooltip previews of upcoming skips
- Export/import skip preferences

## 📫 Feedback / Requests

Found a bug? Want new features? Contact via:

- [klept0.com/contact](https://klept0.com/contact)
