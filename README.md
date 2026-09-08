# Synopsis

The simplified Exascale deck — the investor memorandum rewritten for limited
partners who are not close to the technology. Same app as the full deck: a
1280×720 stage scaled to fit, scroll-snapped slides, a progress rail, prev/next,
a slide map, and a passphrase gate. Ten of the diagrams are live — drag a
control and the figures recompute.

**Confidential.** This carries the P&L, the valuation grid and the return
multiples. Do not forward the plaintext.

## Files

| File | What it is |
| --- | --- |
| `lp-briefing.html` | The briefing itself: 23 slides mirroring the deck, plus two appendices. Ten diagrams are interactive. The plaintext source. |
| `build.js` | Wraps it in the passphrase gate and writes `index.html`. |
| `index.html` | The gate. The only file that should ever be served. |

## Building

```bash
node build.js "compute"                      # one shared passphrase
node build.js --to "Taurus Capital" "pass"   # named recipient, watermarked
```

The briefing is encrypted with AES-256-GCM under a random content key, which is
then wrapped per recipient under a key derived from their passphrase by PBKDF2-
SHA256 at 310,000 iterations. The plaintext is never in `index.html` — "view
source" on the gate yields ciphertext, so it is not a JavaScript check that can
be clicked past. A `--to` build tiles the recipient's name across every slide, so
a leaked screenshot names its source; an unlabelled build carries no watermark.

Rebuild whenever `lp-briefing.html` changes — the gate holds a snapshot, not a
reference. `.vercelignore` and `netlify.toml` both exist to stop the plaintext
being served past the gate; keep them in step with any file you add.

## How this differs from `taihungau/deck`

Same machinery, three deliberate departures:

- **Type.** Lifted from `deck.html` at build time — Suisse Intl 400/500,
  Suisse Intl Mono and KH Interference, the deck's own faces, so the two
  documents cannot drift apart visually. **These are trial licences**: the
  embedded copyright states testing and experimenting only, with commercial
  and public use prohibited. The deck already ships them, so this adds a
  surface rather than a new exposure — but it is worth settling with Swiss
  Typefaces before either document goes to an investor.
- **Palette.** Charts use `#19AD90` against an ochre second hue rather than the
  brand jade `#0A9078`, which reads grey at chart size and sits below the
  normal-vision separation floor against the site's steel blue. The substitute
  clears all six colour checks on this ground.
- **Audience.** Written for a reader who does not know what a GPU is. Jargon is
  defined once on slide 03 and then avoided; every externally checkable figure
  carries a numbered source, and every figure that is Exascale's own assertion
  is marked `OURS` so a reader can tell the two apart at a glance.

## What this document deliberately does not do

It states the return multiples from the full deck — 104× to 1,377× — because
they are the founders' own figures and the arithmetic behind them checks out.
What it adds is the chain of assumptions underneath them, and the rung the
original grid omits: a 0× outcome, which for a pre-licence venue that has not
cleared a trade is the most likely single result.


## The interactive diagrams

Ten diagrams recompute as the reader drags a control. They are on slides 04,
05, 06, 08, 10, 13, 14, 16, 18 and 22, and each is marked `LIVE` in its header.

Two rules hold across all of them. Nothing runs off-screen — each registers
with an observer so twenty-five panels do not hold twenty-five loops open. And
every diagram paints a real resting state on first load, so a reader who
touches nothing, a printed page, and the thumbnails in the slide map all show
figures rather than an empty frame.

Three of them exist for diligence rather than persuasion:

- **14 · concentration.** Drag to any top-N and read the share of the demand
  book it holds. The top 18 of 214 accounts are 63% of it; the single largest
  is 13%.
- **18 · pay the researchers.** The plan assumes 66 of 81 staff take no salary.
  The switch adds the ~$16M a year the deck footnotes, and year-one margin
  falls from 71% to 28%.
- **22 · return sensitivity.** Exit year, revenue multiple and final ownership
  are all sliders, so a reader can test the 1,147× base case against their own
  assumptions instead of accepting it.

## Diligence appendix

Two unnumbered panels follow slide 23, so the 01–23 mirroring is not broken.
The first is the KPI checklist a partner at a firm like Sequoia opens with,
honestly filled in — seven of the ten headline measures cannot be answered
before launch, and the panel says so rather than inventing them. It also
carries two findings from the deck itself:

1. **A figure that contradicts itself.** Slide 18 puts CFTC designated-contract-
   market registration at $1.25M on its own. Slide 22 budgets $1.0M for that
   registration *plus* DCO licensing, a money-transmitter licence, a surety
   bond, a compliance team and counsel. Both cannot be right.
2. **Concentration.** 63% of the demand book sits with 18 of 214 accounts and
   13% with one. Worth showing top-five conversion status unprompted.
