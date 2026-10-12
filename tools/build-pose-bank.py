# Step 2 of the hero pipeline: from poses.json (tools/measure-poses.py) pick a bank of frames that covers
# every head direction without blinks or frozen holds, remove the watermark, and write
# assets/hero/000.jpg … plus assets/hero/poses.json ([x, y] degrees per frame) for script.js.
#   ../venv/bin/python tools/build-pose-bank.py assets/hero 3 960
# Edit `vids` below to point at the clips (keys must match the names used in measure-poses.py).
import json, math, cv2, numpy as np, os, sys
D = '/Users/dhiraj_24019/Downloads/Woman_turning_head_'
vids = {'n4': D+'slowly_20261012171852.mp4', 'n2': D+'downward_20261012171903.mp4',
        'n1': D+'steadily_20261012171908.mp4', 'n3': D+'smoothly_20261012171900.mp4'}
P = json.load(open('poses.json'))
OUT = sys.argv[1]; MIN_GAP = float(sys.argv[2]); W = int(sys.argv[3])
os.makedirs(OUT, exist_ok=True)
for f in os.listdir(OUT): os.remove(os.path.join(OUT, f))
def blink(rows, i):
    yaw, pitch, roll, eye, lip = rows[i]
    if pitch > 12: return False                      # looking down: lids are low anyway
    nb = [rows[j][3] for j in range(max(0, i-10), min(len(rows), i+11)) if rows[j]]
    return eye < (0.28 if pitch < 10 else 0.22) or eye < 0.6 * max(nb)         # closed, or much less open than nearby frames
kept = []  # (sx, sy, vid, idx)
for v in ['n4', 'n2', 'n1', 'n3']:                   # cleanest sweep first
    rows = P[v]
    for i, r in enumerate(rows):
        if not r or blink(rows, i): continue
        sx, sy = -r[0], r[1]                         # screen x (+ = her looking to screen-right), y (+ = down)
        if all(math.hypot(sx-a, sy-b) >= MIN_GAP for a, b, _, _ in kept):
            kept.append((sx, sy, v, i))
kept.sort(key=lambda k: (k[0], k[1]))
mask = np.zeros((720, 1280), np.uint8); mask[566:662, 1126:1226] = 255
man = []; caps = {}
for n, (sx, sy, v, i) in enumerate(kept):
    cap = caps.setdefault(v, cv2.VideoCapture(vids[v]))
    cap.set(cv2.CAP_PROP_POS_FRAMES, i); ok, f = cap.read()
    f = cv2.inpaint(f, mask, 9, cv2.INPAINT_TELEA)
    f = cv2.resize(f, (W, round(W * 720 / 1280)), interpolation=cv2.INTER_AREA)
    cv2.imwrite(f'{OUT}/{n:03d}.jpg', f, [cv2.IMWRITE_JPEG_QUALITY, 72, cv2.IMWRITE_JPEG_OPTIMIZE, 1])
    man.append([round(sx, 1), round(sy, 1)])
    print(n, v, i, round(sx, 1), round(sy, 1))
json.dump(man, open(f'{OUT}/poses.json', 'w'), separators=(',', ':'))
print('frames', len(man))
