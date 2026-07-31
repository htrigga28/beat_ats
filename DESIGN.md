---
name: Beat ATS
description: A document examination desk for truthful resume tailoring.
colors:
  verification-green: "#176B4D"
  verification-green-deep: "#0E5038"
  paper: "#F5F7F3"
  sheet: "#FFFFFF"
  ink: "#17231C"
  muted-ink: "#53615A"
  rule: "#C9D0C8"
  warning: "#9A5B00"
  error: "#A33A35"
typography:
  display:
    fontFamily: "ui-sans-serif, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "clamp(2rem, 5vw, 3.5rem)"
    fontWeight: 750
    lineHeight: 1.02
    letterSpacing: "-0.03em"
  body:
    fontFamily: "ui-sans-serif, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "ui-sans-serif, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "0.78rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.04em"
rounded:
  control: "8px"
  surface: "12px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "28px"
  xl: "44px"
components:
  button-primary:
    backgroundColor: "{colors.verification-green}"
    textColor: "{colors.sheet}"
    rounded: "{rounded.control}"
    padding: "10px 18px"
  button-primary-hover:
    backgroundColor: "{colors.verification-green-deep}"
    textColor: "{colors.sheet}"
    rounded: "{rounded.control}"
    padding: "10px 18px"
  input:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "10px 12px"
---

# Design System: Beat ATS

## Overview

**Creative North Star: "The Document Examination Desk"**

Beat ATS should feel like reviewing a clean proof copy with a careful editor: factual
source material remains visible, proposed changes are deliberate, and verification is
more important than spectacle. The world is light because the user is reading dense
career material in ordinary working light; paper, ink, rules, and restrained review
marks create hierarchy.

The interface is an Operate surface. Expression appears through precise document-like
spacing, a persistent four-stage registration strip, and explicit change states—not
through decorative cards, gamification, or promises about hiring outcomes.

**Key Characteristics:**

- Paper-first, high-contrast reading surfaces.
- Verification green reserved for confirmed progress and primary actions.
- Thin rules and spacing establish hierarchy; shadows are exceptional.
- Source, suggestion, warning, and accepted-change states are always distinguishable.

## Colors

The palette uses cool paper neutrals and one evidence-oriented green accent.

### Primary

- **Verification Green** (`#176B4D`): Primary actions, active progress, accepted changes,
  and successful validation.
- **Deep Verification Green** (`#0E5038`): Hover and pressed states.

### Neutral

- **Worktable Paper** (`#F5F7F3`): Application background.
- **Resume Sheet** (`#FFFFFF`): Inputs and the main working surface.
- **Editorial Ink** (`#17231C`): Primary text and strong rules.
- **Pencil Note** (`#53615A`): Secondary text.
- **Registration Rule** (`#C9D0C8`): Dividers and field borders.

### Named Rules

**The Verification Rule.** Green means an action or state has been deliberately
confirmed; it is not decorative.

## Typography

**Display Font:** Native UI sans-serif stack
**Body Font:** Native UI sans-serif stack

**Character:** A familiar workhorse face keeps long resume content legible and makes the
document—not branding—the subject.

### Hierarchy

- **Display** (750, `clamp(2rem, 5vw, 3.5rem)`, 1.02): Product title and one decisive
  page-level statement.
- **Headline** (700, 1.55rem, 1.15): Current workflow task.
- **Title** (700, 1.1rem, 1.3): Resume roles and analysis groups.
- **Body** (400, 1rem, 1.55): Instructions and resume content, capped near 72ch.
- **Label** (700, 0.78rem, 0.04em): Field and progress labels; uppercase only where a
  compact status needs it.

## Layout

The desktop surface uses one centered working column up to 1080px wide with a compact
progress strip above it. Content forms a reading measure of roughly 72 characters.
Related fields stay tight; workflow boundaries receive 28–44px of separation. On narrow
screens the progress strip becomes a two-column register and all editors stack without
horizontal scrolling.

## Elevation & Depth

The system is flat by default. White working sheets separate from the cool paper ground
through contrast and a single border. A soft offset shadow may appear only on the active
working surface; alerts and nested content use rules instead of more cards.

**The Flat Proof Rule.** Never combine a border and a large shadow on the same container.

## Shapes

Controls use an 8px radius and major working surfaces use 12px. Status chips may be
compact capsules, but buttons, inputs, editors, and content containers never become
pills. Borders remain one pixel.

## Components

### Buttons

- **Shape:** Compact rectangle with an 8px radius.
- **Primary:** Verification green, white text, and 10px by 18px padding.
- **Hover / Focus:** Deep green on hover; a high-contrast two-pixel focus outline.
- **Secondary:** White sheet, editorial ink, and a one-pixel registration rule.

### Cards / Containers

- **Corner Style:** 12px only for the main working sheet and alerts.
- **Background:** Resume Sheet on Worktable Paper.
- **Shadow Strategy:** None at rest; one soft downward shadow on the active sheet only.
- **Border:** One-pixel registration rule.
- **Internal Padding:** 16px on phones, 28px on larger screens.

### Inputs / Fields

- **Style:** White background, dark ink, one-pixel rule, 8px radius.
- **Focus:** Verification-green border with a visible outline.
- **Error / Disabled:** Error uses text plus color; disabled controls remain readable.

### Navigation

The four-stage registration strip keeps every step visible. Completed, current, and
pending stages use text, marker fill, and connector treatment—not color alone.

### Change Register

AI alternatives remain adjacent to their source bullet. Applying a variation records a
visible accepted state; nothing silently replaces source content.

## Do's and Don'ts

### Do:

- **Do** keep the current task and recovery action visible during long AI operations.
- **Do** distinguish source text, AI suggestions, and accepted edits with labels.
- **Do** preserve generous reading width and direct, factual interface copy.

### Don't:

- **Don't** turn the workflow into a score game or imply a hiring guarantee.
- **Don't** use nested cards, gradients, glass effects, or decorative document icons.
- **Don't** hide privacy, consent, cost-triggering actions, or stale-analysis status.

