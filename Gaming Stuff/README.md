# Pegasus DL Firmware Filter

A userscript for the web UI of [Pegasus DL](https://github.com/pegasus-ps5/pegasus-dl), the PS5 payload for downloading packages directly on the console, and for the [Pegasus Catalog](https://pegasus-catalog.fly.dev/) site that hosts its package sources. It adds a firmware filter and a firmware sort to both, so you can see at a glance which packages should work on your console, and a **Send to PS5** button on the catalog site that opens a package in your PS5's Pegasus DL.

## Thanks

All credit for Pegasus DL itself goes to the [pegasus-ps5/pegasus-dl](https://github.com/pegasus-ps5/pegasus-dl) team. This script only adds a small layer on top of their store UI; the app, the catalogs integration and the download pipeline are their work. Thanks also to the catalog maintainers (DLPS, PFS, Pippo, ZER0GAME, evoX-CoreOS) whose release notes make the firmware data possible, and to [M3hmetSa1t](https://github.com/M3hmetSa1t/pegasus-ps4-collection-catalog) for the PS4 FPKG Collection catalog.

## Features

- **"I'm on N.xx" picker**: choose the major firmware your console runs (1.xx to 13.xx). The store then shows only packages whose minimum firmware is at or below yours, which is what *should* work.
- **Grouped by jailbreak range**: options are grouped the way the scene usually splits firmware:

  | Range | Public exploit |
  |-------|----------------|
  | 1.xx–5.xx | UMTX (up to 5.50) |
  | 6.xx–10.xx | Y2JB + Lapse (up to 10.01) |
  | 11.xx–12.xx | Y2JB + P2JB (up to 12.70) |
  | 13.xx | Relapse (up to 13.60) |

- **Firmware sort**: default order, low to high, or high to low. Packages with no stated firmware always sort last.
- **FW badge** on every card (for example `FW 4.xx+`).
- Works with the existing search box, source pills, result count and "Load more" paging, because it filters the app's full package list rather than only the cards on screen.
- Your choices are remembered in the browser (separately for the PS5 UI and the catalog site).

## Pegasus Catalog site

On [pegasus-catalog.fly.dev](https://pegasus-catalog.fly.dev/) the same picker and sort appear under the catalog title, with a count of matching packages. The site loads packages 48 at a time from its server, so while a firmware or sort is set the script fetches the whole selected catalog once (cached for a minute), filters and sorts it, and hands the results back to the site page by page. Search, catalog switching and infinite scroll keep working. With **Any FW** and **Default order** the site's requests pass through untouched; only the badges are added.

### Extra catalog: PS4 FPKG Collection

The catalog site also lists the [PS4 FPKG Collection](https://github.com/M3hmetSa1t/pegasus-ps4-collection-catalog) by M3hmetSa1t: 866 PS4 FPKGs with patches and DLCs merged, hosted on the Internet Archive. It is not on pegasus-catalog.fly.dev itself; the script reads its catalog JSON from GitHub Pages and adds it to the site's catalog list. Browsing, search, infinite scroll, the details pane, **Copy Source URL** and **Send to PS5** all work as with the built-in catalogs. It has no copy counter, so that shows 0.

PS4 packages get a `PS4` badge instead of a firmware badge. Their "Min FW" is a PS4 system firmware and says nothing about PS5 firmware, so the PS5 firmware picker never hides them, and firmware sorting puts them after the PS5 packages.

To download from it on the console, add it as a source in Pegasus DL first (Sources > Add Source by URL):

```text
https://m3hmetsa1t.github.io/pegasus-ps4-collection-catalog/pegasus-ps4-catalog.json
```

## Send to PS5

Browse the catalog on a computer or phone and send a package to the console:

1. On the catalog site, type your PS5's IP address in the box next to the firmware picker (for example `192.168.0.12`; port 6970 is assumed). It is remembered.
2. Click a package, then **Send to PS5** in the details pane.
3. A tab opens (or the same tab is reused) on Pegasus DL on your PS5 with the package selected in the Store tab and its download links shown. Pick a link there and Pegasus DL's normal download flow runs: provider resolving, debrid, PS5 browser capture and so on.

The catalog must already be added as a source in Pegasus DL (the default sources are). If the package is newer than your PS5's copy of the catalog, Pegasus DL says so; refresh the source and send it again. The script must also be installed in the browser you use for the catalog site, since that browser opens the Pegasus DL page.

## How firmware is detected

Catalogs have no firmware field, so the script reads the package description and download link names and takes the lowest firmware mentioned. Formats it understands:

- `Works on 6.xx and higher`, `Works on 13.60 and higher` (DLPS)
- `EUR 6.xx Base`, `USA 13.60 Game` in link names (DLPS)
- `Firmware: 10.xx+, 11.xx+, 12.xx+` (PFS, ZER0GAME)
- `Base FPKG & Dump are 12.xx, separated BackPort for 4.xx+` (Pippo)

Upper bounds such as `FPKG ... up to 11.60` are ignored.

## Limitations

- The result is only as accurate as the catalog text. Treat the filter as "should work", not a guarantee.
- Only the major version is used, so 10.01 and 10.20 both count as 10.xx.
- Packages that state no firmware (homebrew apps, some dumps) are hidden while a firmware is picked. Choose **Any FW** to see them.
- It hooks Pegasus DL's page functions (`filteredPackages`, `packageCards`, `renderLibraryPanel`). A future Pegasus DL release that renames them will make the script do nothing until it is updated; it will not break the store.
- On the catalog site it relies on the `/api/catalogs/<slug>/packages` endpoint and the page's class names. If a request it makes fails, the site's normal request is used instead.

## Installation

1. Install a userscript manager: [Tampermonkey](https://tampermonkey.net/) or [Violentmonkey](https://violentmonkey.github.io/).
2. Open the install link: [Pegasus DL Firmware Filter.user.js](https://raw.githubusercontent.com/klept0/Useful_Userscripts/master/Gaming%20Stuff/Pegasus%20DL%20Firmware%20Filter.user.js)
3. Open the Pegasus DL web UI (`http://<your-ps5-ip>:6970/`). The controls appear next to the refresh button in the Store tab. On [pegasus-catalog.fly.dev](https://pegasus-catalog.fly.dev/) they appear under the catalog title.

The script matches any host on port 6970, so it keeps working if your PS5's IP address changes. It does nothing on pages that are not Pegasus DL. Installing from the link above enables automatic updates.
