# Do We Have It?

An ADHD-friendly household memory assistant. **Not** an inventory app. The goal is to reduce uncertainty ("do we have pickles?") with confidence-based answers — never to require perfect tracking.

This repo is a local-first React Native (Expo) proof of concept. There is no auth, no cloud sync, and no backend. Everything lives in on-device SQLite. The architecture is intentionally split into repositories and services so that household sync, cloud backup, and real vision/voice can drop in later without rewriting the UI.

## Tech

- Expo SDK 51
- React Native 0.74 + TypeScript
- `expo-camera` (barcode scanning, item photos)
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

## Barcode scanning (Open Food Facts)

The **+ In** and **− Out** flows on the home screen now open a small
method picker:

```
[ Scan barcode ]      (default — uses Open Food Facts)
[ Take a photo ]      (the existing image-recognition path)
[ Enter manually ]    (skip straight to confirm-item)
```

### How the lookup works

1. The barcode scanner uses `expo-camera`'s built-in barcode reader
   (EAN-13/8, UPC-A/E, Code 128, Code 39). The first valid scan is
   debounced via a ref so a rapid-fire callback can't double-fire.
2. The scanned code is sent to Open Food Facts v2:
   ```
   GET https://world.openfoodfacts.org/api/v2/product/{barcode}.json
   ```
   No API key, no auth, no backend in between.
3. The response is mapped into the existing item-confirmation shape —
   `product_name` → name, `brands` → manufacturer, `categories_tags`
   (most specific) → category, `packaging` → containerType, `quantity`
   → size — and the user lands on the confirm screen with a
   **Barcode matched** badge and the hint *"Review before saving —
   product databases can be incomplete."*
4. The user reviews/edits everything and taps **Confirm**. Nothing is
   saved until then.

### Failure handling

The user is never trapped on the scanner:

- **Barcode not in Open Food Facts** (status 0 or 404) → routes to
  confirm-item with a yellow note: *"Barcode 5000159484695 isn't in
  Open Food Facts. Fill in the details below."* The barcode is
  pre-filled so the next save still links the right physical SKU.
- **Network / timeout / malformed response** → same fallback, with
  the kind of failure noted, plus the **Take a photo instead** and
  **Enter manually** buttons remain visible on the scanner.
- **Camera permission denied** → permission-prompt screen with
  **Take a photo instead** / **Enter manually** / Cancel.

### Data the user should know about

- **Community data**: Open Food Facts is community-edited. Coverage
  and accuracy vary, especially outside packaged groceries. User
  confirmation is mandatory — there is no auto-save anywhere in the
  app.
- **What gets sent**: only the scanned barcode value goes to
  `world.openfoodfacts.org`. No photos, no location, no item history.
- **What gets stored**: a trimmed copy of the response lives next to
  the item row in `items.raw_lookup_json` so you can audit later.
  The DB stays on the device.
- **Barcode-first item matching**: when you scan the same product
  again (IN or OUT), it links to the same item even if the name in
  the DB drifted. Same product, same SKU.

## Push-to-talk voice commands

The home screen exposes a small **🎙 Voice command** chip. Tap it to open
a modal that turns a single utterance into an Ask/IN/OUT action. The
pipeline is intentionally tiny:

```
mic button → transcript → normalizer → regex intent parser → confirm card
                                                             ├─ ASK → confidence engine, inline answer
                                                             ├─ IN  → confirm-item (prefilled, direction=IN)
                                                             └─ OUT → confirm-item (prefilled, direction=OUT)
```

The user always sees a confirmation card with the parsed intent and item
before anything is saved.

### Supported phrasings

The regex parser handles common short imperatives and questions. Examples:

| Said | Intent | Item | Qty |
| --- | --- | --- | --- |
| `Add milk` | IN | milk | 1 |
| `I just bought milk` | IN | milk | 1 |
| `Add three apples` | IN | apple | 3 |
| `Picked up a dozen eggs` | IN | egg | 12 |
| `Remove two yogurts` | OUT | yogurt | 2 |
| `We're out of ketchup` | OUT | ketchup | 1 |
| `Scan out yogurt` | OUT | yogurt | 1 |
| `Used up the last of the milk` | OUT | milk | 1 |
| `Do we have eggs?` | ASK | egg | – |
| `Did we buy ketchup?` | ASK | ketchup | – |
| `Got any milk?` | ASK | milk | – |
| `Are we out of paper towels?` | ASK | paper towel | – |
| *(empty / nonsense)* | UNKNOWN | – | – |

The parser:
- expands contractions (`we're` → `we are`) so phrases like "we're out of"
  match the OUT pattern
- strips filler (`uh`, `um`, `like`, `please`) and connector tokens (`a`,
  `the`, `of`, `last`, `left`, `over`) so the residual is just the item
- recognizes digit *and* word quantities including `dozen`, `couple`, `pair`
- light singularization (`yogurts` → `yogurt`) so the confidence engine's
  `searchByName` finds the right row
- never auto-saves — UNKNOWN routes to a manual edit field; IN/OUT routes
  to the existing confirm-item screen (where you can still edit before tap
  Confirm)

### Speech-to-text path

v1 ships the entire pipeline with the speech-to-text layer behind a clean
`SpeechService` interface. The current implementation is a **manual text
fallback**: tapping the mic opens a small text field labelled *"What did
you say?"* — the user types what they would have spoken, and the parser
handles the rest exactly as it would for a real transcript.

To swap in real on-device speech recognition (e.g. via
`@jamsch/expo-speech-recognition`), implement the same `SpeechService`
interface in `src/services/voice/speechService.ts`. The rest of the
pipeline (normalizer, parser, confirm UI, dispatch) runs unchanged.

### Privacy

- The manual-text fallback never sends anything off-device.
- A future on-device recognizer would, by default, use the platform's
  built-in engine (iOS Speech framework / Android `SpeechRecognizer`).
  Some Android OEM builds route through Google's servers; this would be
  documented at the moment the real recognizer ships and surfaced in the
  Settings → Voice command card.

## Building an Android APK (GitHub Actions, direct Gradle)

The primary CI path is a `workflow_dispatch`-only GitHub Actions job that
runs `expo prebuild` and `./gradlew assembleRelease` directly on a
GitHub-hosted Ubuntu runner. **No EAS Build minutes are consumed.** The
APK is signed with the auto-generated debug keystore — fine for personal
sideloading, not for distribution.

### One-time setup

In **Settings → Secrets and variables → Actions**, add:

| Secret | Required | Purpose |
| --- | --- | --- |
| `EXPO_PUBLIC_OPENAI_API_KEY` | optional | OpenAI key the APK will use; leave blank for a mock-only APK |
| `EXPO_PUBLIC_OPENAI_MODEL` | optional | Override the default `gpt-4o-mini` |

> No `EXPO_TOKEN` needed — this workflow does not call `eas`.

### Triggering a build

1. Open **Actions → Build Android APK (direct, Gradle)**.
2. Click **Run workflow** → pick a branch → **Run workflow**.
3. The workflow runs, in order:
   - `actions/setup-node@v4` (Node 20) + `actions/setup-java@v4` (Temurin 17)
   - `android-actions/setup-android@v3` to accept SDK licenses
   - `npm ci`
   - captures build metadata: short SHA (`GITHUB_SHA::7`), workflow run
     number, ISO timestamp, and the `app.json` version
   - writes `.env` from the GitHub secrets **and** the build metadata
     above (`EXPO_PUBLIC_BUILD_COMMIT`, `EXPO_PUBLIC_BUILD_RUN`,
     `EXPO_PUBLIC_BUILD_TIME`). Secrets are never echoed; only their
     length is logged.
   - **`npm test -- --ci`** — the Jest suite is the gate; if it's red
     the workflow stops here and no APK is produced.
   - `npx tsc --noEmit`
   - `npx expo config --type prebuild`
   - `npx expo prebuild --platform android --non-interactive --clean`
   - `cd android && ./gradlew assembleRelease --no-daemon`
   - `actions/upload-artifact@v4` ships the APK under a
     version-tagged name (see below)
4. After ~10-15 minutes the workflow run's summary page has a
   **`dwhi-android-apk-0.1.0-<shortSha>`** artifact. Click it to
   download `app-release.apk` and sideload onto an Android device.

### Versioning + build metadata in Settings

Every build stamps a small **Build** card at the top of Settings:

```
App version    0.1.0
Build commit   a1b2c3d   (or "local" for dev / expo start)
Build run      42        (workflow run number, "dev" locally)
Build time     2026-05-14T18:23:11Z
```

The same fields land in the artifact name so you can correlate an
installed APK with a workflow run at a glance. To cut a new test build:

1. Bump `expo.version` in `app.json` (e.g. `0.1.0` → `0.1.1`).
2. If you're shipping the APK to multiple devices or expect Android
   to do an in-place upgrade, also bump `expo.android.versionCode`
   (must be a higher integer than every previous build).
3. Commit and push, then re-trigger the workflow. The new artifact's
   name will reflect the new version.

### Exact artifact location

- **Inside the runner**: `android/app/build/outputs/apk/release/app-release.apk`
- **In the GitHub UI**: workflow run page → **Artifacts** section →
  click **`dwhi-android-apk`** → downloads a zip containing
  `app-release.apk`. Retention: 14 days.

### ⚠️ Security & key rotation

The APK ships with `EXPO_PUBLIC_OPENAI_API_KEY` inlined into the JS
bundle. Anyone with the APK can extract the key.

- **Do not distribute** the APK. Install it only on devices you control.
- **Rotate the key when you're done** — revoke at
  https://platform.openai.com/api-keys and update the GitHub secret
  before kicking off another build.
- Settings inside the app shows only the **last 4 characters** of the
  key for verification — never the full value. CI logs print only the
  key length.

### Optional: EAS Build (older workflow)

A second workflow, **Build Android APK (EAS, preview)**, still exists for
users with EAS already configured. It produces the same kind of APK but
uses Expo Application Services and consumes EAS Build minutes — so we
no longer recommend it as the default. If you choose to use it, see the
required `EXPO_TOKEN` setup, EAS env-var visibility notes, and the
`eas env:create` flow in the workflow file
(`.github/workflows/android-apk.yml`).

## Building an Android APK (EAS Build, CI) — legacy/optional

A `workflow_dispatch`-only GitHub Actions workflow drives an EAS Build that
produces a single installable Android APK for personal testing. There is no
automatic trigger.

### One-time setup

1. Create an Expo account at https://expo.dev and a project for this repo:
   ```bash
   npx eas-cli@latest init
   ```
   This adds `expo.extra.eas.projectId` to `app.json` — commit that change
   to the default branch.
2. Generate a personal access token at
   https://expo.dev/accounts/[username]/settings/access-tokens
3. In **GitHub → Settings → Secrets and variables → Actions**, create:

   | Secret | Required | Purpose |
   | --- | --- | --- |
   | `EXPO_TOKEN` | yes | Authenticates EAS CLI in the workflow |
   | `EXPO_PUBLIC_OPENAI_API_KEY` | optional | OpenAI key the APK will use; leave blank for a mock-only APK |
   | `EXPO_PUBLIC_OPENAI_MODEL` | optional | Override the default `gpt-4o-mini` |

   None of these are echoed to the workflow log; GitHub Actions masks any
   value matching a registered secret in step output.

### Triggering a build

1. Go to **Actions → Build Android APK (EAS, preview)**.
2. Click **Run workflow** → pick a branch → **Run workflow**.
3. The workflow runs, in order:
   - `npm ci`
   - pushes each value into EAS as a managed env var for the `preview`
     environment via `eas env:create --force`. The API key uses
     `--visibility sensitive`; the model name uses `--visibility plaintext`
     (see the visibility note below).
   - `npx tsc --noEmit`
   - `npx expo config --type prebuild`
   - `eas build --platform android --profile preview --non-interactive`
4. After ~15-25 minutes, the workflow log prints the build URL like
   `https://expo.dev/accounts/<your-account>/projects/dwhi/builds/<uuid>`.

### How the OpenAI key reaches the APK

The flow is **EAS-native**, not `.env`-based:

1. The workflow calls `eas env:create --environment preview` to register
   each value on Expo's servers, scoped to the project. The key uses
   `--visibility sensitive`, the model uses `--visibility plaintext`
   (see below).
2. When EAS spins up the build worker, it populates `process.env` with
   the `preview` environment's variables **before** Metro starts.
3. `app.config.js` runs on that worker, reads
   `process.env.EXPO_PUBLIC_OPENAI_API_KEY`, and copies it into
   `expoConfig.extra.openaiApiKey`. The model name follows the same
   path. Safe diagnostics (length only, never the value) are logged.
4. Expo bakes `expoConfig.extra` into the APK's manifest. The app reads
   it via `Constants.expoConfig.extra.openaiApiKey` first in
   `src/services/env.ts`, falling through to `manifest2.extra.expoClient.extra`
   and `manifest.extra` so production APK builds without expo-updates
   still resolve correctly.

For local development (`npx expo start`), Expo CLI reads `.env` directly
and populates `process.env.EXPO_PUBLIC_*` for Metro — the fallback path
in `env.ts` picks that up. `.env` is gitignored and never committed.

### Why `--visibility sensitive`, not `secret`?

EAS rejects `--visibility secret` for any variable whose name begins with
`EXPO_PUBLIC_`. The reasoning is structural:

> "Variables prefixed with `EXPO_PUBLIC_` should never be considered as
> secret. Use plain text or sensitive visibility options for
> `EXPO_PUBLIC_` environment variables instead."

`EXPO_PUBLIC_*` values are **inlined into the JavaScript bundle that
ships in the APK** — anyone who can read the APK can recover them.
Calling that "secret" would be a false promise from EAS's side, so the
CLI blocks it.

What the three visibilities actually do for a build:

| visibility | EAS dashboard | EAS CLI `env:list` | injected into build worker |
| --- | --- | --- | --- |
| `plaintext` | shows value | shows value | yes |
| `sensitive` | value hidden | value hidden | yes |
| `secret` | encrypted; never readable | hidden | yes — **but rejected for `EXPO_PUBLIC_*`** |

We use:
- **`sensitive` for `EXPO_PUBLIC_OPENAI_API_KEY`** — keeps the value out
  of the dashboard / `env:list`, while accepting that the APK itself
  contains it.
- **`plaintext` for `EXPO_PUBLIC_OPENAI_MODEL`** — the model name isn't
  sensitive.

The GitHub Actions secret (`EXPO_PUBLIC_OPENAI_API_KEY` set under
**Settings → Secrets and variables → Actions**) still protects the key
inside GitHub: stored encrypted, never echoed in step logs, never visible
to repository readers. That layer is intact.

### APK link location

- **Workflow log**: the EAS step prints `Build details: <expo.dev URL>` and
  later `🚀 Android app: <signed APK URL>` once the build completes.
- **Expo dashboard**: navigate to
  `https://expo.dev/accounts/<your-account>/projects/dwhi/builds` — the
  most recent entry has a **Download** button under the **Artifacts**
  section.
- The APK is signed with an EAS-managed keystore (the same one used for
  every preview build, so app reinstalls don't clobber data between
  builds).

### ⚠️ Security & key rotation

This workflow produces an APK with `EXPO_PUBLIC_OPENAI_API_KEY` bundled
into the JavaScript. Anyone who has the APK file can extract the key.

- **Do not distribute** the APK. Install it only on devices you control.
- **Rotate the key when you're done** — revoke at
  https://platform.openai.com/api-keys and update the GitHub secret
  (and re-run the workflow once so the new key gets pushed via
  `eas env:create --force`) before installing a new build.
- The Settings screen in-app shows only the last 4 characters of the key
  for verification — it never prints the full value, and the GitHub
  Actions logs only print the **length**.
- For a real distribution build, move the OpenAI call behind a server
  proxy and drop `EXPO_PUBLIC_OPENAI_API_KEY` from the bundle entirely.

### Verifying the build picked up the key

After the workflow finishes:

1. Open the build log and look for two lines in the **Run EAS Build** step:
   ```
   [dwhi] OpenAI key present: yes (length 56)
   [dwhi] OpenAI model: default (gpt-4o-mini)
   ```
   These come from `app.config.js` and confirm the env reached the worker.
2. Install the APK on your device.
3. Open the app → **gear icon → Settings**:
   - **OpenAI receipt parsing: Enabled** (green)
   - **Key: …xxxx** (last 4 only)
4. From home, tap **Receipt** — the badge should say *"AI parsing on"*.

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
