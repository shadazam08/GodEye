# GodEye
## Know the road ahead.

**AI-assisted pothole mapping, advance driver warnings, and road repair visibility.**

**Project status:** Proposed prototype. Features below are planned unless explicitly demonstrated in your implementation. Sample records, alert thresholds, timelines, and interface metrics are illustrative. Replace planned-feature statements with verified implementation details before submission.

---

## 1. Project overview

GodEye is a proposed road safety platform that warns drivers about known potholes ahead and helps communities and road maintenance teams keep road hazard information current.

The central experience is simple: a driver starts a journey, GodEye follows the vehicle's approximate location with permission, and the app checks for mapped potholes along the direction of travel. When the vehicle approaches a relevant hazard, the app gives a short voice warning and a clear visual alert.

For the initial demonstration, the warning target is approximately **50 metres before a mapped pothole**. This is a configurable demonstration threshold, not a promise of exact positioning or sufficient stopping distance at every speed. A later version should calculate earlier warnings using speed, location uncertainty, and tested operating conditions.

AI supports the collection and review of pothole reports, for example by identifying likely road damage in uploaded photographs. Location-based proximity logic delivers the warning. These are separate functions: a location warning should not be described as AI camera detection.

GodEye is intended to be especially useful when road surface visibility is poor, including rain, fog, and darkness, because previously mapped hazards can still generate location-based warnings. It cannot guarantee warnings for new, unmapped, repaired, or inaccurately recorded hazards.

### One-sentence pitch

> GodEye helps drivers anticipate mapped potholes through advance voice warnings while turning community reports into actionable road maintenance information.

### Project manager explanation

> We are building a responsive web prototype with a public landing page, a road hazard map, a controlled journey simulation, a reporting flow, and a review dashboard. The prototype will show a vehicle approaching a mapped pothole and receiving an alert around the configured 50-metre threshold. AI image assistance is a separate module that must be demonstrated or clearly marked as planned. A future mobile version could support broader field testing and more reliable driving-session operation.

## 2. The problem

Potholes can create sudden road hazards, uncomfortable journeys, vehicle damage, and accident risk. Drivers may notice road damage too late, particularly when rainwater obscures the surface or visibility is limited.

There is also an information gap. One person may know about a dangerous pothole, while the next driver receives no warning. A maintenance team may receive incomplete or duplicate reports without a clear view of location, freshness, and repair status.

GodEye connects three needs:

1. **Awareness:** Give drivers advance notice of mapped hazards on their route.
2. **Reliable reporting:** Collect useful evidence and keep hazard records current.
3. **Repair visibility:** Help reviewers track hazards from report to verified resolution.

Do not claim that potholes cause most road accidents, or that GodEye will prevent most accidents, without appropriate evidence. The defensible initial claim is that the project aims to improve hazard awareness. Accident reduction would require a larger real-world evaluation.

### Who benefits?

| User | Need | GodEye response |
|---|---|---|
| Two-wheeler riders | Earlier awareness of uneven road surfaces | Short advance warnings with minimal interaction |
| Car and commercial vehicle drivers | Notice of mapped road damage | Route-relevant alerts and hazard details |
| Delivery and fleet operators | Visibility into recurring road hazards | Shared hazard records and later fleet pilots |
| Citizens and passengers | A practical reporting channel | Location-based reports with optional photographs |
| Road maintenance reviewers | Useful, current, reviewable evidence | Verification queue, map, and repair workflow |

## 3. Proposed solution and boundaries

GodEye combines a shared hazard database, GPS-based journey monitoring, reporting, and a reviewer dashboard. AI can help assess image evidence once an actual model or service is integrated and evaluated.

### Core capabilities

| Capability | Proposed behaviour | Initial priority |
|---|---|---|
| Hazard map | Show pothole locations, verification state, and last update | Essential |
| Journey simulation | Move a virtual vehicle along a predefined road | Essential |
| Advance warning | Alert near the configured approach distance | Essential |
| Reporting | Submit location, description, and optional image | Essential |
| Review workflow | Approve, reject, merge, or request more evidence | Essential |
| Repair lifecycle | Track open, assigned, repaired, and rechecked hazards | Essential, simple version |
| AI image assistance | Suggest whether an image contains visible pothole damage | Optional stretch feature |
| Live journey mode | Use device location while the app is active | Optional after simulation works |
| Offline hazard cache | Use previously downloaded nearby records | Later phase |
| Native mobile driving mode | Explore platform-specific location and audio behaviour | Later phase |

### Explicit boundaries

- No automatic steering, braking, or vehicle control.
- No guarantee that every pothole is detected or recorded.
- No promise of seeing through water, fog, or other obstructions.
- No confirmed government partnership, official integration, or mandatory installation policy.
- No claim of measured accident reduction from a simulation.

Government-supported adoption is a long-term partnership idea. Start with voluntary pilots, trusted data contributors, and evidence of usefulness. A prototype cannot require installation on citizens' phones.

## 4. How GodEye works

### A. Create and maintain hazard records

1. A stationary user or passenger reports a suspected pothole.
2. The report includes coordinates, a description, timestamp, and optional image.
3. If implemented, AI checks whether the image appears to contain relevant road damage and returns an uncertain suggestion.
4. The system compares the report with nearby existing hazards to identify possible duplicates.
5. A reviewer verifies the available evidence or requests further checking.
6. An approved hazard becomes available for driver warnings.
7. Repair reports trigger rechecking so obsolete warnings can be removed.

For a demo, manually seeded records are acceptable when clearly labelled. A new report should not silently become an officially verified hazard.

### B. Warn a driver

1. The user opens GodEye and selects Start Journey.
2. The app explains location use and requests permission for live mode; demo mode uses synthetic coordinates.
3. The system retrieves relevant nearby hazards.
4. It checks whether a hazard lies ahead on the current road or selected route.
5. It estimates distance along the route and compares it with the warning threshold.
6. On entering the warning area, it plays one short warning and displays a compact alert.
7. It suppresses repeated warnings until the vehicle passes the hazard or begins a genuinely new approach.
8. Ending the journey stops journey monitoring.

Suggested alert: **“Caution. Reported pothole ahead, approximately 50 metres. Reduce speed safely.”**

Avoid instructions to swerve, change lanes suddenly, or brake sharply.

### Example scenario — synthetic

A mapped pothole is on a predefined demonstration road. A virtual vehicle starts 200 metres away. As the route distance decreases from 100 metres to around 50 metres, GodEye produces one warning. The vehicle passes the hazard and the warning is cleared. A pothole on a nearby parallel road does not trigger an alert.

The rain or fog setting in this demo changes the scenario illustration and explanatory copy. It does not simulate validated sensor performance in actual weather.

## 5. Why use a hazard map instead of relying only on a camera?

A standard photograph or camera feed may not reveal a pothole when visibility is poor or the surface is covered. A previously collected hazard record can support a warning without requiring the current driver to photograph the pothole.

This introduces a different dependency: the map must be reasonably accurate and current. GodEye therefore needs both a warning system and a process for verifying, refreshing, and retiring records.

An eventual hybrid system could combine mapped hazards, trained image models, and fleet sensor reports. Each additional source requires independent evaluation. A single camera image should not be presented as a reliable physical depth measurement.

## 6. Alert distance and location design

### Start with a transparent 50-metre demo

Use a fixed threshold for the first simulation so viewers can understand and test it. Display distances as approximate. On a real device, location accuracy, update frequency, speed, and road geometry affect when a warning appears.

| Illustrative speed | Time to travel 50 metres, assuming constant speed |
|---|---|
| 20 km/h | About 9 seconds |
| 40 km/h | About 4.5 seconds |
| 60 km/h | About 3 seconds |
| 80 km/h | About 2.25 seconds |

These are arithmetic examples, not recommended reaction times or braking distances.

### Later adaptive approach

A candidate design is to compare a minimum distance with the distance travelled during a chosen warning time, then include a location uncertainty buffer. The warning time and buffer must come from testing; do not invent a universal safe value.

The production design should:

- Prefer distance along the selected road or route over straight-line distance alone.
- Check travel direction and avoid hazards behind the vehicle.
- Account for divided roads, parallel streets, flyovers, and turns.
- Treat poor accuracy or old location samples as reduced-confidence states.
- Use a cooldown and a wider exit boundary to avoid alerts repeatedly toggling near the threshold.
- Re-evaluate after a route change or U-turn.
- Avoid claiming lane-level accuracy from ordinary phone location alone.

For a short prototype, a predefined route makes these conditions controllable. Clearly explain that citywide route matching is a later engineering task.

## 7. Where AI fits

### Practical first AI feature

Use an uploaded road photograph to suggest **possible pothole**, **no visible pothole**, or **uncertain**. If a detector is used, display candidate image regions and model confidence for reviewers.

### Development approach

1. Identify a suitable licensed dataset and record its source and limitations.
2. Define labels carefully; include road patches, shadows, puddles, and speed breakers as confusing examples.
3. Separate training, validation, and test images by scene or road segment where possible to reduce near-duplicate leakage.
4. Train or adapt an image model using team-accessible tooling.
5. Evaluate false positives, missed detections, and performance across lighting and surface conditions.
6. Integrate the model only after its actual outputs can be shown.
7. Keep human review available for uncertain or consequential decisions.

A model confidence score is not the probability that a road is dangerous. Image-based severity should remain an estimate and must not imply measured pothole depth.

If time is limited, finish the warning and reporting prototype first. Mark AI as planned rather than presenting hardcoded responses as model inference. A rule-based proximity alert by itself does not establish an AI implementation.

## 8. Webpage and application blueprint

Build a responsive website with two connected parts: a public landing page explaining GodEye and an interactive application demonstrating its core behaviour.

### Suggested navigation

**Home · How It Works · Live Demo · Hazard Map · Report a Pothole · Project Details**

Place reviewer access in a separate login entry. The map and demo should be easy for judges to open without creating an account.

### Page 1 — Public landing page

| Section | Content and design | Action |
|---|---|---|
| Header | GodEye wordmark and concise navigation | Try Demo |
| Hero | Headline, value proposition, road/map illustration | Try Demo; Explore Map |
| Problem | Explain visibility, information, and maintenance gaps | Read the problem |
| How it works | Report → Review → Map → Warn → Recheck | Open demonstration |
| Main features | Advance warnings, shared map, reporting, review | Explore features |
| Demo preview | Small route visual and sample warning | Launch Demo |
| User benefits | Drivers, communities, and maintenance teams | View use cases |
| Current scope | Clearly distinguish implemented and planned features | View project details |
| FAQ | Accuracy, permissions, AI, weather, and repair questions | Expand answers |
| Footer | Team, repository, privacy information, contact | Open resources |

**Suggested hero copy**

> **Know the road ahead.**
>
> GodEye helps drivers anticipate mapped potholes with advance voice warnings and community-powered road information.
>
> Explore a prototype designed to improve road hazard awareness, especially when visibility is limited.

Buttons: **Try the Demo** and **Explore the Hazard Map**.

Place this note near the demonstration: **“Prototype using labelled sample data. Alerts are approximate and depend on available hazard information.”**

Do not display fabricated impact counters such as “10,000 lives saved.” A real database count may say “12 sample hazards” if that is what it contains.

### Page 2 — Interactive journey demo

**Purpose:** Make the advance-warning concept understandable in under one minute.

Required interface elements:

- Persistent **DEMO MODE — SYNTHETIC DATA** banner.
- Map or accurate route visual with a moving vehicle and hazard markers.
- Start, Pause, Reset, and Mute controls.
- Distance to next relevant hazard and illustrative speed.
- Optional Normal, Rain, and Fog scenario selectors, labelled as visual scenarios.
- One warning card and an event log.
- Visible audio state; a failed sound attempt must not be shown as successfully played.

Expected states: Ready, Running, Paused, Warning, Hazard Passed, Journey Complete, and Error.

Use a normal browser session for the controlled demo. Do not depend on judges physically driving or granting location permission.

### Page 3 — Hazard map

Show a city-area map with markers and an accessible list alternative. Support filters for verification state, estimated severity, and freshness. Keep maintenance status separate from verification status.

Each hazard detail panel should show approximate location, report time, last verification, evidence if permitted, and repair status. Provide a “Report an update” action.

Always provide an empty state: **“No mapped hazards in this area. This does not confirm that the road is hazard-free.”**

### Page 4 — Report a pothole

Fields: selected map location, location accuracy if available, optional photograph, description, and optional estimated severity. Let a user correct an inaccurate pin before submitting.

Display: **“Submit only when stationary or as a passenger.”**

Show upload progress, validation errors, and a submission reference. Tell users that the report is pending review. Do not require a phone number or full journey history for an ordinary report.

### Page 5 — Reviewer dashboard

Show incoming reports, suspected duplicates, evidence, and status controls. Reviewers can approve or reject reports, merge duplicate evidence, flag stale records, assign repair work within the prototype, and record a recheck.

Use role-based access. A public visitor must not be able to approve a report or change repair status. Any seeded account must contain demonstration data only.

### Page 6 — Project details

Explain the problem research, implemented features, architecture, AI status, limitations, team roles, and future roadmap. Link the README, repository, launch film, and explainer when available. Add actual setup instructions after implementation.

## 9. Brand and interface direction

**Name:** GodEye  
**Tagline:** Know the road ahead.  
**Brand tone:** Calm, clear, practical, community-minded.

Suggested original logo direction: an eye-shaped route symbol with a small road marker. Do not use government emblems or imply official endorsement. Check name availability and possible trademark conflicts before a public commercial launch.

| Design role | Suggested colour |
|---|---|
| Main background | Deep navy — #0B1220 |
| Primary action | Cyan — #22D3EE |
| Main text on dark surfaces | Near white — #F8FAFC |
| Warning | Amber — #F59E0B |
| High-severity indicator | Red — #EF4444 |
| Resolved status | Green — #22C55E |

Use a readable sans-serif family such as Inter or a system font. Verify actual colour contrast in the final layout, especially text on coloured buttons. Never communicate hazard status by colour alone; include icons and text.

On mobile, prioritize the map, current state, and one primary action. Driving mode should emphasize audio and large readable status text. Respect reduced-motion settings and avoid flashing alerts. Provide keyboard access, labelled controls, and text equivalents for audio.

## 10. Technical architecture — conceptual

| Component | Responsibility |
|---|---|
| Web frontend | Landing page, map, demo controls, reporting, reviewer interface |
| Location and warning module | Read live or simulated location, select relevant hazards, trigger alerts |
| Backend service | Validate reports, serve hazard records, enforce permissions |
| Spatial data store | Save hazard locations, evidence metadata, verification, and repair state |
| Image storage | Hold uploaded images with access and retention controls |
| Optional AI service | Assess image evidence and return suggestions |
| Reviewer workflow | Record moderation actions and repair updates |

### Implementation choices

For a small team, use the frontend framework, backend, database, and hosting service the team already understands. A simple architecture is enough. A relational database with spatial support is a useful later option when nearby queries and route matching become more demanding.

A map library displays geographic information; map tiles and routing are separate services. Check attribution, licences, quotas, and cost before choosing providers. Do not expose private service credentials in the browser.

Keep the AI service optional so a model failure does not prevent the map or report workflow from operating. Persist accepted reports in the backend; a page refresh should not erase them unless the demo explicitly declares temporary browser-only storage.

### Browser and mobile constraints

Browser geolocation requires a secure context and user permission. Continuous position updates are available through the browser API, but the project still needs to handle permission denial and errors. See [MDN: Geolocation API](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation_API).

The first website should demonstrate an active, visible session. Do not promise dependable locked-screen driving operation based on a website alone. A later native implementation must account for operating-system location restrictions; see [Android: Background location](https://developer.android.com/develop/sensors-and-location/location/background).

## 11. Data model

The following is a planning model, not a required database schema.

| Record | Important information |
|---|---|
| Hazard | ID, coordinates, road reference, estimated severity, verification state, repair state, first report time, last verified time |
| Report | ID, linked hazard if known, coordinates, location accuracy, timestamp, description, optional evidence, moderation state |
| AI assessment | Report ID, model version, suggested class, confidence, review outcome |
| Repair update | Hazard ID, status, update time, authorized reviewer, evidence if available |
| Review event | Target record, action, reviewer, timestamp, reason |
| User role | Minimal account identifier and authorized permissions |

**Verification states:** Unreviewed, Community-supported, Reviewer-verified, Disputed, Stale.

**Maintenance states:** Open, Assigned, Repair Reported, Repair Verified, Reopened.

A hazard can be reviewer-verified while repair work is assigned. Keeping the two dimensions separate avoids confusing evidence quality with maintenance progress.

New evidence may reopen a previously resolved hazard. Multiple reports should usually strengthen one hazard record rather than create many overlapping warning markers.

## 12. Trust, privacy, and data freshness

- Request location only when needed for an explained feature.
- Prefer on-device journey calculations where feasible; a live journey does not automatically require server-side trip storage.
- Stop monitoring when the user ends the session.
- Keep reporting identity private and collect only necessary account details.
- Do not retain complete trip histories by default.
- Explain what report data is public, who can review images, and how deletion requests work.
- Restrict administrative actions and record an audit history.
- Blur faces and number plates before public display; review images for other personal information.
- Rate-limit submissions and review suspicious reporting patterns.
- Show timestamps and expire or recheck stale information.
- Treat repeated community reports as evidence, not automatic proof.

The interface should say **“No current data available”** when information is missing or too old. It should never translate missing data into a green “safe road” guarantee.

## 13. Important failure states

| Situation | Expected behaviour |
|---|---|
| Location permission denied | Explain how to enable it; keep simulation available |
| Poor or stale location | Show reduced accuracy; avoid precise-distance promises |
| Network unavailable | Use a valid labelled cache if implemented; otherwise show data unavailable |
| Audio unavailable | Keep a clear visual alert and show muted/unavailable state |
| Parallel road hazard | Suppress it when route context identifies a different road |
| New report awaiting review | Display pending status; do not imply official confirmation |
| AI uncertain or offline | Continue manual reporting and review |
| Hazard marked repaired | Require appropriate verification before retiring warnings |
| Outdated hazard record | Show age and request rechecking |
| Journey stopped | Stop location monitoring and clear journey alerts |

## 14. Minimum working prototype

The smallest credible version should let a judge:

1. Open the public landing page.
2. Launch a clearly labelled simulated journey.
3. Observe route distance decreasing toward a seeded pothole.
4. Receive one warning around the configured threshold.
5. Submit a sample pothole report and see its pending status.
6. Use a reviewer session to approve the report.
7. See the approved hazard on the shared map after refresh.
8. Follow a repair status update through the basic review process.

If full route matching is not implemented, constrain the journey to a known route and disclose that scope. If AI is absent, describe the delivered product as a location-based prototype with planned AI assistance.

### Acceptance checklist

- [ ] Public link opens on desktop and mobile.
- [ ] Demo works without location permission.
- [ ] A mapped hazard ahead triggers one visual warning.
- [ ] Voice warning works after the required user interaction, or its unavailable state is explicit.
- [ ] A hazard behind the vehicle does not produce an approach warning.
- [ ] The controlled parallel-road scenario avoids a false alert.
- [ ] Pause and Reset behave predictably; reset clears previous alert state.
- [ ] Reports persist as declared and begin in a pending state.
- [ ] Unauthorized users cannot approve reports or change repair status.
- [ ] Missing-data, permission, network, and empty-map states are understandable.
- [ ] Sample data and simulated weather are labelled.
- [ ] Claims match the actual demonstration.

## 15. Development roadmap

Build in vertical slices: finish one complete user action before adding another partially working module.

| Phase | Work | Completion evidence |
|---|---|---|
| 1. Validate and define | Speak with potential users, choose a narrow demo area, define scenarios | Research notes and agreed scope |
| 2. Brand and structure | Create original identity, page layouts, and feature copy | Consistent responsive designs |
| 3. Core warning | Build route simulation, hazard relevance checks, audio and visual alert | Repeatable working journey |
| 4. Reporting loop | Add submissions, persistence, review, and map updates | Report-to-map demonstration |
| 5. Optional AI | Integrate and evaluate image assistance if feasible | Actual inference with disclosed limits |
| 6. Verify and communicate | Test key cases, publish, record videos, prepare submission | Accessible links and complete checklist |

### Illustrative seven-day team plan

| Day | Main outcome |
|---|---|
| 1 | Fresh repository/design file, problem research, scope, responsibilities |
| 2 | Brand kit, responsive layout, seeded map and route |
| 3 | Working simulation and warning behaviour |
| 4 | Report submission, backend persistence, review workflow |
| 5 | Integration, accessibility checks, optional AI only if core works |
| 6 | Public deployment, user feedback, launch and explainer recordings |
| 7 | Fix failures, verify links, finalize documentation and submission |

This is a relative plan, not a claim about time remaining in the event. Use the organizer's actual schedule and remaining time to reduce scope when necessary.

### Five-member responsibilities

| Role | Primary responsibility |
|---|---|
| Team lead / integration developer | Scope, integration, deployment, organizer contact |
| Application developer | Simulation, reporting, data, reviewer workflow |
| Designer | Brand kit, webpage layout, accessibility, interface assets |
| Video editor | Launch film, screen recordings, explainer editing |
| Research / QA / communications member | Validation, testing, documentation, original social content |

Adjust the split to actual skills. All members should understand the implemented flow and its limits.

## 16. Research and evaluation plan

Before claiming impact, ask riders and drivers when road hazards are hardest to anticipate, what warnings they would tolerate, and what makes hazard information trustworthy. Ask a maintenance stakeholder, if accessible, what report details would help their existing workflow. Record respondent counts honestly and obtain consent for quotations.

For any comparison with existing products, inspect the specific product and document what you actually observe. Do not claim that no existing navigation service warns about road hazards. GodEye's proposed focus is a clearly demonstrated pothole warning and evidence-to-repair workflow.

### Measure what the prototype can establish

| Metric | Definition |
|---|---|
| Scenario pass rate | Passed predefined scenarios divided by scenarios executed |
| Warning distance error | Difference between target and measured alert position within the test setup |
| Missed warnings | Relevant test hazards approached without the expected alert |
| False warnings | Alerts for irrelevant or absent hazards in the tested scenarios |
| Duplicate warnings | Extra alerts during the same approach |
| Report completion | Whether test users can successfully submit a valid report |
| Review turnaround | Time between a report and its review decision during the pilot |
| AI quality, if implemented | Precision, recall, and error examples on a held-out dataset |

Simulation results establish prototype behaviour under controlled inputs. They do not establish real-world location accuracy, all-weather performance, or accident reduction.

## 17. Demo and presentation guide

### Can this README be used for a project demo?

**Yes.** Use it as the project overview, explanation guide, development reference, and source for presentation slides or narration. Present the working prototype alongside it. The attached challenge requires a functional solution; a README or static design alone does not satisfy that requirement.

### Two-to-three-minute explainer outline

| Time | What to show | What to explain |
|---|---|---|
| 0:00–0:20 | Original road illustration or permitted footage | Drivers can receive road damage information too late |
| 0:20–0:40 | Landing page | GodEye connects mapped potholes with advance warnings |
| 0:40–1:25 | Working journey simulation | Start, approach, approximately 50-metre alert, pass hazard |
| 1:25–1:55 | Reporting and review | New evidence becomes a reviewed map record |
| 1:55–2:20 | Architecture and actual AI module, if implemented | Explain which parts are rules, location logic, and AI |
| 2:20–2:45 | Limits and roadmap | Describe current scope, validation needs, and pilot plans |

### Short narration

> Road damage can be difficult to notice in time, especially when visibility is poor. GodEye is our proposed platform for earlier awareness of mapped potholes.
>
> In this labelled simulation, a vehicle travels toward a known hazard. When it reaches the configured approach distance of approximately 50 metres, the application provides a short warning. The warning uses location and route information rather than assuming that a camera can see through fog or rainwater.
>
> Users can submit new reports, and reviewers can check evidence, update the shared map, and track repair progress. Our current demonstration uses the features shown on screen; any remaining features are marked as planned.
>
> Our next step is controlled field validation of alert timing, location quality, and report freshness. GodEye aims to improve road hazard awareness, with real-world safety impact to be evaluated through future pilots.

### Sixty-to-ninety-second launch film idea

Open with an original illustration of a driver discovering road damage late. Introduce “Know the road ahead,” show the working warning, explain the report-and-review loop, and close with the demo link. Keep simulated scenes labelled and avoid unsupported statistics or implied official endorsement.

### Questions a project manager or judge may ask

**How does it work when the pothole is hidden?**  
It can warn about a previously mapped location. It may miss a new or unmapped hazard.

**Why 50 metres?**  
It is an understandable starting threshold for the demonstration. Real-world warning distance must adapt to speed and uncertainty and be validated.

**Where is the AI?**  
In image-based report assistance if that feature has actually been integrated. The GPS warning uses location and route logic.

**Will the government install it on every phone?**  
That is not an existing arrangement. Future public-sector partnerships would require independent agreement and a validated product.

**How will the map become useful initially?**  
Start with a small verified area, clearly labelled seed data for demos, and a pilot with contributors who regularly travel selected roads.

**What happens after repair?**  
A repair update triggers verification. Once confirmed, the hazard is retired from active warnings while its history is retained according to the data policy.

**Can a website be the first version?**  
Yes, for the landing page, reporting, review, and an active-session demonstration. Dependable field operation requires additional device and platform testing.

## 18. Alignment with the attached CityFix brief

This section reflects the provided **Problem Statement - CityFix.docx**, not independent verification of later organizer updates.

| Required deliverable | GodEye submission |
|---|---|
| Functional solution | Working warning simulation and report-review-map loop |
| Problem research and validation | User observations, interviews or survey findings, limitations |
| Brand kit | Original GodEye logo, colours, typography, identity |
| Public landing page | Deployed introduction and clear demo access |
| Launch film | Original 60–90-second film |
| Explainer video | 2–3-minute explanation including the working solution |
| Project documentation | This README updated with actual implementation and evidence |
| Source/project files | Fresh repository and relevant design/project files |
| Social posts | At least five posts, following the brief's account and posting requirements |
| Engagement evidence | Screenshot of the most-liked eligible post at the deadline |
| Tool disclosure | Actual AI tools, libraries, APIs, datasets, and licences |

According to the attached brief:

- Teams have five members and one designated lead.
- Original work must be created during the seven-day Buildathon, with a fresh repository and design file where applicable.
- Demo, synthetic, and estimated data are permitted when clearly labelled.
- Static mockups or conceptual ideas alone do not qualify as the working solution.
- Create new project-named accounts on Instagram and X; use **#TutedudeBuildathon** and **#BuildForMyCity**, and tag the organizers using their verified event-provided handles.
- Engagement must be organic; the brief prohibits paid promotion, purchased likes, bots, and engagement groups.
- Do not impersonate government authorities or imply an unapproved government affiliation.
- Obtain relevant filming permissions and protect identifiable faces and number plates.
- The listed submission deadline is **Saturday, 28 November 2026, 11:59 PM**. The document does not state a timezone; confirm it with the organizers rather than assuming one.

The provided document does not expose readable judging weights, so this README assigns none. Follow any official updates supplied by the organizers.

## 19. Final handoff and submission checklist

### Replace these items once the product exists

| Item | Value to add |
|---|---|
| Live landing page | Actual public URL |
| Working demo | Actual demo URL |
| Source repository | Actual repository URL |
| Implemented features | Tested list, separate from planned features |
| Technology stack | Actual frameworks, services, and versions |
| Setup and execution | Real prerequisites, configuration names, run instructions, and sample-data setup |
| Deployment details | Actual hosting requirements and environment configuration |
| AI disclosure | Model/service, dataset, licence, evaluation, or “not implemented” |
| Demo data | Origin, synthetic labels, reset behaviour, and persistence scope |
| Reviewer access | Safe demonstration access method, without production credentials |
| Validation | Scenarios tested, outcomes, unresolved issues |
| Team | Names and actual roles |
| Brand kit and videos | Accessible links |
| Social submission | Post links and eligible engagement screenshot |
| Project licence and credits | Team decision and third-party acknowledgements |

### Before sharing

- [ ] All links open without unintended access restrictions.
- [ ] The core warning works in the recorded and live demonstration.
- [ ] The team can explain its implementation decisions.
- [ ] Actual features, planned features, and simulations are clearly separated.
- [ ] No fabricated statistics, testimonials, partnerships, or safety outcomes appear.
- [ ] Data sources and external tools are credited with relevant licences.
- [ ] The README contains real setup instructions once code is submitted.
- [ ] Event deliverables and deadline requirements have been checked against organizer updates.

## 20. Technical references

- [MDN — Geolocation API](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation_API): browser location permission and secure-context requirements.
- [MDN — watchPosition](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation/watchPosition): receiving browser location updates.
- [Android Developers — Background location](https://developer.android.com/develop/sensors-and-location/location/background): background location considerations for a later Android implementation.
- **Provided attachment:** Problem Statement - CityFix.docx, used for challenge deliverables and submission requirements.

**GodEye — Know the road ahead.**
