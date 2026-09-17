# .claude/skills/jira/SKILL.md — cropping, not JPEG or downscaling, is what gets a screenshot under the attach ceiling

- Added: 2026-09-17
- Applies to: target only (`attach` example; refines the existing payload-ceiling entry)
- Evidence: Getting an 853 KB full-page PNG under the relay's attach ceiling, downscaling it to 1100 px wide left the PNG at 90 KB (base64 121 KB, still 413) and converting it to JPEG made it *larger* at 113 KB (base64 150 KB); cropping to the 1600x420 summary region left a 42 KB PNG (base64 55 KB) that uploaded successfully.
- Proposed change: In the `attach` note, say to crop a screenshot to the region that carries the evidence (`ffmpeg -vf crop=W:H:X:Y`) as the first size reduction, and warn that for a flat-colour UI screenshot downscaling barely shrinks the PNG and JPEG conversion can enlarge it.
