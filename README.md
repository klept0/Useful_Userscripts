# Useful Userscripts

Small userscripts that fix annoyances and add missing features on sites I use. Each one installs with a single click and updates itself.

## Getting started

1. Install a userscript manager:
   - [Tampermonkey](https://www.tampermonkey.net/) (Chrome, Edge, Firefox, Safari)
   - [Violentmonkey](https://violentmonkey.github.io/) (Chrome, Edge, Firefox)
2. Click an **Install** link below. Your manager opens the script and asks you to confirm.

Scripts installed from these links update automatically when a new version is pushed here.

## Scripts

| Script | Site | Version | |
|--------|------|---------|---|
| [YouTube Cleaner Stable](#youtube-cleaner-stable) | YouTube | 3.3.0 | [Install][yt-cleaner] |
| [SponsorBlock + Ad Skipper Enhanced](#sponsorblock--ad-skipper-enhanced) | YouTube | 2.2.0 | [Install][sponsorblock] |
| [Reddit 503 Auto Refresh](#reddit-503-auto-refresh) | Reddit | 3 | [Install][reddit-503] |
| [Pegasus DL Firmware Filter](#pegasus-dl-firmware-filter) | Pegasus DL (PS5), Pegasus Catalog | 1.2.0 | [Install][pegasus] |
| [Amazon Links](#amazon-links) | Amazon | 2.0 | [Install][amazon] |
| [Bumble Enhanced](#bumble-enhanced) | Bumble | 2.6.5 | [Install][bumble] |

### Social media

#### YouTube Cleaner Stable

Configurable YouTube cleanup:

- Responsive grid with an adjustable maximum of videos per row; drops columns in narrow or half-screen windows
- Two-line clamped titles
- Shorts blocking, with redirects to the normal player
- Sidebar, Mixes and topic cleanup
- New-video highlighting
- Approximate upload dates in place of "X ago"

Every option toggles from the userscript manager menu. [Install][yt-cleaner] · [Source](Social%20Media%20Stuff/YouTube%20Cleaner%20Stable.user.js)

#### Reddit 503 Auto Refresh

Reloads Reddit automatically when it serves a server error (5xx) page, backing off between retries (up to 10). [Install][reddit-503] · [Source](Social%20Media%20Stuff/Reddit%20503%20Auto%20Refresh.user.js)

### Ad blocking

#### SponsorBlock + Ad Skipper Enhanced

Skips YouTube sponsor segments (via [SponsorBlock](https://sponsor.ajay.app/)) and video ads, with per-category toggles and a Shift + S on/off shortcut. [Install][sponsorblock] · [Source](Ad%20Blocking/sponsorblock-ad-skipper.user.js) · [Details](Ad%20Blocking/README.md)

### Gaming

#### Pegasus DL Firmware Filter

For the [Pegasus DL](https://github.com/pegasus-ps5/pegasus-dl) PS5 store and the [Pegasus Catalog](https://pegasus-catalog.fly.dev/) site:

- "I'm on N.xx" console firmware picker, grouped by jailbreak range, that shows only packages that should work on your firmware
- Firmware sort, plus a "FW N.xx+" badge on every card
- **Send to PS5** button on the catalog site that opens the package in Pegasus DL on your console

Thanks to the [pegasus-ps5/pegasus-dl](https://github.com/pegasus-ps5/pegasus-dl) team for Pegasus DL. [Install][pegasus] · [Source](Gaming%20Stuff/Pegasus%20DL%20Firmware%20Filter.user.js) · [Details](Gaming%20Stuff/README.md)

### Shopping

#### Amazon Links

- Direct link to the Amazon product page
- eBay search by product title
- ThePriceGeek search by the first 10 words of the title
- Hover the price to see the minimum eBay price that makes a $2 profit when dropshipping with Prime

[Install][amazon] · [Source](Shopping%20Stuff/Amazon%20Links.user.js)

### Other

#### Bumble Enhanced

- Shows whether someone swiped right on you
- Shows users' online status
- Changes your location on Bumble by longitude and latitude

Original script by habs; mod by /u/AM_NOT_BANANA_AMA to make it more user friendly. [Install][bumble] · [Source](Random%20Stuff/Bumble%20Enhanced.user.js)

## Feedback

Found a bug or want a feature? [Open an issue](https://github.com/klept0/Useful_Userscripts/issues).

[yt-cleaner]: https://raw.githubusercontent.com/klept0/Useful_Userscripts/master/Social%20Media%20Stuff/YouTube%20Cleaner%20Stable.user.js
[reddit-503]: https://raw.githubusercontent.com/klept0/Useful_Userscripts/master/Social%20Media%20Stuff/Reddit%20503%20Auto%20Refresh.user.js
[sponsorblock]: https://raw.githubusercontent.com/klept0/Useful_Userscripts/master/Ad%20Blocking/sponsorblock-ad-skipper.user.js
[pegasus]: https://raw.githubusercontent.com/klept0/Useful_Userscripts/master/Gaming%20Stuff/Pegasus%20DL%20Firmware%20Filter.user.js
[amazon]: https://raw.githubusercontent.com/klept0/Useful_Userscripts/master/Shopping%20Stuff/Amazon%20Links.user.js
[bumble]: https://raw.githubusercontent.com/klept0/Useful_Userscripts/master/Random%20Stuff/Bumble%20Enhanced.user.js
