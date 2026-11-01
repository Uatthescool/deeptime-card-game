# Card design files

Source files for Deep Time's card faces, and the tools that build cards from them.

| Folder | What's in it |
| --- | --- |
| `templates/` | The card frame. `…Geometry_v3_1024x1434.png` is the master: it matches the in-game Nautilus frame pixel for pixel. `v2` is the earlier original; the `1462x2048` v3 is an enlargement for print-size work. `nautilus-reference.webp` is the original in-game Nautilus face, kept unchanged because the tools read its frame; the shipped Nautilus face now has the shortened scientific name. |
| `period-textures/` | One border texture per time period, named exactly as the period (`Jurassic.png`, …). |
| `fonts/` | The DejaVu fonts the cards are lettered in (free to use and ship; see `DejaVu-LICENSE.txt`), and `fonts.conf`, which lets the tools find them without installing them. |
| `card-faces/` | Cards made by the generator. |
| `support-assets/` | The Support asset kit: a border texture and a medallion icon for each Support type (Adaptation, Concept, Continuous Event, Instant Event), with palettes, proofs and their build scripts. See its `README.txt`. |
| `support-faces/` | Support cards made by `make-support.ts`. |
| `prototype-cards/` | The original prototype images. **Not in git**: some contain art that isn't cleared for use. |
| `work/` | The tools, and their scratch images. **Not in git.** |

## Making a card

```bash
FONTCONFIG_FILE="$PWD/design/fonts/fonts.conf" npx vite-node design/work/make-card.ts -- archaeopteryx --epoch Late
```

This reads the card's data, then builds `design/card-faces/<key>.png` at the in-game size (1024 × 1434):

- **Frame:** the v3 template.
- **Border:** the card's period texture, with the frame's own shading kept.
- **Diet badge:** the Diet icon.
- **Art:** `public/artwork/<key>.webp`, cover-fitted into the art window.
- **Lettering:** taken from the card data, in type sizes and positions measured from the in-game Nautilus. That's the name and scientific name, Taxa (the gameplay Taxon bold and underlined), Tags, flavour text wrapped around the Level badge, the period (with `--epoch` when given), and the Level.

`FONTCONFIG_FILE` has to be set when the command starts. Without it the image library can't find the fonts, and it would quietly use a different typeface.

## Making a Support card

```bash
FONTCONFIG_FILE="$PWD/design/fonts/fonts.conf" npx vite-node design/work/make-support.ts -- stampede
```

This builds `design/support-faces/<key>.png` on the same frame, changed for Supports:

- **Rules box:** the Taxa, Tags and flavour panels become one box. The rules are left-aligned from its top, at the largest size that fits above the footer rule. That's up to 125% of flavour-text size, so shorter rules print larger. The longest Supports (Stampede and Feedback Loops) stay at flavour-text size. Blank lines in the rules start a new paragraph, and line breaks start a new line, as in Feedback Loops' list.
- **No Level badge:** Supports have no Level.
- **Name bar:** the name alone.
- **Medallion:** the type's icon from `support-assets/icons/`.
- **Border:** the type's texture from `support-assets/textures/`.
- **Footer:** the type, as the game names it, for example "Instantaneous Event".
- **Not on the face:** rulings and work-in-progress notes.

## Checking a card

```bash
node design/work/verify-frame.mjs public/card-faces/nautilus.webp design/card-faces/archaeopteryx.png
```

This reports the share of frame pixels (rims, outlines, badge rings, corners) identical to the Nautilus. A correctly built card shows 100.00%.

## Not done yet

- **Concept texture:** the cool grey is still a draft in the asset kit.
- **Diet icons:** Carnivore only, using the in-game drumstick. Herbivore and Omnivore icons are still needed.
- **Period detail:** the card data has no "Early/Middle/Late" field, so it's passed with `--epoch` for now.

## Scientific names

A card named for its genus prints the genus as an initial (Allosaurus *A. fragilis*), using `printedScientificName` from the card data, the same as the in-game card. Faces not made by `make-card.ts` (the in-game Nautilus, and Amargasaurus from an older version of it) get the new name panel only:

```bash
node design/work/splice-name.mjs public/card-faces/<key>.webp design/card-faces/<key>.png out.png
```
