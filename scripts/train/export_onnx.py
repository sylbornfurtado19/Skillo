"""
SKILLO AI - ONNX EXPORT & LATENCY BENCHMARKING (PHASE 2)
=========================================================
Exports trained PyTorch checkpoints to ONNX format (opset 14, dynamic batching)
and runs empirical CPU latency benchmarks with onnxruntime.InferenceSession.

Outputs:
  - scripts/train/exports/pose_engine.onnx
  - scripts/train/exports/affect_engine.onnx
  - scripts/train/exports/gaze_engine.onnx
"""

import os
import sys
import time

try:
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
    if hasattr(sys.stderr, 'reconfigure'):
        sys.stderr.reconfigure(encoding='utf-8')
except Exception:
    pass

import numpy as np
import torch
import torch.nn as nn
import onnxruntime as ort

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CHECKPOINT_DIR = os.path.join(BASE_DIR, 'checkpoints')
EXPORT_DIR = os.path.join(BASE_DIR, 'exports')
os.makedirs(EXPORT_DIR, exist_ok=True)

# ImageNet normalization
IMAGENET_MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)
IMAGENET_STD  = np.array([0.229, 0.224, 0.225], dtype=np.float32)


# ==============================================================================
# MODEL ARCHITECTURE
# ==============================================================================
class InvertedResidual(nn.Module):
    def __init__(self, in_c, out_c, stride, expand_ratio):
        super().__init__()
        self.stride = stride
        hidden_dim = int(round(in_c * expand_ratio))
        self.use_res_connect = self.stride == 1 and in_c == out_c
        layers = []
        if expand_ratio != 1:
            layers.extend([
                nn.Conv2d(in_c, hidden_dim, 1, 1, 0, bias=False),
                nn.BatchNorm2d(hidden_dim),
                nn.ReLU6(inplace=True)
            ])
        layers.extend([
            nn.Conv2d(hidden_dim, hidden_dim, 3, stride, 1, groups=hidden_dim, bias=False),
            nn.BatchNorm2d(hidden_dim),
            nn.ReLU6(inplace=True),
            nn.Conv2d(hidden_dim, out_c, 1, 1, 0, bias=False),
            nn.BatchNorm2d(out_c)
        ])
        self.conv = nn.Sequential(*layers)

    def forward(self, x):
        if self.use_res_connect:
            return x + self.conv(x)
        return self.conv(x)


class MobileNetV2VisionEngine(nn.Module):
    def __init__(self, num_outputs: int, is_classifier: bool = False):
        super().__init__()
        self.features = nn.Sequential(
            nn.Conv2d(3, 32, 3, 2, 1, bias=False),
            nn.BatchNorm2d(32),
            nn.ReLU6(inplace=True),
            InvertedResidual(32, 16, 1, 1),
            InvertedResidual(16, 24, 2, 6),
            InvertedResidual(24, 32, 2, 6),
            InvertedResidual(32, 64, 2, 6),
            InvertedResidual(64, 96, 1, 6),
            InvertedResidual(96, 160, 2, 6),
            InvertedResidual(160, 320, 1, 6),
            nn.Conv2d(320, 1280, 1, 1, 0, bias=False),
            nn.BatchNorm2d(1280),
            nn.ReLU6(inplace=True),
            nn.AdaptiveAvgPool2d((1, 1))
        )
        self.head = nn.Sequential(
            nn.Dropout(0.2),
            nn.Linear(1280, num_outputs)
        )
        self.is_classifier = is_classifier

    def forward(self, x):
        x = self.features(x)
        x = x.view(x.size(0), -1)
        x = self.head(x)
        return x


def export_single_model(task_name: str, num_outputs: int, is_classifier: bool, out_name: str):
    ckpt_path = os.path.join(CHECKPOINT_DIR, f'best_{task_name}_model.pth')
    onnx_path = os.path.join(EXPORT_DIR, f'{task_name}_engine.onnx')

    print(f"\n[EXPORT] Exporting {task_name.upper()} Model to ONNX...")
    model = MobileNetV2VisionEngine(num_outputs=num_outputs, is_classifier=is_classifier)
    if os.path.exists(ckpt_path):
        model.load_state_dict(torch.load(ckpt_path, map_location='cpu'))
        print(f"  [OK] Loaded checkpoint: {ckpt_path}")
    else:
        print(f"  [WARN] Checkpoint not found: {ckpt_path}, exporting base initialized model.")

    model.eval()
    dummy_input = torch.randn(1, 3, 224, 224, dtype=torch.float32)

    torch.onnx.export(
        model,
        dummy_input,
        onnx_path,
        export_params=True,
        opset_version=14,
        do_constant_folding=True,
        input_names=['input_image'],
        output_names=[out_name],
        dynamic_axes={
            'input_image': {0: 'batch_size'},
            out_name: {0: 'batch_size'}
        },
        dynamo=False
    )
    print(f"  [OK] Exported ONNX model ({os.path.getsize(onnx_path)/1024:.1f} KB) -> {onnx_path}")
    return onnx_path


def benchmark_onnx_model(onnx_path: str, task_name: str, warmup_runs=10, test_runs=50):
    session_options = ort.SessionOptions()
    session_options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
    session_options.intra_op_num_threads = 4

    session = ort.InferenceSession(onnx_path, session_options, providers=['CPUExecutionProvider'])
    input_name = session.get_inputs()[0].name
    dummy_input = np.random.randn(1, 3, 224, 224).astype(np.float32)

    # Warmup
    for _ in range(warmup_runs):
        _ = session.run(None, {input_name: dummy_input})

    # Benchmark
    latencies = []
    for _ in range(test_runs):
        t_start = time.perf_counter()
        _ = session.run(None, {input_name: dummy_input})
        t_end = time.perf_counter()
        latencies.append((t_end - t_start) * 1000.0)  # ms

    latencies = np.array(latencies)
    mean_lat = np.mean(latencies)
    median_lat = np.median(latencies)
    p95_lat = np.percentile(latencies, 95)
    fps = 1000.0 / mean_lat

    print(f"  [BENCHMARK] {task_name.upper()} CPU ONNX Runtime ({test_runs} runs):")
    print(f"    - Mean Latency   : {mean_lat:.2f} ms")
    print(f"    - Median Latency : {median_lat:.2f} ms")
    print(f"    - 95th Percentile: {p95_lat:.2f} ms")
    print(f"    - Throughput     : {fps:.1f} FPS")

    return {
        'task': task_name,
        'mean_latency_ms': round(mean_lat, 2),
        'median_latency_ms': round(median_lat, 2),
        'p95_latency_ms': round(p95_lat, 2),
        'fps_throughput': round(fps, 1)
    }


def main():
    print("=" * 80)
    print("  SKILLO AI - ONNX EXPORT & LATENCY BENCHMARKING ENGINE (PHASE 2)")
    print("=" * 80)

    tasks = [
        ('pose', 3, False, 'pose_angles_deg'),
        ('affect', 7, True, 'emotion_logits'),
        ('gaze', 2, False, 'gaze_pitch_yaw_deg')
    ]

    benchmarks = []
    for t_name, n_out, is_cls, out_name in tasks:
        onnx_file = export_single_model(t_name, n_out, is_cls, out_name)
        bench = benchmark_onnx_model(onnx_file, t_name)
        benchmarks.append(bench)

    print("\n" + "=" * 80)
    print("SUMMARY OF ONNX EXPORT & EMPIRICAL LATENCY BENCHMARKS")
    print("-" * 80)
    print(f"{'ENGINE':<15} | {'MEAN LATENCY':<15} | {'MEDIAN LATENCY':<15} | {'THROUGHPUT (FPS)':<18}")
    print("-" * 80)
    for b in benchmarks:
        print(f"{b['task'].upper():<15} | {b['mean_latency_ms']:>6.2f} ms        | {b['median_latency_ms']:>6.2f} ms        | {b['fps_throughput']:>6.1f} FPS")
    print("=" * 80)


if __name__ == '__main__':
    main()
