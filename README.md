# Dhiraj More — Product Portfolio

Live at https://22dhiraj22.github.io

Plain HTML/CSS/JS, no build step. Edit `index.html` or `work/*.html`, commit and push; GitHub Pages redeploys automatically.

## Hero character (cursor-following)
The hero background uses 48 frames from an AI video (`assets/hero/000.jpg` … `047.jpg`). The cursor's left-right position picks the frame, so the character appears to follow it. If the frames fail to load, a drawn SVG character is shown instead.

To swap in a new character video (it must start looking far LEFT and end looking far RIGHT, with a static camera and a dark plain background):
```
rm assets/hero/*.jpg
swift tools/extract-frames.swift ~/Downloads/new-video.mp4 assets/hero 1000 0.2 0.95
```
That extracts every frame. Then drop blink frames and long frozen holds (they feel laggy), renumber 000…, and set `data-count` and `data-center` (the frame looking straight at the camera) on the hero in `index.html`. Adjust `FACE_X`/`FACE_Y` in `script.js` if her face sits elsewhere in the frame.
