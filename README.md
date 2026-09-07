# Synopsis

The simplified Exascale deck — the investor memorandum rewritten for limited
partners who are not close to the technology. Same app as the full deck: a
1280×720 stage scaled to fit, scroll-snapped slides, a progress rail, prev/next,
a slide map, and a passphrase gate.

**Confidential.** This carries the P&L, the valuation grid and the return
multiples. Do not forward the plaintext.

## Files

| File | What it is |
| --- | --- |
| `lp-briefing.html` | The briefing itself, 14 slides. The plaintext source. |
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

- **Type.** The full deck embeds Suisse Intl and KH Interference, which are
  trial licences whose terms prohibit public use. This sets Spectral, Source
  Sans 3 and IBM Plex Mono from Google Fonts instead — open-licensed, same
  editorial register.
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
