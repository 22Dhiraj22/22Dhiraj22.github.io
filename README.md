# Dhiraj More — Product Portfolio

Live at https://22dhiraj22.github.io

Plain HTML/CSS/JS, no build step. Edit `index.html` or `work/*.html`, commit and push; GitHub Pages redeploys automatically.

## Hero character (cursor-following)
The hero background is a 9 × 5 grid of head poses (`assets/hero/r{row}c{col}.jpg`): columns turn from looking screen-left (`c0`) to screen-right (`c8`), rows tilt from looking up (`r0`) to down (`r4`). `script.js` works out the direction from her face to the cursor, blends the 4 nearest poses, and eases there with a spring, so she looks wherever the cursor is. On touch devices or when idle she looks around on her own. If the frames fail to load, a drawn SVG character is shown instead.

The poses are generated from a single portrait with [LivePortrait](https://github.com/KwaiVGI/LivePortrait) (free, open source, runs locally on a Mac). Setup and commands are at the top of `tools/pose-grid.py`; then `tools/prep-poses.swift` crops, compresses and removes the watermark. To use a different portrait, replace the image and rerun both. Adjust `FACE_X`/`FACE_Y` in `script.js` if her face sits elsewhere in the frame. `tools/extract-frames.swift` can still pull frames out of a video.
