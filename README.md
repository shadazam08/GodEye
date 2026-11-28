# GodEye

**Know the road ahead.**

A community-powered road hazard reporting and route-awareness platform, available on the web and as an Android application.

**Team:** Midnight Tigers  
**Team Lead:** Shad Azam  
**Initial focus:** Darbhanga, Bihar, India  
**Platforms:** Mobile-first web application and Android APK  
**Submission date:** 28 November 2026  
**Submission deadline:** Before 11:30 PM IST (UTC+05:30)

> **Project status:** The web application is live and an Android APK is available. GodEye includes photo-based reporting, account-based admin review, repair tracking, route planning and Hindi/English voice alerts. Alert availability depends on location quality, device permissions and an active foreground session.

## Contents

1. [Project overview](#project-overview)
2. [Team](#team)
3. [Project and submission links](#project-and-submission-links)
4. [Android application](#android-application)
5. [Implemented features](#implemented-features)
6. [Roles and user journeys](#roles-and-user-journeys)
7. [Architecture and technology](#architecture-and-technology)
8. [Data and API](#data-and-api)
9. [Voice-alert decision rules](#voice-alert-decision-rules)
10. [Local setup](#local-setup)
11. [Configuration](#configuration)
12. [Android cloud build](#android-cloud-build)
13. [Testing](#testing)
14. [Deployment](#deployment)
15. [Privacy and security](#privacy-and-security)
16. [Limitations and future work](#limitations-and-future-work)
17. [Visual identity and license](#visual-identity-and-license)

## Project overview

Road damage can be difficult to notice during rain, fog, darkness or unfamiliar travel. GodEye lets people report a damaged road with photo evidence and a map location. An authorized admin reviews the evidence before the record becomes a verified hazard. Drivers can choose a destination, view a road route and see verified, unrepaired reports near that route.

The application helps road users anticipate previously reported damage and follow its review and repair progress. It uses mapped community reports, location data and route geometry to assess whether a report may be relevant to a journey.

Voice-alert timing depends on location quality, movement metadata and route assessment. The original idea of a 50-metre warning is a project goal, not a guaranteed detection distance. GodEye works from previously reported road damage; it does not detect unseen potholes through a driver's camera.

## Team

| Member | Role |
| --- | --- |
| Shad Azam | Team Lead |
| Anil Kumar | Team Member |
| Rohit Kumar | Team Member |
| Rishav Raj Sing | Team Member |
| Bulbul Gajbhiye | Team Member |

## Project and submission links

| Resource | Link |
| --- | --- |
| Live web application | [Open GodEye](https://god-eye-eight.vercel.app/) |
| Android application | [Download GodEye.apk](https://github.com/shadazam08/GodEye/releases/download/android-v1.0.0/GodEye.apk) |
| Source code | [GitHub — shadazam08/GodEye](https://github.com/shadazam08/GodEye) |
| Backend health | [API health check](https://godeye-api.vercel.app/api/health) |
| Instagram launch film | [Watch the GodEye Reel](https://www.instagram.com/reel/DgRwQL5i_PP/) |
| Project presentation | [Download the PowerPoint](https://github.com/user-attachments/files/35541869/GodEye-Project.Submission.pptx) |
| Project video folder | [Open the Google Drive folder](https://drive.google.com/drive/folders/1YRhirz0ghaNwUf4vdI8Gliufn3TeUGBY?usp=sharing) |

**Buildathon hashtags:** `#TutedudeBuildathon` `#BuildForMyCity`

## Android application

The Android application packages the React interface with Capacitor and connects to the deployed backend. It uses native Google sign-in, native camera capture and Android text-to-speech alongside the shared reporting and route logic.

| Property | Value |
| --- | --- |
| App name | GodEye |
| Android application ID | `com.midnighttigers.godeye` |
| Minimum Android version | Android 7.0 / API 24 |
| Framework | Capacitor 8 with React and TypeScript |
| Distribution | Signed APK through GitHub Releases |
| Android source branch | `android-app` |
| Speech languages | Hindi and English |

### Install and use

1. Download the APK using the link above on an Android phone.
2. Open the downloaded file. If Android asks, permit installation from the browser or file manager used for this download.
3. Install and open GodEye.
4. Allow location for the moving map. Allow camera access when submitting a report.
5. Search for a destination, select the vehicle and request a route.
6. Keep the application visible while using route and voice features.

An internet connection is required for maps, Google sign-in, route planning, report loading and report submission. Speech also requires a working text-to-speech engine and the selected language to be available on the phone. Check media volume if alerts are silent.

The APK can be installed directly; the application is not currently distributed through Google Play or the Apple App Store.

## Implemented features

| Area | Current behavior |
| --- | --- |
| Account access | Google sign-in through Firebase Authentication; native Google sign-in on Android. The backend verifies the Firebase token. |
| Public map | Leaflet map with severity markers, a current-location indicator and permission-based location updates while the application is active. |
| Report submission | Signed-in user submits report details, a map point and a compulsory JPEG/PNG photo in one multipart request. |
| Camera | Browser camera capture on the web and Capacitor camera capture on Android. Camera access requires permission. |
| Image handling | Server validates actual image contents, applies EXIF orientation, removes metadata and prepares a resized JPEG. |
| Evidence storage | Cloudinary authenticated storage with authorized temporary photo previews. |
| My Reports | Automatically loads the current user's reports with images, location and review/repair state. |
| Admin access | Backend checks database account role for protected review, evidence and repair actions. |
| Moderation | Admin verifies or rejects a pending report and records a reason and review history. |
| Repairs | Admin confirms a repair. The record remains in history while active hazard queries exclude repaired reports. |
| Destination and route | Geoapify destination search and route planning for car or motorcycle. |
| Route proximity | Highlights verified, unrepaired reports within approximately 40 m of the planned route line. |
| Route order | Estimates earlier/later route positions and blocks ambiguous or invalid projections. |
| Voice settings | Hindi by default; mute/unmute, Hindi/English selection and locally saved preferences. Android uses native text-to-speech; the web uses browser speech. |
| Route-aware alerts | Candidate selection combines route position, location quality, speed and heading. Repeat suppression and cooldown rules apply. |
| Data refresh | Visible map refreshes report data every 60 seconds and on return/reconnection. |

## Roles and user journeys

### Visitor / driver

1. Open the map. Login is not required merely to explore public hazards.
2. Allow location if desired. The map remains available when location permission is denied.
3. Search for a destination and confirm the full address.
4. Choose Car or Bike and request the route.
5. Review route distance, estimated time and nearby road reports.
6. Keep the application visible for location updates and voice alerts. Use mute or language controls when needed.

The mobile interface keeps destination and route controls together above the map. Buttons distinguish **Edit destination**, **Change vehicle** and **My location**.

### Registered reporter

1. Sign in with Google.
2. Stop in a safe place before taking a photo.
3. Capture road damage and confirm the selected map point.
4. Enter the report title, landmark, description and estimated severity.
5. Submit once. A successful response means the report and evidence record have saved.
6. Open My Reports to follow its status.

A failed or timed-out request can have an uncertain outcome. Check My Reports before retrying.

### Admin

1. Sign in using an account that an authorized owner has assigned the database `admin` role.
2. Open `/admin`; the backend checks permissions for each protected request.
3. Inspect photos, location and description.
4. Verify or reject the report with a reason.
5. Confirm repairs through the protected repair workflow.

Admin access depends on the authenticated Firebase UID and the server-side account role. Public users cannot grant themselves admin access.

### Review and repair lifecycle

```mermaid
flowchart TD
    A[Report with photo] --> B[Pending review]
    B --> C[Verified]
    B --> D[Rejected]
    C --> E[Active map hazard]
    E --> F[Repair confirmation]
    F --> G[History retained; excluded from active hazards]
```

Review status and repair state are separate. A verified report remains `verified`; its non-null `repaired_at` indicates confirmed repair. Rejection and repair do not delete the user's report.

## Architecture and technology

```mermaid
flowchart TD
    A[React web application] --> C[FastAPI on Vercel]
    B[Capacitor Android application] --> C
    A --> D[Firebase Authentication]
    B --> D
    C --> E[Neon PostgreSQL]
    C --> F[Cloudinary evidence storage]
    C --> G[Geoapify search and routing]
```

| Layer | Technology | Purpose |
| --- | --- | --- |
| Client | React, TypeScript, Vite | Responsive application and typed UI |
| Styling | CSS, project brand styles | Navy, ice-blue and muted-gold identity |
| Mapping | Leaflet, OpenStreetMap tiles/data | Basemap, route geometry and hazard markers |
| Web APIs | Geolocation, MediaDevices, SpeechSynthesis | Location updates, browser camera capture and browser speech |
| Android runtime | Capacitor 8 | Packages the shared React application as an APK |
| Native Android features | Firebase Authentication, Camera and Text-to-Speech plugins | Native sign-in, photo capture and Hindi/English speech |
| Backend | Python, FastAPI | Validation, authorization and workflows |
| Persistence | Neon PostgreSQL, SQLAlchemy, psycopg | Accounts, reports, evidence metadata and history |
| Schema changes | Alembic | Versioned database migrations |
| Identity | Firebase Authentication / google-auth | Google login and server token validation |
| Evidence | Cloudinary, Pillow, python-multipart | Private images and validated uploads |
| Navigation | Geoapify through backend HTTP requests | Destination search, routing and matching services |
| Hosting | Vercel frontend and backend projects | HTTPS deployment from `main` |

Route-distance and ordering calculations run in TypeScript. The backend stores records in PostgreSQL and handles provider requests. Private provider credentials stay on the backend. The current location hook uses the browser/WebView Geolocation API; installing the Capacitor Geolocation package alone does not provide background tracking.

### Project structure

```text
GodEye/
  .github/
    workflows/android-apk.yml # Android cloud build
    signing/                 # Encrypted signing-key backup
  backend/
    main.py
    models.py
    schemas.py
    database.py
    user_auth.py
    security.py
    requirements.txt
    alembic.ini
    migrations/versions/
    services/               # Account, map and image services
    tests/                  # Backend validation and authorization tests
  frontend/
    android/                # Native Android project
    capacitor.config.ts
    public/brand/
    src/
      api/                  # Account, reports, photos, admin, navigation
      components/           # Map, reporting, admin, camera and voice UI
      hooks/                # Authentication and live location
      lib/                  # Firebase, platform login and native adapters
      types/
      utils/                # Geographic, route and voice eligibility logic
      App.tsx
      App.css
      brand.css
      brand-theme.css
    tests/
    package.json
    package-lock.json
    vercel.json
```

Generated archives, `.venv`, `node_modules`, build output and plaintext credentials stay outside version control. Android Gradle wrapper files and source resources are part of the native project. The encrypted signing backup is retained separately from its decryption secret.

## Data and API

### Core entities

| Entity | Purpose |
| --- | --- |
| AppUser (`users`) | Firebase UID, email/display name, `user`/`admin` role |
| Report (`reports`) | Reporter UID, text, coordinates, severity, review status, timestamps and repair indicator |
| ReportPhoto (`report_photos`) | Cloud asset metadata, dimensions, byte size, owner and report link |
| ReviewEvent (`review_events`) | Review decision, reason, timestamp and available admin identity |
| RepairConfirmation | Report-linked repair confirmation and its audit details |

Older review events may lack a linked admin account. Their original reviewer labels remain in the audit history. The alert logic does not require storing a full travel history.

### Main application endpoints

| Method | Endpoint | Access / purpose |
| --- | --- | --- |
| GET | `/api/health` | Basic service health |
| GET | `/api/hazards` | Public, paginated verified and unrepaired records |
| GET | `/api/me` | Authenticated account identity and database role |
| GET | `/api/my/reports` | Current authenticated user's reports |
| POST | `/api/reports` | Verified user; multipart `payload` JSON text and required `file` |
| POST | `/api/reports/{report_id}/photos` | Authorized owner; pending-report additional photo |
| GET | `/api/reports/{report_id}/photos` | Owner's evidence list |
| GET | `/api/reports/{report_id}/photos/{photo_id}/preview` | Authorized owner preview |
| GET | `/api/admin/reports` | Admin review lists |
| PATCH | `/api/admin/reports/{report_id}/review` | Admin review decision |
| GET | `/api/admin/reports/{report_id}/history` | Admin review history |
| GET | `/api/admin/reports/{report_id}/photos` | Admin evidence list |
| GET | `/api/admin/reports/{report_id}/photos/{photo_id}/preview` | Admin preview |
| POST | `/api/admin/reports/{report_id}/repair` | Admin repair confirmation |
| GET | `/api/navigation/destinations?q=...` | Destination search |
| POST | `/api/navigation/route` | Road route request |

The FastAPI schema documents request and response formats. Map-matching utilities are separate from the driver-facing route planning interface.

### Image rules

- Required first evidence image on new report submission.
- Maximum raw upload: **3 MiB** per image.
- Supported content: JPEG and PNG; actual server decoding determines validity.
- Reject animation, malformed files and input above **20 million pixels**.
- Apply orientation and resize to a maximum output side of **1600 px**.
- Strip metadata and normalize to JPEG.
- Existing pending reports support up to **3 report photos** in total.
- Cloud storage and PostgreSQL cannot share one atomic transaction. Cleanup handles confirmed pre-commit failures; uncertain provider/commit outcomes need follow-up.
- A valid photo file is not proof that it depicts a real pothole at the submitted location.

## Voice-alert decision rules

The feature announces reported road damage **near the planned route**. It does not prove the report lies on the user's exact carriageway.

A candidate requires an active, visible session, available report data, a usable route and fresh location. The helper then checks verified/unrepaired status, route ordering, distance and approach direction.

### Current thresholds

| Check | Setting / behavior |
| --- | --- |
| Route proximity highlight | About 40 m from the route line |
| Location age for approach | At most 15 seconds |
| Approach accuracy | At most 25 m reported accuracy |
| Movement speed | At least 1 m/s with valid speed metadata |
| Heading | Valid heading and at most 45 degrees difference to the hazard bearing |
| Candidate distance | Within 200 m by approach and along-route checks |
| Repeat suppression | A confirmed announcement is suppressed in that route session; browser confirmation occurs at speech start, Android confirmation after completed playback |
| Global cooldown | 25 seconds after the platform confirms an announcement |
| Speech preferences | Hindi default; mute and language saved locally when storage is available |
| Speech activation | Browser playback may require a user interaction; Android uses its text-to-speech engine with initialization and language checks |

The nearest eligible report supplies the candidate. Playback confirmation updates the announced set; on Android, cancelled or incomplete speech does not consume that confirmation. Route changes reset the route-session set. Hidden-page, stale-location, invalid direction and missing-speed conditions block candidates. A 1-second timer and visibility events reassess conditions. These settings are implementation thresholds, not field-validated warning distances.

## Local setup

### Prerequisites

- Git and Node.js compatible with the Vite project; the development environment uses Node.js 24.
- Python 3.14, matching `backend/.python-version`.
- A Neon PostgreSQL database, Firebase project with Google sign-in, Cloudinary account and Geoapify API key.
- VS Code or another editor. Docker is not required for this deployment.

### Clone and install

```bash
git clone https://github.com/shadazam08/GodEye.git
cd GodEye
cd frontend
npm ci
cd ../backend
```

These commands install the web application from the repository's default branch. For Android source and cloud builds, use the `android-app` branch described below.

Windows CMD:

```bat
py -3.14 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m pip check
```

Git Bash uses `./.venv/Scripts/python.exe` instead of CMD's backslash path. Use the virtual environment's explicit executable if `py` selects an environment without dependencies.

### Database and backend

Create the backend `.env` with your own values, then run from `backend`:

```bat
.\.venv\Scripts\python.exe -m alembic upgrade head
.\.venv\Scripts\python.exe -m alembic current
.\.venv\Scripts\python.exe -m uvicorn main:app --reload
```

Backend: `http://127.0.0.1:8000`. Basic check: `/api/health`.

Apply the checked-in migrations before starting the application against a new database. New accounts default to `user`. The project owner assigns the first admin role through a controlled database operation for a known Firebase UID.

### Frontend

Create `frontend/.env.local`, then in a separate terminal:

```bat
cd C:\project\GodEye\frontend
npm run dev
```

Frontend normally runs at `http://localhost:5173`. Keep both terminals running for local development. For real phone camera/location testing, use the HTTPS deployment rather than assuming an HTTP LAN address supports these APIs.

## Configuration

Create the following environment files using your own provider configuration.

Backend `.env`:

```dotenv
DATABASE_URL=postgresql+psycopg://USER:PASSWORD@POOLED_HOST/DATABASE?sslmode=require
MIGRATION_DATABASE_URL=postgresql+psycopg://USER:PASSWORD@DIRECT_HOST/DATABASE?sslmode=require
FIREBASE_PROJECT_ID=YOUR_FIREBASE_PROJECT_ID
CLOUDINARY_CLOUD_NAME=YOUR_CLOUD_NAME
CLOUDINARY_API_KEY=YOUR_API_KEY
CLOUDINARY_API_SECRET=YOUR_API_SECRET
GEOAPIFY_API_KEY=YOUR_GEOAPIFY_KEY
```

Frontend `.env.local`:

```dotenv
VITE_API_BASE_URL=http://127.0.0.1:8000
VITE_FIREBASE_API_KEY=YOUR_PUBLIC_WEB_CONFIG_KEY
VITE_FIREBASE_AUTH_DOMAIN=YOUR_PROJECT.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=YOUR_FIREBASE_PROJECT_ID
VITE_FIREBASE_APP_ID=YOUR_FIREBASE_APP_ID
```

For production, set `VITE_API_BASE_URL=https://godeye-api.vercel.app` and keep Firebase web settings consistent with the deployed project. Configure the live frontend domain as an authorized Firebase domain and a permitted backend CORS origin. Vite embeds `VITE_` values at build time, so rebuild/redeploy after changing them.

Do not place database credentials, Cloudinary API secrets, Geoapify server keys, service-account files or Firebase ID tokens in frontend source or Git. Firebase web configuration is client configuration and does not grant admin access; database roles and backend token checks enforce permissions. Admin permissions come from the database account role.

## Android cloud build

The checked-in GitHub Actions workflow builds the APK in the cloud. Android Studio, a local Android SDK and Docker are not required for this workflow.

### Source and web assets

From the repository root, use the Android branch and install its locked dependencies:

```bash
git switch android-app
cd frontend
npm ci
npm run lint
npm run build
npx cap sync android
```

`npm run build` creates the web assets in `dist`; `npx cap sync android` copies them into the Android project and updates plugins. These commands alone do not produce an APK. The GitHub Actions workflow performs the native build and signing.

### Firebase and build configuration

For an independent build, register an Android application in your Firebase project using `com.midnighttigers.godeye`, enable Google sign-in, and provide the matching Android configuration through repository secrets. The APK signing-certificate fingerprints must match those registered in Firebase; include the matching web OAuth client configuration.

The workflow uses these GitHub Actions secrets:

| Secret | Purpose |
| --- | --- |
| `GOOGLE_SERVICES_JSON` | Firebase Android configuration supplied during the build |
| `VITE_FIREBASE_API_KEY` | Firebase web configuration used by the React application |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase authorized authentication domain |
| `VITE_FIREBASE_PROJECT_ID` | Firebase project shared by the web and Android configuration |
| `VITE_FIREBASE_APP_ID` | Firebase web application ID |
| `ANDROID_KEYSTORE_PASSWORD` | Unlocks the project's encrypted signing backup and keystore |

The workflow supplies `VITE_API_BASE_URL=https://godeye-api.vercel.app`. If building against another backend, update that build setting and configure its permitted web and Android origins.

### Build and distribute

1. Push the intended changes to `android-app`, or run **GodEye - Build Android APK** from GitHub Actions using that branch.
2. The workflow installs dependencies with Node.js 24 and uses Java 21 for the Android build.
3. It checks the frontend, builds the React assets, synchronizes Capacitor and builds the Android release.
4. It decrypts the signing material on the runner, signs the APK and verifies the signing certificate against the Firebase configuration.
5. Download the generated APK artifact after a successful run.
6. Attach the chosen APK to a GitHub Release for a stable public download link. The README download link points to a release, not a temporary workflow artifact.

Keep the original signing key and its password backed up securely; updates must use the matching signing identity. Never commit an unencrypted keystore, signing password, service-account private key or local signing-backup directory. An independent fork needs its own signing setup and corresponding Firebase fingerprints.

Changing the live Vercel frontend does not replace the web files already bundled inside an installed APK. Rebuild, synchronize and distribute an updated APK when bundled frontend or native code changes.

## Testing

Frontend:

```bash
cd frontend
npm run lint
npm run build
node --test
```

### Frontend validation results

The lint and production-build results below were reported on **27 November 2026**. The **66 geographic, route and voice-decision tests** were rerun successfully on **28 November 2026**. These results cover the tested baseline and do not certify every device or APK build.

| Check | Result |
| --- | --- |
| ESLint | Passed |
| TypeScript and production build | Passed |
| Geographic and approach tests | 22 passed |
| Route proximity, location and ordering tests | 32 passed |
| Voice eligibility and cooldown tests | 12 passed |
| Total frontend tests | **66 passed, 0 failed** |

Backend, from `backend` in Windows CMD:

```bat
.\.venv\Scripts\python.exe -m pip check
.\.venv\Scripts\python.exe -m unittest discover -s tests -p "test_*.py" -v
```

Backend tests cover admin access boundaries, map-provider handling, image validation, storage responses, cleanup and photo endpoints. Run the complete backend suite after changes to services or API workflows.

Build and test results apply to the exact source revision and dependency lockfile used. The Android application also needs a successful native build and device checks; a passing web build alone does not validate the installed APK.

### Mobile integration testing

- Hindi and English speech in supported browsers and the Android application.
- Android text-to-speech initialization, installed language data and media volume.
- Native Google sign-in and camera capture with the release signing identity.
- Muting a current utterance and unmuting without stale preferences.
- Browser sound restrictions and the Enable sound fallback.
- Saved preference persistence after reload; storage-disabled fallback.
- GPS accuracy, absent heading/speed, wrong direction and route departure.
- Route changes, repeat suppression and candidate cancellation.
- Background/foreground transitions, screen locking and network loss.
- Multi-account permission checks against the live backend.

Unit tests cover geographic and alert-decision logic. Device checks separately assess speech playback, GPS quality and operating-system interruptions. Use isolated test data rather than publishing synthetic reports as active public hazards. Conduct movement checks as a passenger or in a controlled setting.

## Deployment

1. Work on `dev` and stage only intended files.
2. Run appropriate frontend/backend checks and inspect staged changes.
3. Push `dev`, open a pull request and merge into `main`.
4. Vercel frontend project `god-eye` builds `frontend`, output `dist`.
5. Backend project `godeye-api` serves the FastAPI application from `backend`.
6. Confirm both deployments use the intended `main` commit and environment.
7. Apply database migrations deliberately against the intended Neon database.
8. Check health, login, camera/report, private images, admin access and repair exclusion live.

The frontend SPA rewrite sends application routes such as `/my-reports` to `index.html`. Keep Firebase authorized domains and backend CORS origins aligned with the live domain. For the configured Android WebView, permit the intended `https://localhost` origin on the backend as well. Validate database writes and provider-backed operations in addition to the health endpoint. Web deployment from `main` and Android builds from `android-app` are separate release steps.

## Privacy and security

- Backend validates Firebase tokens and checks database admin roles.
- Owner queries use the authenticated UID rather than a client-supplied owner ID.
- Cloudinary images use authenticated delivery and authorized preview endpoints.
- Application preference storage contains language and mute settings. Firebase Authentication manages its own sign-in persistence; the application does not add signed photo-preview URLs to preference storage.
- Upload processing strips metadata. Automatic face/number-plate redaction is not implemented.
- Provider requests disclose necessary locations/destinations to the map service. Review provider terms before a broader launch.
- A broader production rollout requires rate limiting, monitoring, backup/recovery checks and independent security review.
- GodEye is an independent project with no government affiliation or mandatory installation requirement.

## Limitations and future work

### Current limits

- A precise 50 m warning is not guaranteed. GPS errors and delayed updates can exceed that distance.
- Nearby parallel roads, bridges, return paths and opposing carriageways remain difficult to distinguish reliably.
- Missing speed/heading correctly prevents an approach alert rather than fabricating direction.
- The map currently loads a bounded set of up to 200 reports. It is not a complete city-wide coverage guarantee.
- Polling introduces a delay before changes reach an already-open map.
- A hidden, locked or suspended browser/WebView cannot guarantee continuous location updates or warning playback. The current APK does not implement a background driving foreground service.
- Geoapify, map tiles, identity and image services have availability and quota limits.
- Automatic route recalculation, arrival handling, complete offline operation and turn-by-turn guidance are outside the current implemented scope.
- Automated AI pothole detection and depth estimation are not implemented. No accident-reduction outcome has been measured.

### Future work

Priorities include wider Android and browser field testing, stronger same-road matching, alert-quality measurement, improved geographic report queries, duplicate consolidation, accessibility and operational monitoring. Future research may evaluate AI image screening and depth estimation; these are not part of the current implemented detection workflow.

## Visual identity and license

The visual identity uses navy `#09131F`, surfaces `#132333`, ice blue `#A9E2EE` and muted gold `#E7BE83`. Hazard severity retains separate red/amber/green labels. Keep the GodEye logo proportions intact and preserve map attribution.

A project software license has not yet been selected. Third-party libraries, artwork and provider data retain their respective licenses and usage terms.
