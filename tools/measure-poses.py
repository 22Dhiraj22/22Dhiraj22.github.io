# Step 1 of the hero pipeline: measure head pose (yaw/pitch/roll), eye-open and lip-open ratio for every
# frame of each clip, using LivePortrait's face models (free, runs locally; Apple Silicon OK).
# Setup (once):
#   git clone https://github.com/KwaiVGI/LivePortrait.git lp && cd lp
#   python3 -m venv ../venv && ../venv/bin/pip install torch torchvision onnx onnxruntime opencv-python scipy \
#     imageio imageio-ffmpeg tqdm rich scikit-image tyro pillow huggingface_hub lmdb requests albumentations pykalman
#   ../venv/bin/python -c "from huggingface_hub import snapshot_download as d; d('KwaiVGI/LivePortrait', local_dir='pretrained_weights', ignore_patterns=['*animal*','docs/*'])"
# Run from inside lp/:
#   PYTORCH_ENABLE_MPS_FALLBACK=1 ../venv/bin/python <portfolio>/tools/measure-poses.py poses.json a=clip1.mp4 b=clip2.mp4 ...
import sys, types, os, json
g = types.ModuleType('gradio')
class _E(Exception): pass
g.Error = _E; g.update = lambda **k: k; g.Info = lambda *a, **k: None; g.Warning = lambda *a, **k: None
sys.modules['gradio'] = g
import cv2, numpy as np
from src.gradio_pipeline import GradioPipeline
from src.config.crop_config import CropConfig
from src.config.argument_config import ArgumentConfig
from src.config.inference_config import InferenceConfig
from src.utils.retargeting_utils import calc_eye_close_ratio, calc_lip_close_ratio
def pf(c, kw): return c(**{k: v for k, v in kw.items() if hasattr(c, k)})
args = ArgumentConfig()
pipe = GradioPipeline(inference_cfg=pf(InferenceConfig, args.__dict__), crop_cfg=pf(CropConfig, args.__dict__), args=args)
cr, w = pipe.cropper, pipe.live_portrait_wrapper
out = {}
for name, path in [a.split('=', 1) for a in sys.argv[2:]]:
    cap = cv2.VideoCapture(path); rows = []; i = 0
    while True:
        ok, bgr = cap.read()
        if not ok: break
        rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
        ci = cr.crop_source_image(rgb, cr.crop_cfg)
        if ci is None: rows.append(None); i += 1; continue
        info = w.get_kp_info(w.prepare_source(ci['img_crop_256x256']))
        lmk = ci['lmk_crop'][None]
        rows.append([round(float(info['yaw']), 2), round(float(info['pitch']), 2), round(float(info['roll']), 2),
                     round(float(calc_eye_close_ratio(lmk).mean()), 3), round(float(calc_lip_close_ratio(lmk)[0][0]), 3)])
        i += 1
    out[name] = rows; print(name, len(rows), flush=True)
json.dump(out, open(sys.argv[1], 'w'))
