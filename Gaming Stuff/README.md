# Pegasus DL Firmware Filter

A userscript for the web UI of [Pegasus DL](https://github.com/pegasus-ps5/pegasus-dl), the PS5 payload for downloading packages directly on the console. It adds a firmware filter and a firmware sort to the Store tab, so you can see at a glance which packages should work on your console.

## Thanks

All credit for Pegasus DL itself goes to the [pegasus-ps5/pegasus-dl](https://github.com/pegasus-ps5/pegasus-dl) team. This script only adds a small layer on top of their store UI; the app, the catalogs integration and the download pipeline are their work. Thanks also to the catalog maintainers (DLPS, PFS, Pippo, ZER0GAME, evoX-CoreOS) whose release notes make the firmware data possible.

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
- Your choices are remembered in the browser.

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

## Installation

1. Install a userscript manager: [Tampermonkey](https://tampermonkey.net/) or [Violentmonkey](https://violentmonkey.github.io/).
2. Open the install link: [Pegasus DL Firmware Filter.user.js](https://raw.githubusercontent.com/klept0/Useful_Userscripts/master/Gaming%20Stuff/Pegasus%20DL%20Firmware%20Filter.user.js)
3. Open the Pegasus DL web UI (`http://<your-ps5-ip>:6970/`). The controls appear next to the refresh button in the Store tab.

The script matches any host on port 6970, so it keeps working if your PS5's IP address changes. It does nothing on pages that are not Pegasus DL. Installing from the link above enables automatic updates.
