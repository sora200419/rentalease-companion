# Image generation prompts

Mode: built-in imagegen; no paid external API configuration. The two move-out assets were edited from their corresponding move-in image to keep the comparison consistent. All four images were visually inspected for subject, pairing and the embedded demo disclaimer.

## wall-in

```text
Use case: photorealistic-natural
Asset type: synthetic rental inspection demo photograph, landscape 4:3
Primary request: A clearly labelled artificial test photo of an empty rental apartment wall below a window. Off-white painted wall, simple white aluminium window across the upper part, pale beige tile floor and grey skirting board. A single readily visible 15 cm dark grey diagonal scuff on the lower wall under the window. Moderate close-up, eye-level camera, flat natural daylight, sharp mundane phone inspection-photo aesthetic, realistic plaster texture. No people, address or personal information. Leave the scuff fully visible.
Text (verbatim): a large dark green footer band across the bottom with white readable text on two lines: "AI-GENERATED DEMO — NOT REAL EVIDENCE" and "MOVE-IN · WALL SCUFF · W01".
Constraints: one photograph only, not a collage. Label must be legible even as a thumbnail. No timestamp or invented capture metadata, no brand logo. This is a simulation, not a real inspection.
```

## kitchen-in

```text
Use case: photorealistic-natural
Asset type: synthetic rental inspection demo photograph, landscape 4:3
Primary request: A clearly labelled artificial test photo of a clean compact rental kitchen counter. Straight-on slightly downward medium close-up. Light grey laminate worktop, white square tile backsplash, plain light wood lower cabinets, small stainless steel sink on the right. Counter and sink are empty and clean, with ordinary material texture. Natural diffused daylight, sharp mundane phone inspection-photo aesthetic. No people, address, personal information, utensils or decorative props.
Text (verbatim): a large dark green footer band across the bottom with white readable text on two lines: "AI-GENERATED DEMO — NOT REAL EVIDENCE" and "MOVE-IN · KITCHEN COUNTER · K01".
Constraints: one photograph only, not a collage. Label must be legible even as a thumbnail. No timestamp or invented capture metadata, no brand logo. This is a simulation, not a real inspection.
```

## wall-out

```text
Use case: precise-object-edit
Asset: matching synthetic move-out inspection photograph.
Image 1 is the edit target. Preserve the same room, exact window and wall geometry, camera viewpoint, scuff's size/location/shape, floor and skirting. Preserve natural texture; do not add any damage. Only change the daylight slightly to be a little warmer and change the second footer line from MOVE-IN to "MOVE-OUT · WALL SCUFF · W02". Keep the first footer line exactly "AI-GENERATED DEMO — NOT REAL EVIDENCE", large and readable. Output one landscape photo. This comparison intentionally illustrates a pre-existing mark persisting, not new damage. No timestamps, people, address, or extra text.
```

## kitchen-out

```text
Use case: precise-object-edit
Asset: matching synthetic move-out inspection photograph.
Image 1 is the edit target. Preserve the same kitchen, framing/viewpoint, countertop, backsplash, sink, cupboards, hardware and lighting. Change ONLY these things: place a small clearly visible patch of food crumbs and a faint brown coffee ring on the countertop left of the sink, and replace the second footer line with "MOVE-OUT · KITCHEN COUNTER · K02". No cracks, burns or other damage; no new appliances. Keep the first footer line exactly "AI-GENERATED DEMO — NOT REAL EVIDENCE", large and readable. Output one landscape photo. This is a staged artificial cleaning discussion example, not proof of liability. No timestamps, people, address or extra text.
```
