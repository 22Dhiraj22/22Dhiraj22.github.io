# Dhiraj More — Product Portfolio

Live at https://22dhiraj22.github.io

Plain HTML/CSS/JS, no build step. Edit `index.html` or `work/*.html`, commit and push; GitHub Pages redeploys automatically.

## Hero character (cursor-following)
The hero background is a bank of 84 frames (`assets/hero/000.jpg` …) taken from four Google Flow clips of the same woman turning her head (left↔right, up↔down, diagonals) on a red backdrop. `assets/hero/poses.json` holds each frame's measured head direction in degrees (`[x, y]`: − screen-left/up, + screen-right/down).

`script.js` turns the cursor's position relative to her face into a target direction, eases toward it with a spring, shows the frame whose pose is closest and cross-fades between frames. The backdrop's edge pixels are stretched to fill the rest of the hero, so there's no seam. Phones load fewer, smaller frames to stay within memory. If the frames fail to load, a drawn SVG character is shown instead.

To rebuild from new clips (all clips must share the same framing and backdrop):
1. `tools/measure-poses.py` measures head pose, eye and mouth openness for every frame with LivePortrait (free, local). Setup is at the top of the file.
2. `tools/build-pose-bank.py` drops blinks and frozen holds, keeps frames at least 3° apart, removes the watermark, and writes `assets/hero/`.
3. Adjust `FACE_X`/`FACE_Y` in `script.js` if her face sits elsewhere in the frame.
