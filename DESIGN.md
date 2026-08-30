---
name: NetVitals — Vitals Monitor
version: alpha
description: A connection diagnostic styled as a bedside vitals monitor — an ECG heartbeat trace, phosphor-green signal, and clinical readouts.
colors:
  screen: "#0A0E0C"
  panel: "#10150F"
  tray: "#161C16"
  crt: "#E9F1EC"
  slate: "#8A9A90"
  primary: "#3CE08C"
  sinus: "#14663F"
  spike: "#7FF0BB"
  wave: "#4FC3E8"
  alarm: "#FF6267"
  caution: "#FFB13D"
typography:
  display:
    fontFamily: "'IBM Plex Sans', 'Helvetica Neue', Arial, sans-serif"
    fontSize: "2rem"
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: "-0.02em"
  heading:
    fontFamily: "'IBM Plex Sans', 'Helvetica Neue', Arial, sans-serif"
    fontSize: "1.15rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  body:
    fontFamily: "'IBM Plex Sans', system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "0.95rem"
    fontWeight: 400
    lineHeight: 1.6
  metric:
    fontFamily: "'IBM Plex Mono', ui-monospace, 'SFMono-Regular', Menlo, monospace"
    fontSize: "1.9rem"
    fontWeight: 500
    lineHeight: 1
    letterSpacing: "-0.02em"
    fontFeature: "'tnum' 1"
  label:
    fontFamily: "'IBM Plex Mono', ui-monospace, 'SFMono-Regular', Menlo, monospace"
    fontSize: "0.72rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.08em"
  caption:
    fontFamily: "'IBM Plex Sans', system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "0.78rem"
    fontWeight: 400
    lineHeight: 1.45
rounded:
  none: "0px"
  sm: "6px"
  md: "10px"
  lg: "16px"
  xl: "22px"
  full: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "14px"
  lg: "20px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.screen}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "0 18px"
    height: "44px"
  button-primary-hover:
    backgroundColor: "{colors.sinus}"
    textColor: "{colors.crt}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "0 18px"
    height: "44px"
  button-secondary:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.crt}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "44px"
  card:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.crt}"
    rounded: "{rounded.lg}"
    padding: "16px"
  sheet:
    backgroundColor: "{colors.tray}"
    textColor: "{colors.crt}"
    rounded: "{rounded.xl}"
    padding: "18px 16px"
  pill:
    backgroundColor: "#1A221A"
    textColor: "{colors.slate}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
  status-good:
    backgroundColor: "#12281C"
    textColor: "{colors.spike}"
    rounded: "{rounded.full}"
  status-info:
    backgroundColor: "#12212A"
    textColor: "{colors.wave}"
    rounded: "{rounded.full}"
  status-warn:
    backgroundColor: "#2A2012"
    textColor: "{colors.caution}"
    rounded: "{rounded.full}"
  status-bad:
    backgroundColor: "#2A1414"
    textColor: "{colors.alarm}"
    rounded: "{rounded.full}"
---

# NetVitals — Vitals Monitor

## Overview

NetVitals should read as a **bedside vitals monitor** — the product name is the
brief. The network is the patient; the diagnostic is a check-up; the results are a
set of vital signs. The emotional reference is a hospital ICU monitor in a dark
room: a near-black screen, a phosphor-green ECG trace sweeping out the heartbeat of
the connection, and calm, clinical readouts.

The ECG waveform is the signature element, and it *is* the progress indicator. The
diagnostic runs the same way a monitor draws a trace: a faint ghost track before it
starts, a bright green heartbeat drawing left-to-right while it measures, and a
complete trace when it finishes. It must feel like a real lead-II rhythm — a sharp
QRS spike, a soft T wave, a thin glowing green line on black. A dropped connection
is a flatline; high jitter is an irregular rhythm. The trace is decorative health
signaling, not a measurement, and must never be presented as actual ECG or medical
data.

The mood is clinical, precise, and reassuring. Numbers are set in a telemetry
monospace and read like the monitor's digital readout; headings are set in IBM Plex
Sans and read like equipment labeling. Light is reserved for *signal*: the green
trace glows faintly, and severity climbs the monitor's own alarm ladder — amber
caution, red alarm.

## Colors

The palette sits on a near-black screen, `{colors.screen}`, with the faintest green
undertone. Text is `{colors.crt}` — cool screen-white — and muted copy is
`{colors.slate}`, a gray-green. Surfaces are one and two steps lighter than the
screen but stay dark: `{colors.panel}` for cards and `{colors.tray}` for raised or
hovered layers.

Signal is `{colors.primary}` — phosphor green, the ECG line and the product's primary,
distinct from the retired `#397ef6` AI-blue and from organic "moss" green. Its deep
companion is `{colors.sinus}`, and its light-on-dark text form is `{colors.spike}`.
A secondary cyan, `{colors.wave}`, may appear for a second trace or a secondary
metric, but the primary trace is always green. Severity climbs the alarm ladder:
`{colors.caution}` (amber) and `{colors.alarm}` (red), warm and muted rather than
strobing.

Hairline borders are ~9% `{colors.crt}` over each surface. Do not introduce purple,
magenta, or neon; the palette stays within screen-black, phosphor green, cyan, amber,
and red.

## Typography

Two voices, kept disciplined:

- **Display / heading — `{typography.display}` / `{typography.heading}`.** IBM Plex
  Sans, a clinical grotesque with a technical, lab-like character. Used for the
  product name, section headings, and the big hero status line.
- **Metric / label — `{typography.metric}` / `{typography.label}`.** IBM Plex Mono
  with tabular numerals (`fontFeature: 'tnum'`) so columns of numbers align. Used for
  every measurement, delta, timestamp, and pill label. This is the monitor's digital
  readout and must never be set in a proportional face.
- **Body / caption — `{typography.body}` / `{typography.caption}`.** IBM Plex Sans
  for body copy. Body copy explains; it should never compete with the mono readout.

Numeric readouts are `fontWeight: 500` mono, slightly tightened, in `{colors.crt}`.
Labels are uppercase, `0.08em` tracked, `{colors.slate}`. Display sizing may scale
responsively with `clamp()` at implementation time; the token records the canonical
resting size.

## Layout & Spacing

A single centered column, `max-width` ~900px, with generous breathing room. The
metric grid collapses from 4 → 2 → 1 columns at desktop → tablet → phone. Spacing is
a 4px base (`{spacing.xs}`) with `{spacing.md}` (14px) as the default card gap and
`{spacing.lg}` (20px) for section separation. Cards sit on the screen with room to
breathe; nothing should feel cramped or packed into a dashboard.

## Elevation & Depth

Depth is tonal, not shadow. There are no glassmorphism blurs and no drop-shadow
"floating" cards. Panels are one step lighter than the screen and separated by
hairline borders, like modules on a monitor face. Emphasis is expressed by raising a
panel's tone (to `{colors.tray}`) rather than lifting it with shadow. The ECG trace
is the only element permitted a soft phosphor glow.

## Shapes

Geometry is instrument-meets-medical: cards use `{rounded.lg}`, buttons
`{rounded.md}`, status dots and pills are `{rounded.full}`, and the hero/sheet use
`{rounded.xl}`. Corners are soft but never bubbly. The signature **ECG waveform** — a
repeating lead-II rhythm (small P wave, sharp QRS spike, soft T wave) — is rendered
as the progress bar. A faint "ghost" trace shows the full track; the bright trace
draws left-to-right as the diagnostic runs, with a small glowing pulse dot at the
fill head. A hairline with a small green tick is used as a section divider, like a
ruled monitor strip.

## Components

- **Buttons.** Primary is `{colors.primary}` fill with `{colors.screen}` text — solid,
  alive, obviously the thing to press. Hover deepens to `{colors.sinus}` with light
  text. Secondary is `{colors.panel}` with a hairline border. No gradients; hover
  shifts by tone only.
- **Cards.** Solid `{colors.panel}`, hairline border, `{rounded.lg}`. A card title is
  an uppercase mono label; its metric is a large mono value.
- **Status dots / pills.** Round, flat, tinted on the alarm ladder. Good =
  `{colors.spike}`, caution = `{colors.caution}`, alarm = `{colors.alarm}`, each on a
  dark tinted chip.
- **Progress / bars.** The progress indicator *is* the ECG trace. The track is a faint
  ghost waveform; the fill is the bright `{colors.primary}` trace revealed
  left-to-right with a glowing pulse dot at the head. An empty fill (ghost only)
  means not started; a complete trace means the diagnostic finished. No gradient
  sheen, no laser-beam fill.
- **Sheets / dialogs.** A raised `{colors.tray}` panel with `{rounded.xl}` top
  corners and a hairline border, sliding from the bottom on mobile and centered on
  desktop.
- **Verdict tiles.** Small bordered cells (`{colors.tray}` on hover) with a mono
  value; the winning verdict may warm toward `{colors.primary}` without breaking the
  tonal system.
- **Charts.** Mono tick labels on `{colors.panel}` boxes; plot lines use
  `{colors.primary}`, `{colors.wave}`, and `{colors.alarm}` with no fill gradient.

## Do's and Don'ts

**Do**

- Use mono (`{typography.metric}`) for every number, delta, and pill label.
- Use IBM Plex Sans display (`{typography.display}`) for product name and section heads.
- Let only the ECG trace glow; treat it as decorative health signaling.
- Prefer tonal elevation and hairlines over shadows and blurs.
- Express severity with the alarm ladder — green / amber / red — never with blue.

**Don't**

- No blue gradients, no `linear-gradient` button fills, no purple or magenta.
- No glassmorphism (`backdrop-filter`) or floating drop-shadow cards.
- No pure `#fff` text or pure `#000` backgrounds.
- No neon or "cyber" accents; caution and alarm are amber and red, not alarm-bright.
- No emoji or clip-art icons; use the ECG/grid motif and mono glyphs only.
- Do not present the ECG trace as a real measurement or as medical data, and do not
  rename measurements into stronger claims (latency stays "HTTP RTT approximation",
  loss stays "application-layer request loss").
