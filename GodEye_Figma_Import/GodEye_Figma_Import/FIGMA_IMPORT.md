# GodEye Figma handoff

This package contains editable SVG design references, not a native `.fig` file. It does not contain an automatically wired prototype or Figma Auto Layout components. The working app remains the implementation reference.

## Import

1. Create a new Figma Design file.
2. Drag the individual SVG files onto the canvas. Start with `00_Design_System.svg` and `01` through `06`.
3. Use `GodEye_Mobile_Board.svg` if you prefer the mobile screens already arranged in one board. Do not import both versions unless you want duplicates.
4. Ungroup imported groups as needed. Text/vector elements are provided as SVG objects. Exact text editability depends on Figma's SVG importer and font availability. Arial or a metrically suitable replacement should be installed.
5. Place each screen inside its own frame. Use 390 × 844 for mobile screens and 1200 × 760 for the admin review.
6. Convert repeated controls into components and apply Auto Layout if required by your design submission.
7. Create color styles using `design-tokens.json`. The supplied `logo.png` is the original brand asset.
8. Choose File → Save local copy in Figma to produce your own native `.fig` copy after import, where the Figma UI supports it.

## Suggested prototype connections

- Map tab opens Destination / Route.
- Search destination selects a result then opens Route and Voice.
- Edit destination returns to search.
- Change vehicle opens the route settings in the same top card.
- Report damage opens the camera/report flow.
- My Reports opens the account-owned report card.
- View location opens the reported map pin.
- Admin verifies/rejects with a reason. A repair confirmation requires evidence.

Add these connections in Figma's Prototype panel. They are instructions, not preconfigured interactions.

## Screen notes

The report screen is the first step of a form, with description/submission on continuation. It is a visual design proposal, not a claim that the app already uses a multi-step form. Maps are labelled schematic and evidence panels are illustrations. Replace them with authorized project images if desired. No private user photos or account screenshots are included.

Voice defaults to Hindi in the implemented application. The design uses an English Hindi/English label for font portability. Keep the actual application's language values `hi-IN` and `en-IN`. No exact-distance or same-road guarantee is implied.
