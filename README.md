# Synopsis

Exascale's limited-partner deck: thirteen slides, one idea each, in the register
of a derivatives venue rather than a venture pitch.

**Confidential.** Do not forward the plaintext.

## Files

| File | What it is |
| --- | --- |
| `lp-briefing.html` | The deck. Thirteen slides, two interactive models. Plaintext source. |
| `build.js` | Wraps it in the passphrase gate and writes `index.html`. |
| `index.html` | The gate. The only file that should ever be served. |

## Building

```bash
node build.js "compute"                      # one shared passphrase
node build.js --to "Sequoia" "pass"          # named recipient, watermarked
```

AES-256-GCM under a random content key, wrapped per recipient by PBKDF2-SHA256
at 310,000 iterations. The plaintext is never in `index.html`. Rebuild whenever
`lp-briefing.html` changes — the gate holds a snapshot, not a reference.

## Design

Light and dark, both designed rather than one flipped. Three states: untouched
the document follows the OS; the toggle in the nav stamps `data-theme`, which
beats the media query in both directions. Every component reads tokens, so the
un-stamped default resolves correctly — nothing is styled inside a media block.

Two chart hues on a near-neutral ground, restrained so weight, scale and rule
thickness still carry most of the hierarchy. Both pairs clear all six colour
checks (lightness band, chroma floor, CVD separation, normal-vision floor,
contrast) against their own surface:

| | Blue | Ochre |
| --- | --- | --- |
| Light | `#1466A8` | `#B0652B` |
| Dark | `#3F92D2` | `#C97B47` |

## Charts and KPIs

Seven drawn charts, generated from data arrays rather than hand-authored path
data: the PwC capex trajectory, H100 price dispersion, capacity with AI share
shaded, the turnover ladder against the $30–40T band, exchange market caps, the
take-rate bands on a log scale, and revenue/EBITDA on a log scale. Marks animate
from a zero baseline when their slide first enters, and only then — an observer
adds `.in`, so nothing off-screen is running. Every chart paints correct resting
geometry if the animation never fires, so print, thumbnails and reduced-motion
all show real marks.

Bars carry a 4px rounded cap at the data end and sit flat on the baseline.
Stacked segments are separated by a 2px surface gap. Series with two members
carry both a legend and direct labels, so nothing is identified by colour alone.

Every figure is prefixed with the deck's own unit marker — `($)` `(#)` `(%)`
`(t)` — carried across from its P&L convention, so a reader knows what kind of
number they are looking at before they read it.

Type is the deck's own Suisse family, lifted from `deck.html` at build time:
**Suisse Works** for headlines, **Suisse Intl** for text, **Suisse Intl Mono**
for every figure. KH Interference is deliberately not carried over — it reads as
a technology product, and this is a financial document. Note the Suisse faces
are trial licences whose embedded terms prohibit public use; settle that with
Swiss Typefaces before this is shown.

Imagery also comes from `deck.html`: the cover backdrop, the data-hall band on
slide 04, the partner marks on the cover, the five team faces and provenance
marks on slide 11, and the three product consoles on slide 04.

Both photographs are dark-first originals, so the scrim is a theme token rather
than a fixed overlay. On dark it lifts to ~42% at the open edge and the render
reads at full strength; on light it sits at ~98% and the same image reads as a
faint architectural texture instead of a black slab. One asset, two deliberate
treatments — the alternative was hiding it in one theme.

Partner and provenance marks are drawn as flat silhouettes in the page's own ink
rather than in brand colour — the treatment the Exascale site already specifies
for its logo band, and the only one that reads as institutional on both grounds.

## The thesis

Compute follows the commodity progression: physical asset → standardised price
→ spot market → derivatives → financing → global financial market. Price, Trade,
Hedge, Finance. Exascale builds the layer, not the commodity.

## External claims, all verified

| Claim | Source |
| --- | --- |
| CME + Silicon Data list H100 and B200 rental-index futures on NYMEX, 5 Oct 2026, pending regulatory review | CME Group press release, 11 Aug 2026 |
| ~200 GW global data-centre capacity by 2030, up to $3T investment; AI rises from 25% to 50% of capacity | JLL Global Data Center Outlook, Jan 2026 |
| $31.6T cumulative AI infrastructure capex through 2050; ~$800bn/yr today to $1.8tn/yr by 2050 | PwC Global Data Centre Outlook, 2026 |

## Three findings carried on the face of the deck

Rather than smoothed over, because an allocator finds them anyway.

1. **Notional is not revenue.** Slide 06 is titled "potential annual notional",
   not TAM. Slide 10 shows why: listed futures earn under 0.1 bp on notional
   while a physical spot marketplace earns 100–180 bp. Multiplying $30T of
   derivatives notional by a spot take rate overstates revenue by roughly three
   orders of magnitude.
2. **The operating plan and the thesis are not yet reconciled.** The plan
   assumes a 60–150 bp blended take on cleared notional. At listed-futures rates
   the same $711B of 2031 notional yields under $10M, not $4.3B. Slide 12 states
   this on the slide.
3. **No regulatory or clearing principal is hired.** Slide 11 shows it as an
   open capability rather than omitting the row. For a venue whose thesis is
   becoming regulated market infrastructure, it is the first hire.

## Reaching $30–40T

The bottom-up model on slide 06 is live — set your own inputs. At JLL's 2030
capacity with oil-like turnover it produces roughly $5–10T of annual notional.
$30–40T needs either a $3–4T physical compute economy, which PwC's capex
trajectory reaches in the 2040s rather than by 2030, or turnover closer to rates
than to crude. Both are defensible; they are different decades, and the deck
says which is which.
