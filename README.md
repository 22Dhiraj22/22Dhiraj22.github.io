# Dhiraj More — Product Portfolio

Live at https://22dhiraj22.github.io

Plain HTML/CSS/JS, no build step. Edit `index.html` or `work/*.html`, commit and push; GitHub Pages redeploys automatically.

## Hero character (cursor-following)
The hero background uses 48 frames from an AI video (`assets/hero/000.jpg` … `047.jpg`). The cursor's left-right position picks the frame, so the character appears to follow it. If the frames fail to load, a drawn SVG character is shown instead.

To swap in a new character video (it must start looking far LEFT and end looking far RIGHT, with a static camera and a dark plain background):
```
rm assets/hero/*.jpg
swift tools/extract-frames.swift ~/Downloads/new-video.mp4 assets/hero 48 1280
```
If the face isn't centred in the new video, adjust `CHAR_X` in `script.js`.
