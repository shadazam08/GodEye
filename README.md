# GodEye

**Know the road ahead.**

A proposed AI-assisted road hazard awareness web application that helps people discover, report, and receive proximity warnings about mapped potholes, while giving authorized reviewers tools to verify reports and track repairs.

> **Project scope:** A responsive website and web application built with React and TypeScript, a Python backend, and a geospatial database. No native mobile application is included. This README is an implementation blueprint, not a claim that the described features have already been built or validated. It contains no application code.

## 1. Project overview

GodEye addresses a practical urban problem: people often learn about road damage only when they reach it. Poor visibility during rain, fog, or darkness can make this harder. Potholes can contribute to crashes, vehicle damage, discomfort, and sudden evasive manoeuvres. This project does not claim that potholes cause most accidents or promise a particular reduction in crashes without supporting research.

GodEye combines a shared pothole map, citizen reporting, a verification workflow, browser-based proximity warnings, and AI-assisted image screening. Its central idea is to warn about previously mapped hazards even when the hazard itself is difficult to see.

**Project-manager explanation:** GodEye turns individual reports of damaged roads into a maintained map of road hazards. People can inspect the map before travelling and start an active browser session for proximity warnings. Reviewers check reports and update repair status. AI helps screen submitted photos; location and road matching determine when a mapped hazard is relevant to a traveller.

## 2. Goals and boundaries

### Goals

- Make reported and verified potholes easy to locate.
- Provide advance awareness of relevant, previously mapped hazards.
- Support photo-based reporting with minimal steps.
- Help reviewers identify duplicates and maintain reliable records.
- Track verification and repair progress transparently.
- Measure usefulness through field feedback and operational metrics.

### Boundaries

- GodEye does not guarantee detection of every pothole or prevention of a crash.
- A normal phone photo cannot reliably establish pothole depth or structural severity.
- A browser camera is not assumed to see potholes through fog, standing water, or heavy rain.
- Previously unknown hazards cannot trigger a map-based warning until recorded and distributed.
- Government partnership is a possible future direction, not an existing affiliation or a requirement for launch. There is no claim of mandatory installation.
- Native apps, vehicle integration, and automatic vehicle control are outside this website project.

## 3. Users and access

| Role | Main capabilities |
| --- | --- |
| Public visitor | Read the landing page, browse public hazard records and methodology |
| Registered citizen | Submit reports, view own reports, submit confirmations and repair evidence |
| Active travel user | Start and stop location sharing for browser-based warnings |
| Reviewer | Examine evidence, resolve duplicates, verify or reject reports |
| Administrator | Manage reviewer access, configuration, audit history and operational metrics |

Reviewer accounts belong to the project team unless a real organization has authorized its participation. Authorization must be checked by the backend for every protected action.

## 4. Recommended technology stack

These are design recommendations. Record actual package versions and provider choices when implementation begins.

| Layer | Choice | Responsibility |
| --- | --- | --- |
| Web interface | React + TypeScript | Responsive pages, forms, map controls and browser alert interface |
| Frontend tooling | Vite | Development and production frontend builds |
| Styling | CSS or Tailwind CSS | Consistent responsive components |
| API backend | Python + FastAPI | Authentication integration, reports, moderation and spatial queries |
| Database | PostgreSQL + PostGIS | Persistent records, road geometry, indexed location searches |
| Map interface | Leaflet with React integration | Render maps, markers, clusters and location overlays |
| Map tiles and road data | A selected, licensed provider | Basemap, road geometry and attribution; Leaflet itself does not supply these |
| Evidence storage | Private object storage | Store images securely and serve controlled derivatives |
| AI screening | Python image-processing worker | Evaluate submitted images asynchronously |
| Identity | An established authentication solution | Sign-in, account recovery and access control |
| Hosting | HTTPS frontend, Python service, worker and managed database | Public access, deployment, monitoring and backups |

An editor such as VS Code can be used for both the React and Python projects. React builds the user interface; Python handles backend processing and AI. They are complementary parts of this system.

## 5. System architecture

The browser requests reports and map data from the API. The API reads and writes PostgreSQL/PostGIS and controls access to image storage. An asynchronous worker processes submitted images and returns screening results for review. The browser receives nearby verified hazards and evaluates proximity locally during an active session.

Key decisions:

- Keep image processing outside the location-warning path.
- Cache a bounded set of upcoming hazards so each warning does not depend on a fresh server response.
- Use geospatial indexes and map bounds to avoid downloading the entire database.
- Keep raw citizen reports separate from canonical hazard records.
- Refresh cached records and invalidate repaired, rejected or expired hazards.
- Treat browser location, road matching and hazard freshness as separate confidence signals.

## 6. Website pages and design brief

### 6.1 Landing page — `/`

**Purpose:** Explain GodEye and direct people to useful actions.

Sections:

1. Header with logo and links to Map, Report, How It Works and Sign In.
2. Hero: “Know the road ahead.” Supporting text: “Explore reported potholes, contribute road evidence, and receive browser-based warnings about verified hazards.”
3. Primary action: “Explore Road Map.” Secondary action: “Report a Pothole.”
4. Problem explanation with local research, interviews or properly sourced data.
5. Three-step overview: Report → Verify → Inform.
6. Feature cards for map discovery, image screening, active-session warnings and repair tracking.
7. Product screenshots or actual interface previews, clearly labelled when illustrative.
8. Measured impact section only after evidence exists. Before then, show project goals instead of invented counters.
9. FAQ covering verification, browser limits, privacy and how to participate.
10. Footer with contact, privacy, accessibility, data attribution and independent-project status.

### 6.2 Road map — `/map`

- Map with marker clustering and a synchronized list view.
- Search by area; location button with explicit permission request.
- Filters for verification state, reported severity, freshness and repair status.
- Distinct symbols and text labels for pending, verified, disputed and repaired records.
- Hazard details: photo, approximate location, reported severity, verification date and status history.
- Empty, loading, permission-denied, provider-failure and network-error states.
- Display last refresh time and avoid exposing reporter identity or travel history.
- Actions to view details, submit evidence or begin active travel mode.

### 6.3 Report a pothole — `/report`

- Upload or capture a photo while stationary.
- Set location through permission-based geolocation or manual map placement.
- Confirm the map pin; image metadata alone is insufficient evidence of location.
- Optional description, road name and reported severity with an “Unknown” option.
- Show potentially matching nearby reports before creating another hazard.
- Submit to the backend; show “Submitted — awaiting review,” not “Verified.”
- Show image-screening progress and a clear failure state if screening is unavailable.
- Provide a report identifier and link to its status page.

### 6.4 Active travel mode — `/travel`

- Pre-trip setup with “Start Travel Mode” and “Test Audio” actions.
- Explain location access and active-page requirements before starting.
- Show current GPS quality, last location timestamp, network state and hazard-data freshness.
- Show the next relevant mapped hazard and an approximate distance.
- Use short audio and visual warnings; avoid interactions that demand attention while moving.
- Provide a prominent Stop action that ends location watching.
- On lost location or stale data, show “Warnings unavailable” or “Limited coverage” as appropriate.
- Treat a hidden page, locked screen or suspended browser as an interruption; reassess location and data before restoring active status.

### 6.5 My reports — `/my-reports`

List the signed-in user's reports, evidence, review decisions, timestamps and status history. Allow additional evidence and correction requests without silently replacing the audit history.

### 6.6 Hazard details — `/hazards/:id`

Show public evidence, verification state, approximate location, last checked date and repair history. Separate AI screening output from reviewer decisions. Allow repair evidence to be submitted for review.

### 6.7 Reviewer dashboard — `/admin`

Provide a moderation queue, evidence viewer, duplicate suggestions, status controls and audit trail. Show verified hazards by area, review backlog and ageing records. An assignment or repair-request status should be used only when an actual participating team owns that workflow.

### 6.8 Supporting pages

Sign-in, About/How It Works, Privacy, Accessibility and Contact. Publish measured results and methodology when available.

## 7. Suggested visual identity

Proposed direction, subject to original design work:

| Element | Proposal |
| --- | --- |
| Name | GodEye |
| Tagline | Know the road ahead. |
| Logo concept | Original eye shape combined with a road or location marker |
| Primary colour | Navy `#102033` |
| Action colour | Teal `#0F766E` |
| Warning colour | Amber `#F59E0B` |
| Critical marker | Red `#DC2626`, paired with a label and icon |
| Page background | Light grey `#F8FAFC` |
| Typography | A readable, properly licensed sans-serif font |

Use large controls, visible keyboard focus, accessible colour contrast and text alternatives. Keep map provider attribution visible. On narrow screens, use collapsible map details; on desktop, use a map and side panel. Do not rely on colour alone to communicate hazard state.

## 8. Warning logic and the 50-metre idea

“About 50 metres ahead” is a useful explanation of the concept, not a guaranteed detection range or a proven safe distance.

At 60 km/h, a vehicle travels 50 metres in approximately 3 seconds. A single fixed distance is therefore unsuitable for every speed, road, device and visibility condition.

Recommended workflow:

1. Obtain fresh location samples with permission.
2. Fetch verified, active hazards in a bounded area around the route or position.
3. Check sample age and reported accuracy; high-accuracy requests do not guarantee precise fixes.
4. Determine travel direction only when movement data is sufficient.
5. Match the user and hazard to the upcoming road segment when road geometry supports it.
6. Estimate distance along the road; avoid treating straight-line proximity as proof that a hazard is ahead.
7. Apply a configurable, field-tested warning threshold based on speed, uncertainty and processing delay.
8. Give one concise warning, such as “Mapped pothole ahead. Slow down when safe.”
9. Suppress repeated warnings until the hazard has been passed or a valid new approach occurs.
10. Suspend precise upcoming-road claims when heading or road matching is uncertain.

Nearby parallel roads, flyovers and opposite carriageways require explicit testing. If reliable matching is unavailable, display a lower-confidence “Reported hazard nearby” message rather than asserting that it is on the user's road. Do not use turn-by-turn avoidance instructions without an appropriately validated navigation system.

## 9. Browser capabilities and limits

- Location access requires user permission and, in normal deployment, HTTPS.
- Users can browse the map without granting location and place report pins manually.
- Background tabs can be throttled; browsers and operating systems may suspend pages. Continuous locked-screen warnings are not a supported guarantee.
- Audio can be blocked without user interaction. Test and activate it during pre-trip setup, and show failures honestly.
- Poor GPS, stale fixes, network loss and old hazard records can affect warnings.
- A cached hazard list can support limited operation during a connection interruption. It does not provide complete offline maps or ongoing location guarantees.
- Installing a website as a PWA does not remove these limitations. PWA packaging is optional and remains outside the core requirement.
- If the page resumes after interruption, reacquire a fresh fix and refresh records before showing normal coverage.

GodEye is an awareness aid. Keep interaction setup stationary or passenger-operated, and avoid encouraging sudden braking or swerving.

## 10. Reporting, verification and repair lifecycle

Keep incoming report review states separate from the lifecycle of a hazard:

| Record | Suggested states |
| --- | --- |
| Citizen report | Submitted, Under Review, Accepted, Rejected, Linked to Existing Hazard |
| Canonical hazard | Verified Active, Disputed, Repair Reported, Repaired, Archived |

An accepted report can create or strengthen a canonical hazard. AI output is supporting evidence, not automatic verification. Multiple reports can refer to one hazard. A repair claim requires evidence and review before the hazard is removed from active warning results. Reopen hazards when later evidence shows the problem persists.

Store reviewer, time, reason and supporting evidence for each state change. Define a reinspection policy for old hazards; confidence should reflect freshness, not only report count.

## 11. AI scope

The first AI feature should screen uploaded images for visible pothole-like road damage.

- Collect or select a dataset with documented usage rights and relevant road conditions.
- Split training, validation and test data by road or collection session to reduce leakage.
- Evaluate puddles, shadows, cracks, patched roads and low-light images as separate failure cases.
- Store model version, detection output and screening confidence.
- Keep model confidence separate from hazard verification confidence and severity.
- Do not infer exact depth or GPS coordinates from a single ordinary image.
- Allow reviewers to correct outputs and retain corrections for evaluation.
- Handle model outages without losing the original report.

A pretrained model is acceptable only after checking its licence and suitability. If AI is not implemented, label it as planned; do not present a fixed response or mock prediction as live analysis.

## 12. Core data model

| Entity | Important fields |
| --- | --- |
| User | Identifier, role, authentication reference, account timestamps |
| Report | Reporter, submitted point, location accuracy if available, description, reported severity, review state, optional hazard link |
| Hazard | Geographic point, optional road segment and direction, verification state, severity source, last checked date |
| Evidence | Storage key, owner, content type, review status, capture/upload timestamps where known |
| AI result | Evidence reference, model version, output, confidence, processing status |
| Review event | Actor, target, decision, reason, timestamp |
| Repair evidence | Hazard, submission, evidence references, review decision |

Use geospatial indexes for proximity queries. Store server timestamps and distinguish them from unverified client timestamps. Full travel history is not required for the core warning feature and should not be collected by default.

## 13. Backend responsibilities

These are proposed API capabilities, not implemented endpoints:

| Capability | Behaviour |
| --- | --- |
| Browse hazards | Filter by map bounds, state and freshness; paginate results |
| Nearby hazards | Return a bounded set of active verified records and refresh metadata |
| Submit report | Validate fields, authorize evidence attachment and prevent accidental duplicate submissions |
| Upload evidence | Enforce file limits, validate actual image content and protect storage access |
| My reports | Restrict private report access to its owner or authorized reviewer |
| Review report | Enforce reviewer role, save decision and link/create hazard transactionally |
| Repair review | Record evidence and update the hazard only after approval |
| AI processing | Queue work and expose processing state without blocking submission |
| Operational health | Report service readiness and dependencies without exposing secrets |

Validate permissions server-side, rate-limit abuse and record auditable moderation actions. Resolve concurrent edits explicitly rather than silently overwriting a newer decision.

## 14. Implementation roadmap

### Phase 1 — Validate and specify

Choose one pilot area. Interview road users, document existing pain points, identify lawful data sources and define supported browsers. Record the problem, proposed value, assumptions and acceptance criteria. Start the fresh repository and design files required by the event.

### Phase 2 — Build the working web core

Implement the React pages, FastAPI service, database, authentication, image storage, real report submission and moderation. Confirm that reports persist after refresh and that public records reflect actual reviewer decisions.

### Phase 3 — Add location awareness

Implement permission handling, active location watching, hazard queries, road relevance checks, audio setup, duplicate-warning suppression and interruption states. Validate in controlled, passenger-operated sessions.

### Phase 4 — Add AI screening

Integrate the image worker, expose screening state and test actual model outputs. Keep the review workflow usable when AI is uncertain or unavailable.

### Phase 5 — Operate a limited pilot

Deploy over HTTPS, establish backups, test recovery, monitor errors and review incorrect warnings. Expand coverage only after checking data quality and field results. A working event submission can cover a small area; production readiness requires additional evidence and operational work.

## 15. Acceptance and field-testing checklist

- A user can submit an actual report and see its persisted review state.
- A reviewer can verify, merge or reject it, with a recorded reason.
- Pending reports do not appear as verified warnings.
- A repaired hazard is excluded from active results and removed from refreshed caches.
- Denied location permission leaves manual map browsing usable.
- A stale or inaccurate fix never appears as precise live tracking.
- Wrong-road, opposite-direction and duplicate warnings are measured in controlled tests.
- Audio blocking, absent speed data, network failure and AI failure have clear fallbacks.
- Travel mode stops location watching when the user ends the session.
- Hidden-page and screen-lock behaviour is tested on actual supported devices and documented.
- API authorization prevents citizens from approving reports or reading other users' private information.
- Upload validation and data-deletion requests work.
- Keyboard access, mobile-browser layouts, error messages and map alternatives are checked.

Use unit tests for distance and state logic, integration tests for data and authorization, and end-to-end tests for reporting and review. Test travel behaviour using synthetic routes first, then controlled passenger-operated validation. Synthetic routes must be labelled; they do not prove field reliability.

## 16. Operational and privacy requirements

Serve traffic over HTTPS, keep credentials outside the frontend, restrict database access and use least-privilege storage permissions. Configure allowed frontend origins, upload limits and abuse controls. Use background workers with retry limits and observable failures.

Provide a privacy notice explaining location use, evidence retention, account data and deletion. Process travel location locally where practical. Remove unnecessary photo metadata from public copies and redact identifiable faces or number plates before publication. Restrict original evidence to appropriate reviewers.

Monitor API errors, AI queue failures, map-provider errors and stale-data rates. Maintain backups, rehearse restoration and keep a rollback procedure. Define who reviews urgent mistakes and who maintains hazards after the event.

## 17. Evidence and success measures

Measure useful behaviour before claiming public-safety impact:

- Accepted and rejected reports, verification turnaround and duplicate rate.
- Percentage of active hazards checked within the selected freshness policy.
- AI precision and recall on a held-out, relevant dataset.
- Missed warnings and false warnings in controlled sessions.
- Warning lead time, GPS accuracy and interruption frequency.
- User feedback and successful task completion.

Define how each metric is measured and its denominator. Do not infer accidents prevented from report counts, map views or warnings delivered. Distinguish measured, estimated, synthetic and planned information throughout the website and presentation.

## 18. Project management

Suggested allocation for a five-person team; combine roles according to skills:

| Owner | Main deliverables |
| --- | --- |
| Team lead / backend developer | Scope, API, data model, integration and submission tracking |
| Frontend developer | React pages, reporting and map interface |
| AI / geospatial developer | Image screening, location relevance and validation |
| Designer / researcher | Brand kit, accessible layouts, interviews and usability feedback |
| Video editor / storyteller | Launch film, explainer, original social content and evidence capture |

Each feature should have an owner, acceptance criteria, dependency and status. Review progress against working user journeys rather than the number of completed screens. Limit the initial coverage area before compromising verification or presenting unfinished features as complete.

## 19. CityFix submission alignment

Based on the attached **Problem Statement - CityFix** document:

- Submit a functional solution; static screens or this README alone do not satisfy the working-product requirement.
- Provide a public landing page and accessible product link wherever feasible.
- Include problem research, implementation decisions, limitations and future improvements.
- Provide source files and actual setup instructions once the implementation exists.
- Create an original brand kit as a PDF or Figma link.
- Produce a 60–90 second launch film.
- Produce a 2–3 minute explainer including the working solution; the document says there is no demo day.
- Create new project-named Instagram and X accounts and submit at least five posts.
- Use both `#TutedudeBuildathon` and `#BuildForMyCity`, and tag the organizers using their verified handles.
- Keep engagement organic and submit the required most-liked-post screenshot.
- Disclose libraries, datasets, APIs and AI tools, and respect their licences.
- Label synthetic or estimated data and do not claim unauthorized government affiliation.
- The supplied document states a final deadline of **28 November 2026, 11:59 PM**. It does not explicitly identify the deadline timezone; confirm that with the organizers.

The event requires original project work during its seven-day window and a fresh repository and design file from Day 1. Follow those requirements when building and documenting the product.

## 20. Suggested presentation walkthrough

This README can support a project explanation and working-product presentation. It does not replace the application.

1. Explain the local road-hazard problem using actual research.
2. Open the landing page and clarify the website-only scope.
3. Show the map and explain verified versus pending records.
4. Submit a report and show the actual saved state.
5. Review the report through an authorized account.
6. Demonstrate proximity behaviour in a labelled controlled test; describe browser limits.
7. Show actual AI screening if implemented, or explicitly identify it as planned.
8. Show the repair workflow and finish with measured results and next steps.

Suggested closing pitch: “GodEye is a web platform that connects road reports, evidence review and location-based awareness. It helps people understand mapped road hazards and helps teams keep those records current. We will evaluate its warning reliability in a limited pilot before making wider safety claims.”

## 21. Repository documentation to add after implementation

Do not invent setup commands before the project exists. Add the following when the actual repository is available:

- Verified frontend and backend prerequisites and installation steps.
- Environment-variable names, with example values that contain no secrets.
- Database migration and development-data instructions.
- Worker and model setup, including model and dataset licences.
- Instructions for running services and tests.
- Deployment configuration, supported browsers and known issues.
- Live links, screenshots, team credits and measured feature status.
- Explicit distinction between implemented functionality and roadmap items.

## 22. Technical references

Browser implementation references:

- Geolocation, permissions and secure contexts: https://developer.mozilla.org/en-US/docs/Web/API/Geolocation_API
- Location updates: https://developer.mozilla.org/en-US/docs/Web/API/Geolocation/watchPosition
- Hidden-page behaviour: https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API
- Audio restrictions: https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay

Project requirements source: user-attached **Problem Statement - CityFix.docx**. Product architecture, screens and workflow in this README are proposed design decisions for GodEye, not additional event mandates.
