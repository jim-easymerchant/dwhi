# Do We Have It?

An ADHD-friendly household memory assistant. **Not** an inventory app. The goal is to reduce uncertainty ("do we have pickles?") with confidence-based answers — never to require perfect tracking.

This repo is a local-first React Native (Expo) proof of concept. There is no auth, no cloud sync, and no backend. Everything lives in on-device SQLite. The architecture is intentionally split into repositories and services so that household sync, cloud backup, and real vision/voice can drop in later without rewriting the UI.

## Tech

- Expo SDK 51
- React Native 0.74 + TypeScript
- `expo-router` (file-based navigation)
- `expo-sqlite` (local persistence)
- `expo-image-picker` (camera + gallery)
- `expo-file-system` (image persistence)
- `zustand` (lightweight UI handoff store)

## Setup

```bash
npm install
npx expo start
```

Then either:
- press **a** to open on a connected Android device/emulator, or
- scan the QR code with **Expo Go**.

> The mock AI service runs locally and needs no API keys.

### Useful scripts

```bash
npm run typecheck   # tsc --noEmit
npm run android     # expo start --android
```

## Layout

```
app/                   # expo-router screens
  _layout.tsx          # root stack + DB init + seed
  index.tsx            # home (Ask / Receipt / +In / -Out)
  ask.tsx              # ask modal
  capture-receipt.tsx  # camera → mock parser
  confirm-receipt.tsx  # edit parsed items → save
  capture-item.tsx     # camera → mock recognizer (IN or OUT)
  confirm-item.tsx     # edit details, quantity, save event

src/
  db/                  # SQLite open + schema migrations
  repositories/        # one file per table, returns typed models
  services/
    aiService.ts       # stub vision parser + recognizer (future: OpenAI Vision)
    voiceService.ts    # stub (future: speech-to-text)
    confidenceEngine.ts# heuristic answer + confidence level
    captureStore.ts    # in-memory handoff between capture/confirm screens
    imageStorage.ts    # persist picked images into documentDirectory
  components/          # reusable UI primitives
  theme/               # dark-mode colors, spacing, radii, typography
  seed/                # plants a few items + a receipt on first launch
  types/               # shared model types
```

## How the confidence engine works

`answerQuestion(query)` in `src/services/confidenceEngine.ts`:

1. strips filler words ("do we have any …") down to a noun phrase
2. fuzzy-matches the item table by name / canonical_key / category
3. looks for the most recent receipt that mentions the term
4. derives `net = sum(IN) - sum(OUT)` and the recency of the last IN / OUT
5. picks `Probably | Maybe | Unlikely | No | Unknown` and writes a sentence

The UI **never** shows a raw inventory count as the primary answer.

## Replacing the stubs

| Stub | File | Replace with |
| ---- | ---- | ------------ |
| Receipt parser | `aiService.parseReceipt` | OpenAI Vision call returning the same `ReceiptParseResult` |
| Item recognizer | `aiService.recognizeItem` | OpenAI Vision call returning the same `ItemRecognitionResult` |
| Voice input | `voiceService.transcribe` | `expo-speech-recognition` or similar |
| Multi-user sync | (not implemented) | repositories already return plain DTOs — wrap with a sync layer |

## Philosophy reminders

- Never block the user.
- Never punish missing data.
- Confidence words > exact counts.
- Big touch targets. Dark by default.
