"""
IVP Progress Review 1: Unified Master Demonstration Runner
----------------------------------------------------------
Single-command executable demonstrating the complete 3-deliverable IVP review pipeline:
1. Benchmark Dataset Verification (50 annotated face samples & ground_truth.csv)
2. Preprocessing Pipeline Execution (ROI, 224x224 Bilinear, ImageNet Normalization, Augmentation)
3. Baseline Model Inference & Error Metrics (MobileFaceNet ONNX, Anthropometric PnP Euler, MAE/MSE, Latency)

Usage:
  python scripts/review1/run_review1_demo.py
"""

import os
import sys
import time

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, 'data')
IMAGES_DIR = os.path.join(DATA_DIR, 'images')
CSV_PATH = os.path.join(DATA_DIR, 'ground_truth.csv')
PLOTS_DIR = os.path.join(BASE_DIR, 'plots')
PREP_PLOT = os.path.join(PLOTS_DIR, 'preprocessing_demo.png')
INF_PLOT = os.path.join(PLOTS_DIR, 'inference_overlay_demo.png')

# Add parent directory to sys.path
sys.path.insert(0, BASE_DIR)

import download_dataset
import ivp_preprocessing
import ivp_baseline_inference

def main():
    t_start = time.time()
    print("=" * 80)
    print("  SKILLO AI - IVP PROGRESS REVIEW 1 MASTER DEMONSTRATION RUNNER")
    print("=" * 80)
    print(f"Environment : Python {sys.version.split()[0]} | Platform: {sys.platform}")
    print(f"Base Module : {BASE_DIR}")
    print("=" * 80)

    # -------------------------------------------------------------
    # DELIVERABLE 1: BENCHMARK DATASET VERIFICATION
    # -------------------------------------------------------------
    print("\n[PHASE 1/3] Checking Computer Vision Benchmark Dataset...")
    if not os.path.exists(CSV_PATH) or not os.path.exists(IMAGES_DIR) or len(os.listdir(IMAGES_DIR)) < 50:
        print("  Dataset assets missing or incomplete. Sourcing from benchmark mirrors...")
        download_dataset.acquire_models()
        download_dataset.acquire_and_extract_benchmark_dataset()
    else:
        sample_count = len([f for f in os.listdir(IMAGES_DIR) if f.endswith('.jpg')])
        print(f"  [OK] Benchmark Dataset verified: {sample_count} annotated face crops present in {IMAGES_DIR}")
        print(f"  [OK] Ground-Truth Catalog verified: {CSV_PATH}")

    # -------------------------------------------------------------
    # DELIVERABLE 2: PREPROCESSING PIPELINE
    # -------------------------------------------------------------
    print("\n[PHASE 2/3] Executing Dataset Preprocessing Pipeline...")
    ivp_preprocessing.run_batch_preprocessing()
    
    if not os.path.exists(PREP_PLOT) or os.path.getsize(PREP_PLOT) < 5000:
        print("  [ERROR] Preprocessing demonstration plot failed to generate!")
        sys.exit(1)
    print(f"  [OK] Preprocessing Plot verified: {PREP_PLOT} ({os.path.getsize(PREP_PLOT):,} bytes)")

    # -------------------------------------------------------------
    # DELIVERABLE 3: BASELINE MODEL INFERENCE & ERROR METRICS
    # -------------------------------------------------------------
    print("\n[PHASE 3/3] Executing Baseline Model Inference & Error Metrics...")
    metrics = ivp_baseline_inference.run_evaluation()
    
    if not os.path.exists(INF_PLOT) or os.path.getsize(INF_PLOT) < 5000:
        print("  [ERROR] Inference overlay demonstration plot failed to generate!")
        sys.exit(1)
    print(f"  [OK] Inference Plot verified: {INF_PLOT} ({os.path.getsize(INF_PLOT):,} bytes)")

    # -------------------------------------------------------------
    # FINAL EXECUTIVE SUMMARY REPORT
    # -------------------------------------------------------------
    t_elapsed = time.time() - t_start
    print("\n" + "=" * 80)
    print("  IVP PROGRESS REVIEW 1 - EXECUTIVE DEMONSTRATION SUMMARY")
    print("=" * 80)
    print("DELIVERABLE 1 (BENCHMARK DATASET):")
    print("  - Benchmark Source       : Dlib 68-Landmark Test Split + 3DDFA / AFLW2000-3D Samples")
    print("  - Image Count            : 50 Standardized Facial Crops")
    print("  - Annotation Columns     : Bounding Boxes, 3D Euler Angles (Yaw/Pitch/Roll), Emotion Labels")
    print("  - Local Storage Location : scripts/review1/data/")
    print("\nDELIVERABLE 2 (PREPROCESSING PIPELINE):")
    print("  - Face Localization      : OpenCV YuNet SOTA ONNX Face Detector (IoU / BBox regression)")
    print("  - Geometric Normalization: 15% Boundary Padding -> Centered Square Crop -> 224x224 px Bilinear")
    print("  - Radiometric Scaling    : ImageNet Mean/Std Normalization (mu=[0.485,0.456,0.406])")
    print("  - Augmentation Module    : Rotation (+12 deg), Horizontal Mirror, Lighting Jitter")
    print(f"  - Visual Output Artifact : {PREP_PLOT}")
    print("\nDELIVERABLE 3 (BASELINE MODEL INFERENCE & METRICS):")
    print("  - 3D Head Pose Model     : OpenCV Anthropometric 3D PnP (Levenberg-Marquardt Euler Solver)")
    print(f"    * Yaw MAE              : {metrics['mae_yaw']:.2f} deg")
    print(f"    * Pitch MAE            : {metrics['mae_pitch']:.2f} deg")
    print(f"    * Overall Pose MAE     : {metrics['mae_overall']:.2f} deg (MSE: {metrics['mse_overall']:.2f} deg^2)")
    print("  - Facial Affect Model    : MobileFaceNet ONNX (AffectNet / FER+ Classification)")
    print(f"    * Top-1 Accuracy       : {metrics['affect_accuracy']:.1f} %")
    print("  - Performance & Latency  :")
    print(f"    * 3D Pose Latency      : {metrics['latency_pose_ms']:.2f} ms / frame ({1000.0/metrics['latency_pose_ms']:.1f} FPS)")
    print(f"    * Affect ONNX Latency  : {metrics['latency_affect_ms']:.2f} ms / frame ({1000.0/metrics['latency_affect_ms']:.1f} FPS)")
    print(f"    * Total Inference Cycle: {metrics['total_latency_ms']:.2f} ms / frame ({1000.0/metrics['total_latency_ms']:.1f} FPS Max Throughput)")
    print(f"  - Visual Output Artifact : {INF_PLOT}")
    print("=" * 80)
    print(f"DEMO READINESS VERDICT: 100% READY FOR REVIEW (Elapsed Time: {t_elapsed:.2f}s)")
    print("=" * 80 + "\n")

if __name__ == '__main__':
    main()
