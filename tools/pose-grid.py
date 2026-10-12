# Render a grid of head poses from ONE portrait with LivePortrait (free, runs locally; Apple Silicon OK).
# Setup (once):
#   git clone https://github.com/KwaiVGI/LivePortrait.git lp && cd lp
#   python3 -m venv venv && venv/bin/pip install torch torchvision onnx onnxruntime opencv-python scipy \
#     imageio imageio-ffmpeg tqdm rich scikit-image tyro pillow huggingface_hub lmdb requests albumentations pykalman
#   venv/bin/python -c "from huggingface_hub import snapshot_download as d; d('KwaiVGI/LivePortrait', local_dir='pretrained_weights', ignore_patterns=['*animal*','docs/*'])"
# Run from inside lp/:
#   PYTORCH_ENABLE_MPS_FALLBACK=1 venv/bin/python ../tools/pose-grid.py portrait.png poses/
#   swift ../tools/prep-poses.swift poses ../assets/hero 960 0.2 0.95
import sys, types, os, time, json
g = types.ModuleType('gradio')
class _E(Exception):
    def __init__(self, *a, **k): super().__init__(*a)
g.Error = _E; g.update = lambda **k: k; g.Info = lambda *a, **k: None; g.Warning = lambda *a, **k: None
sys.modules['gradio'] = g
os.environ['PYTORCH_ENABLE_MPS_FALLBACK'] = '1'
import cv2
from src.gradio_pipeline import GradioPipeline
from src.config.crop_config import CropConfig
from src.config.argument_config import ArgumentConfig
from src.config.inference_config import InferenceConfig
def pf(c, kw): return c(**{k: v for k, v in kw.items() if hasattr(c, k)})
args = ArgumentConfig()
pipe = GradioPipeline(inference_cfg=pf(InferenceConfig, args.__dict__), crop_cfg=pf(CropConfig, args.__dict__), args=args)
SRC = sys.argv[1]; OUT = sys.argv[2]
COLS, ROWS = 9, 5
# gx: -1 screen-left .. 1 screen-right, gy: -1 up .. 1 down. LivePortrait: +yaw/+eyeX = screen-left, +pitch/+eyeY = down
poses = [[f'r{r}c{c}', gy * 14, -gx * 22, -gx * 16, gy * 12]
         for r in range(ROWS) for c in range(COLS)
         for gx, gy in [(-1 + 2 * c / (COLS - 1), -1 + 2 * r / (ROWS - 1))]]
SCALE = float(os.environ.get('SCALE', 2.5))
eye, lip = pipe.init_retargeting_image(SCALE, 0, 0, SRC)
os.makedirs(OUT, exist_ok=True)
for name, p, y, ex, ey in poses:
    t = time.time()
    _, full = pipe.execute_image_retargeting(eye, lip, p, y, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, ex, ey, SRC, SCALE, True, True)
    cv2.imwrite(f'{OUT}/{name}.png', cv2.cvtColor(full, cv2.COLOR_RGB2BGR))
    print(name, round(time.time() - t, 1), flush=True)
