# GodEye

**Know the road ahead.**

A community-powered road hazard reporting and route-awareness web application with experimental browser voice alerts.

**Team:** Midnight Tigers  
**Team Lead:** Shad Azam  
**Initial focus:** Darbhanga, Bihar, India  
**Platform:** Responsive web application, designed primarily for phone use

> **Project status:** A working web application with photo reporting, admin review, repair tracking, route planning and experimental voice alerts. The frontend passes lint, production build and 66 automated tests. Real-device validation of the latest voice and GPS behavior remains in progress.

## Contents

1. [Project overview](#project-overview)
2. [Team](#team)
3. [Links](#links)
4. [Implemented features](#implemented-features)
5. [Roles and user journeys](#roles-and-user-journeys)
6. [Architecture and technology](#architecture-and-technology)
7. [Data and API](#data-and-api)
8. [Voice-alert decision rules](#voice-alert-decision-rules)
9. [Local setup](#local-setup)
10. [Configuration](#configuration)
11. [Testing](#testing)
12. [Deployment](#deployment)
13. [Privacy and security](#privacy-and-security)
14. [Limitations and future work](#limitations-and-future-work)
15. [Demo walkthrough](#demo-walkthrough)
16. [Visual identity and license](#visual-identity-and-license)

## Project overview

Road damage can be difficult to notice during rain, fog, darkness or unfamiliar travel. GodEye lets people report a damaged road with photo evidence and a map location. An authorized admin reviews the evidence before the record becomes a verified hazard. Drivers can choose a destination, view a road route and see verified, unrepaired reports near that route.

The application helps road users anticipate previously reported damage and follow its review and repair progress. It uses mapped community reports, location data and route geometry to assess whether a report may be relevant to a journey.

Voice alerts are experimental. Their timing depends on location quality, movement metadata and route assessment. GodEye does not guarantee a warning exactly 50 metres before a hazard or replace a driver's observation of road conditions.

## Team

| Member | Role |
| --- | --- |
| Shad Azam | Team Lead |
| Anil Kumar | Team Member |
| Rohit Kumar | Team Member |
| Rishav Raj Sing | Team Member |
| Bulbul Gajbhiye | Team Member |


## Links

- Web application: https://god-eye-eight.vercel.app/
- Backend health: https://godeye-api.vercel.app/api/health
- Repository: https://github.com/shadazam08/GodEye

## Implemented features

| Area | Current behavior |
| --- | --- |
| Account access | Google sign-in through Firebase Authentication. Backend verifies the Firebase token. |
| Public map | Leaflet map with reported severity markers and permission-based location updates. |
| Report submission | Signed-in user submits report details, a map point and a compulsory JPEG/PNG photo in one multipart request. |
| Camera | A browser camera preview captures a still image. Camera access requires permission and an available device. |
| Image handling | Server validates actual image contents, applies EXIF orientation, removes metadata and prepares a resized JPEG. |
| Evidence storage | Cloudinary authenticated storage with authorized temporary photo previews. |
| My Reports | Automatically loads the current user's reports with images, location and review/repair state. |
| Admin access | Backend checks database account role for protected review, evidence and repair actions. |
| Moderation | Admin verifies or rejects a pending report and records a reason and review history. |
| Repairs | Admin confirms a repair. The record remains in history while active hazard queries exclude repaired reports. |
| Destination and route | Geoapify destination search and route planning for car or motorcycle. |
| Route proximity | Highlights verified, unrepaired reports within approximately 40 m of the planned route line. |
| Route order | Estimates earlier/later route positions and blocks ambiguous or invalid projections. |
| Voice settings | Hindi default, mute/unmute, Hindi/English selection and preference storage in the same browser. |
| Experimental alerts | Candidate selection combines route position, location quality, speed and heading. Repeat/cooldown rules apply. |
| Data refresh | Visible map refreshes report data every 60 seconds and on return/reconnection. |

## Roles and user journeys

### Visitor / driver

1. Open the map. Login is not required merely to explore public hazards.
2. Allow location if desired. The map remains available when location permission is denied.
3. Search for a destination and confirm the full address.
4. Choose Car or Bike and request the route.
5. Review route distance, estimated time and nearby road reports.
6. Keep the page active for experimental location and voice behavior.

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
    A[React web client] --> B[FastAPI on Vercel]
    A --> C[Firebase Google sign-in]
    B --> D[Neon PostgreSQL]
    B --> E[Cloudinary evidence storage]
    B --> F[Geoapify search and routing]
```

| Layer | Technology | Purpose |
| --- | --- | --- |
| Client | React, TypeScript, Vite | Responsive application and typed UI |
| Styling | CSS, project brand styles | Navy, ice-blue and muted-gold identity |
| Mapping | Leaflet, OpenStreetMap tiles/data | Basemap, route geometry and hazard markers |
| Browser APIs | Geolocation, MediaDevices, SpeechSynthesis | Position, camera stills and speech |
| Backend | Python, FastAPI | Validation, authorization and workflows |
| Persistence | Neon PostgreSQL, SQLAlchemy, psycopg | Accounts, reports, evidence metadata and history |
| Schema changes | Alembic | Versioned database migrations |
| Identity | Firebase Authentication / google-auth | Google login and server token validation |
| Evidence | Cloudinary, Pillow, python-multipart | Private images and validated uploads |
| Navigation | Geoapify through backend HTTP requests | Destination search, routing and matching services |
| Hosting | Vercel frontend and backend projects | HTTPS deployment from `main` |

Route-distance and ordering calculations run in TypeScript. The backend stores records in PostgreSQL and handles provider requests. Private provider credentials stay on the backend.

### Project structure

```text
GodEye/
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
    public/brand/
    src/
      api/                  # Account, reports, photos, admin, navigation
      components/           # Map, reporting, admin, camera and voice UI
      hooks/                # Authentication and live location
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

Generated archives, `.venv`, `node_modules`, build output and credentials should remain outside version control.

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

### Development thresholds

| Check | Setting / behavior |
| --- | --- |
| Route proximity highlight | About 40 m from the route line |
| Location age for approach | At most 15 seconds |
| Approach accuracy | At most 25 m reported accuracy |
| Movement speed | At least 1 m/s with valid speed metadata |
| Heading | Valid heading and at most 45 degrees difference to the hazard bearing |
| Candidate distance | Within 200 m by approach and along-route checks |
| Repeat suppression | A report whose speech started is suppressed in that route session |
| Global cooldown | 25 seconds between started report announcements |
| Speech preferences | Hindi default; mute and language saved locally when storage is available |
| Speech activation | A user action such as Show route attempts activation; Enable sound appears if needed |

The nearest eligible report supplies the candidate. Speech-start confirmation updates the announced set. Route changes reset the route-session set. Hidden-page, stale-location, invalid direction and missing-speed conditions block candidates. A 1-second timer and visibility events reassess conditions. These development values are not validated road-safety recommendations.

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

Do not place database credentials, Cloudinary API secrets, Geoapify server keys, service-account files or Firebase ID tokens in frontend source or Git. Admin permissions come from the database account role.

## Testing

Frontend:

```bash
cd frontend
npm run lint
npm run build
node --test
```

### Frontend validation results

As of 27 November 2026:

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

The production build currently emits a JavaScript chunk-size warning above 500 kB. Build output remains valid; route-based lazy loading is a planned optimization.

### Mobile integration testing

- Hindi and English speech on actual supported browsers.
- Muting a current utterance and unmuting without stale preferences.
- Browser sound restrictions and the Enable sound fallback.
- Saved preference persistence after reload; storage-disabled fallback.
- GPS accuracy, absent heading/speed, wrong direction and route departure.
- Route changes, repeat suppression and candidate cancellation.
- Background/foreground transitions, screen locking and network loss.
- Multi-account permission checks against the live backend.

Unit tests cover geographic and alert-decision logic. Device testing separately checks speech playback, GPS quality and browser interruptions. Conduct movement checks as a passenger or in a controlled setting.

## Deployment

1. Work on `dev` and stage only intended files.
2. Run appropriate frontend/backend checks and inspect staged changes.
3. Push `dev`, open a pull request and merge into `main`.
4. Vercel frontend project `god-eye` builds `frontend`, output `dist`.
5. Backend project `godeye-api` serves the FastAPI application from `backend`.
6. Confirm both deployments use the intended `main` commit and environment.
7. Apply database migrations deliberately against the intended Neon database.
8. Check health, login, camera/report, private images, admin access and repair exclusion live.

The frontend SPA rewrite sends application routes such as `/my-reports` to `index.html`. Keep Firebase authorized domains and backend CORS origins aligned with the live domain. Validate database writes and provider-backed operations in addition to the health endpoint.

## Privacy and security

- Backend validates Firebase tokens and checks database admin roles.
- Owner queries use the authenticated UID rather than a client-supplied owner ID.
- Cloudinary images use authenticated delivery and authorized preview endpoints.
- Local preferences store language and mute settings. Do not store tokens or signed preview URLs there.
- Upload processing strips metadata. Automatic face/number-plate redaction is not implemented.
- Provider requests disclose necessary locations/destinations to the map service. Review provider terms before a broader launch.
- A broader production rollout requires rate limiting, monitoring, backup/recovery checks and independent security review.
- GodEye is an independent project with no government affiliation or mandatory installation requirement.

## Limitations and future work

### Current limits

- GPS errors may exceed the proposed 50 m concept range.
- Nearby parallel roads, bridges, return paths and opposing carriageways remain difficult to distinguish reliably.
- Missing speed/heading correctly prevents an approach alert rather than fabricating direction.
- The map currently loads a bounded set of up to 200 reports. It is not a complete city-wide coverage guarantee.
- Polling introduces a delay before changes reach an already-open map.
- A hidden/locked/suspended browser cannot guarantee continuous warning playback.
- Geoapify, map tiles, identity and image services have availability and quota limits.
- Automatic route recalculation, arrival handling, complete offline operation and turn-by-turn guidance are outside the current implemented scope.
- Automated AI pothole detection and depth estimation are not implemented. No accident-reduction outcome has been measured.

### Future work

Prioritize real-device validation, stronger same-road matching and alert-quality measurement. Then evaluate improved hazard queries, duplicate consolidation, accessibility/localization, operational safeguards and licensed AI image screening. Keep AI predictions separate from admin decisions and report confidence separately from severity.

## Demo walkthrough

1. Show the live map and select a Darbhanga destination.
2. Explain route highlighting as proximity, not confirmed same-road detection.
3. Sign in, capture a test photo and submit a clearly labelled test report.
4. Show its persisted image and pending status in My Reports.
5. Use the authorized admin account to inspect evidence and record a decision.
6. Demonstrate repair status using test records and show retained history.
7. Show a regular account denied admin access.
8. Show voice preferences and the automated test results, and explain the current validation limits.

Do not verify synthetic reports as real public hazards. Use isolated test data and restore test records to an appropriate non-active state.

## Visual identity and license

The visual identity uses navy `#09131F`, surfaces `#132333`, ice blue `#A9E2EE` and muted gold `#E7BE83`. Hazard severity retains separate red/amber/green labels. Keep the GodEye logo proportions intact and preserve map attribution.

A project software license has not yet been selected. Third-party libraries, artwork and provider data retain their respective licenses and usage terms.
