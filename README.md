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

> The app runs out of the box with **no API key**: receipts and item photos go
> through a mock parser that returns sample data.

### Useful scripts

```bash
npm run typecheck   # tsc --noEmit
npm run android     # expo start --android
```

### Optional: enable real OpenAI Vision receipt parsing

The Receipt flow can be wired to OpenAI's Vision API. The IN/OUT item flow
still uses the local mock.

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
2. Set `EXPO_PUBLIC_OPENAI_API_KEY` to a key with vision-model access
   (default model is `gpt-4o-mini`; override with `EXPO_PUBLIC_OPENAI_MODEL`).
3. Restart Expo (`Ctrl-C`, then `npx expo start --clear`) so the new env is
   inlined into the bundle.

When a key is present, the Receipt capture screen shows a small "AI parsing
on" indicator and the confirm screen shows an **AI parsed** badge. When no
key is present, you'll see **Mock parsed** instead. If the API call fails,
the app stays usable and prompts you to use sample data or to enter the
receipt manually — nothing saves until you tap **Save Receipt**.

#### Privacy / data handling

- **Default (no API key)**: every capture stays on the device. Receipt
  images live in the app's document directory; the database is local SQLite.
  Nothing leaves the phone.
- **With OpenAI parsing enabled**: the receipt image is base64-encoded and
  POSTed to `https://api.openai.com/v1/chat/completions` for parsing. The
  app does **not** send any other data (no item photos, no history, no
  identifiers) and does **not** persist anything server-side. There is no
  backend in this POC.
- **Security limitation of `EXPO_PUBLIC_*`**: Expo inlines these variables
  into the JavaScript bundle, so anyone who installs the APK can extract the
  key. This is acceptable for a local-only POC; for production, swap to a
  thin server proxy that holds the key.

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
  db/                       # SQLite open + schema migrations
  repositories/             # one file per table, returns typed models
  services/
    aiService.ts            # stub vision parser + recognizer + types
    openaiReceiptService.ts # real OpenAI Vision receipt parser + guardrails
    receiptParser.ts        # AI / mock / manual orchestration entry point
    env.ts                  # reads EXPO_PUBLIC_* config
    voiceService.ts         # stub (future: speech-to-text)
    confidenceEngine.ts     # heuristic answer + confidence level
    captureStore.ts         # in-memory handoff between capture/confirm screens
    imageStorage.ts         # persist picked images into documentDirectory
    saveReceipt.ts          # single-transaction receipt + items + IN events
    saveItemEvent.ts        # single-transaction item upsert + event
  components/               # reusable UI primitives
  theme/                    # dark-mode colors, spacing, radii, typography
  seed/                     # plants a few items + a receipt on first launch
  types/                    # shared model types
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
| Receipt parser | `aiService.parseReceipt` | ✅ done — see `openaiReceiptService.ts` + `receiptParser.ts` |
| Item recognizer | `aiService.recognizeItem` | OpenAI Vision call returning the same `ItemRecognitionResult` |
| Voice input | `voiceService.transcribe` | `expo-speech-recognition` or similar |
| Multi-user sync | (not implemented) | repositories already return plain DTOs — wrap with a sync layer |

## Philosophy reminders

- Never block the user.
- Never punish missing data.
- Confidence words > exact counts.
- Big touch targets. Dark by default.
