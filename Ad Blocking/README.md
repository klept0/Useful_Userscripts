# SponsorBlock + Ad Skipper Enhanced Userscript

This is a lightweight yet powerful userscript that automatically skips:

- ✅ YouTube **sponsor segments** (via the [SponsorBlock API](https://sponsor.ajay.app))
- ✅ YouTube's **video ads** (pre-roll, mid-roll)
- ✅ Multiple segment types (intro, outro, self-promo, etc.)

## 🔧 Features

- **Real-time segment skipping** using official SponsorBlock API
- **Ad skipping** based on DOM detection (`ad-showing` class)
- **Keyboard toggle** (Shift + S) to enable/disable skipping on the fly
- **Persistent toggle state** using `localStorage`
- **Clickable GUI** in bottom-right corner of the page
- Fully compatible with **YouTube's SPA navigation** (instant page loads)

## 📦 Installation

Install with a userscript manager like:

- [Tampermonkey (recommended)](https://tampermonkey.net/)
- Violentmonkey
- Greasemonkey

**Install URL:** [Paste script manually or host on your GreasyFork/GitHub]

## 🧠 Segment Categories Skipped

- `sponsor` – Sponsored content
- `intro` – Intro sequences
- `outro` – Outro sequences
- `interaction` – Prompts to like/subscribe/comment
- `selfpromo` – Channel promotion
- `music_offtopic` – Irrelevant music clips

You can easily add/remove these in the `categoriesToSkip` array in the script.

## ⌨️ Controls

- **Shift + S** → Toggle skipping (on/off)
- **Click GUI toggle box** in bottom-right corner to toggle skipping

## 💾 Persistent State

Your skipping preference is saved automatically using `localStorage`.

## ⚙️ Customization

Open the script and modify the following if needed:

```javascript
const categoriesToSkip = [
  "sponsor", "intro", "outro", "interaction", "selfpromo", "music_offtopic"
];
```

## 📜 Credits

- Original author: [74th](https://greasyfork.org/en/users/874399-74th)
- Based on: [Simple Sponsor Skipper](https://greasyfork.org/en/scripts/453320-simple-sponsor-skipper)
- Uses: [SponsorBlock API](https://sponsor.ajay.app/)
- Enhanced and maintained by: [klept0](https://klept0.com)

## 🛠️ Future Enhancements (Planned or Available on Request)

- Segment category toggle via GUI
- Tooltip previews of upcoming skips
- API response caching for performance
- Export/import skip preferences

## 📫 Feedback / Requests

Found a bug? Want new features? Contact via:

- [klept0.com/contact](https://klept0.com/contact)
