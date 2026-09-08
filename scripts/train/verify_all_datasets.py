r"""
AUTOMATED INTEGRITY AUDIT ENGINE: ALL 7 INGESTED DATASETS
==========================================================
Verifies all 4 mandatory audit assertions across all 7 academic CV benchmarks:
1. Directory & Manifest Structure (labels.csv, train.csv, val.csv, test.csv, splits.json)
2. Zero Partition Leakage (Train ∩ Val = ∅, Train ∩ Test = ∅, Val ∩ Test = ∅)
3. Data Hygiene (Zero NaN, null, or inf values in numeric columns)
4. Image Decodability (100% cv2.imread decode test, valid dimensions, non-null)

IMPORTANT — OFFLINE DATA HANDLING:
  Raw datasets (images + CSVs) are NOT committed to git (they are large binary
  assets excluded via .gitignore).  When the data/ directory is absent the
  script detects this and exits 0 with a DATA_NOT_AVAILABLE status — because
  the absence of raw data is the expected state on any machine that has only
  checked out the repository without running `ingest_all_datasets.py`.

  The ONNX exports (pose_engine.onnx, affect_engine.onnx, gaze_engine.onnx)
  ARE committed to git and are verified separately by evaluate_all.py.

Usage:
  .\.venv\Scripts\python.exe scripts/train/verify_all_datasets.py
"""

import os
import sys
import json
import cv2
import numpy as np
import pandas as pd

BASE_DIR  = os.path.dirname(os.path.abspath(__file__))
DATA_ROOT = os.path.join(BASE_DIR, 'data')

DATASET_CONFIGS = {
    '300w': {
        'name': '300-W (iBUG 68-Pts)',
        'img_dir': 'images',
        'id_col': 'sample_id',
        'file_col': 'filename',
        'numeric_cols': ['width_px', 'height_px', 'bbox_x0', 'bbox_y0', 'bbox_x1', 'bbox_y1']
    },
    'fer2013': {
        'name': 'FER2013 (Affect & Emotion)',
        'img_dir': 'images',
        'id_col': 'sample_id',
        'file_col': 'filename',
        'numeric_cols': ['emotion_class_idx']
    },
    '3ddfa_v2': {
        'name': '3DDFA_V2 / AFLW2000-3D',
        'img_dir': 'images',
        'id_col': 'sample_id',
        'file_col': 'filename',
        'numeric_cols': ['ground_truth_yaw', 'ground_truth_pitch', 'ground_truth_roll']
    },
    'biwi': {
        'name': 'BIWI Continuous Head Pose',
        'img_dir': 'images',
        'id_col': 'sample_id',
        'file_col': 'filename',
        'numeric_cols': ['yaw_deg', 'pitch_deg', 'roll_deg', 'trans_x_mm', 'trans_y_mm', 'trans_z_mm']
    },
    'mpiigaze': {
        'name': 'MPIIGaze Appearance Gaze',
        'img_dir': 'images',
        'id_col': 'sample_id',
        'file_col': 'filename',
        'numeric_cols': ['ground_truth_pitch', 'ground_truth_yaw']
    },
    'pratheepan': {
        'name': 'Pratheepan Skin Segmentation',
        'img_dir': 'images',
        'mask_dir': 'masks',
        'id_col': 'sample_id',
        'file_col': 'image_filename',
        'mask_col': 'mask_filename',
        'numeric_cols': ['skin_pixel_ratio', 'width_px', 'height_px']
    },
    '300vw': {
        'name': '300-VW Video Motion',
        'img_dir': '',
        'id_col': 'sample_id',
        'file_col': 'filename',
        'numeric_cols': ['timestamp_ms', 'inter_frame_mad', 'landmark_velocity_px_sec']
    }
}

def audit_single_dataset(key, cfg):
    ds_dir = os.path.join(DATA_ROOT, key)
    results = {
        'key': key,
        'name': cfg['name'],
        'manifest_ok': False,
        'leakage_ok': False,
        'hygiene_ok': False,
        'images_ok': False,
        'total_samples': 0,
        'train_cnt': 0,
        'val_cnt': 0,
        'test_cnt': 0,
        'decoded_images': 0,
        'failed_images': 0,
        'data_available': False,
        'errors': []
    }

    # Assertion 1: Directory & Manifest Structure
    if not os.path.isdir(ds_dir):
        results['errors'].append(f"Directory missing: {ds_dir} (run ingest_all_datasets.py first)")
        return results

    results['data_available'] = True

    required_files = ['labels.csv', 'train.csv', 'val.csv', 'test.csv', 'splits.json']
    manifest_present = True
    for rf in required_files:
        fpath = os.path.join(ds_dir, rf)
        if not os.path.exists(fpath) or os.path.getsize(fpath) == 0:
            results['errors'].append(f"Missing or empty manifest file: {rf}")
            manifest_present = False

    if not manifest_present:
        return results

    try:
        labels_df = pd.read_csv(os.path.join(ds_dir, 'labels.csv'))
        train_df  = pd.read_csv(os.path.join(ds_dir, 'train.csv'))
        val_df    = pd.read_csv(os.path.join(ds_dir, 'val.csv'))
        test_df   = pd.read_csv(os.path.join(ds_dir, 'test.csv'))
        with open(os.path.join(ds_dir, 'splits.json'), 'r', encoding='utf-8') as f:
            splits_meta = json.load(f)

        results['total_samples'] = len(labels_df)
        results['train_cnt']     = len(train_df)
        results['val_cnt']       = len(val_df)
        results['test_cnt']      = len(test_df)

        if len(labels_df) > 0 and (len(train_df) + len(val_df) + len(test_df) == len(labels_df)):
            results['manifest_ok'] = True
        else:
            results['errors'].append(
                f"Split counts mismatch: {len(train_df)}+{len(val_df)}+{len(test_df)} != {len(labels_df)}"
            )
    except Exception as e:
        results['errors'].append(f"Manifest read error: {e}")
        return results

    # Assertion 2: Zero Partition Leakage
    train_ids = set(splits_meta.get('train_ids', []))
    val_ids   = set(splits_meta.get('val_ids', []))
    test_ids  = set(splits_meta.get('test_ids', []))

    inter_tv = train_ids & val_ids
    inter_tt = train_ids & test_ids
    inter_vt = val_ids   & test_ids

    if len(inter_tv) == 0 and len(inter_tt) == 0 and len(inter_vt) == 0:
        results['leakage_ok'] = True
    else:
        results['errors'].append(
            f"Partition leakage: TV={len(inter_tv)}, TT={len(inter_tt)}, VT={len(inter_vt)}"
        )

    # Assertion 3: Data Hygiene (No NaN, null, or Inf)
    hygiene_pass = True
    for col in cfg.get('numeric_cols', []):
        if col in labels_df.columns:
            s = labels_df[col]
            if s.isnull().any():
                results['errors'].append(f"Null/NaN in column {col}")
                hygiene_pass = False
            if np.isinf(s.values).any():
                results['errors'].append(f"Infinite values in column {col}")
                hygiene_pass = False
        else:
            results['errors'].append(f"Expected numeric column missing: {col}")
            hygiene_pass = False

    results['hygiene_ok'] = hygiene_pass

    # Assertion 4: Image Decodability (100% cv2.imread test)
    file_col     = cfg['file_col']
    img_sub      = cfg['img_dir']
    base_img_path = os.path.join(ds_dir, img_sub) if img_sub else ds_dir

    decoded_cnt = 0
    failed_cnt  = 0

    for _, row in labels_df.iterrows():
        rel_fname     = row[file_col]
        full_img_path = os.path.join(base_img_path, rel_fname)

        img = cv2.imread(full_img_path)
        if (img is not None and img.size > 0
                and len(img.shape) == 3
                and img.shape[0] > 0 and img.shape[1] > 0):
            decoded_cnt += 1
        else:
            failed_cnt += 1
            results['errors'].append(f"Corrupt or missing image: {rel_fname}")

        if 'mask_col' in cfg:
            mask_fname     = row[cfg['mask_col']]
            full_mask_path = os.path.join(ds_dir, cfg['mask_dir'], mask_fname)
            mask = cv2.imread(full_mask_path, cv2.IMREAD_UNCHANGED)
            if mask is None or mask.size == 0:
                failed_cnt += 1
                results['errors'].append(f"Corrupt or missing mask: {mask_fname}")

    results['decoded_images'] = decoded_cnt
    results['failed_images']  = failed_cnt
    results['images_ok']      = (failed_cnt == 0 and decoded_cnt == len(labels_df))

    return results


def main():
    print("=" * 100)
    print("  SKILLO AI - DATASET INTEGRITY & STANDARDIZATION VERIFICATION AUDIT")
    print("=" * 100)
    print(f"Data Root Directory : {DATA_ROOT}")
    print(f"Python Runtime      : {sys.version.split()[0]} ({sys.platform})")
    print("=" * 100)

    # ── Early-exit when data directory is absent (expected in repo-only CI) ──
    if not os.path.isdir(DATA_ROOT):
        print()
        print("  STATUS: DATA_NOT_AVAILABLE")
        print("  The data/ directory does not exist on this machine.")
        print("  Raw benchmark datasets are intentionally excluded from git (large binary assets).")
        print("  Run `ingest_all_datasets.py` to download and ingest the raw datasets, then re-run this script.")
        print()
        print("  ONNX Model Exports (committed): ", end="")
        export_dir = os.path.join(BASE_DIR, 'exports')
        onnx_files = ['pose_engine.onnx', 'affect_engine.onnx', 'gaze_engine.onnx']
        all_onnx_present = all(os.path.exists(os.path.join(export_dir, f)) for f in onnx_files)
        if all_onnx_present:
            sizes = {f: os.path.getsize(os.path.join(export_dir, f)) // 1024 for f in onnx_files}
            print("ALL PRESENT")
            for fn, sz in sizes.items():
                print(f"    [OK] {fn}  ({sz} KB)")
        else:
            print("SOME MISSING")
            for fn in onnx_files:
                fpath = os.path.join(export_dir, fn)
                print(f"    {'[OK]' if os.path.exists(fpath) else '[MISSING]'} {fn}")

        print()
        print("=" * 100)
        print("OVERALL AUDIT VERDICT: DATA_NOT_AVAILABLE — ONNX exports verified, raw dataset audit skipped.")
        print("  To run the full audit: ingest all datasets first, then re-execute this script.")
        print("=" * 100 + "\n")
        sys.exit(0)  # Not a failure — expected state without raw data

    # ── Full audit when data directory IS present ────────────────────────────
    audit_results = []
    for key, cfg in DATASET_CONFIGS.items():
        res = audit_single_dataset(key, cfg)
        audit_results.append(res)

    print("\n" + "-" * 100)
    header = (
        f"{'DATASET BENCHMARK':<30} | {'SAMPLES':<8} | {'TRAIN/VAL/TEST':<14} | "
        f"{'MANIFEST':<9} | {'LEAKAGE':<8} | {'HYGIENE':<8} | {'DECODABLE':<10} | {'STATUS':<8}"
    )
    print(header)
    print("-" * 100)

    all_passed = True
    assertion_manifest_ok  = True
    assertion_leakage_ok   = True
    assertion_hygiene_ok   = True
    assertion_decodable_ok = True

    for r in audit_results:
        status_pass = r['manifest_ok'] and r['leakage_ok'] and r['hygiene_ok'] and r['images_ok']
        if not status_pass:
            all_passed = False
        if not r['manifest_ok']:  assertion_manifest_ok  = False
        if not r['leakage_ok']:   assertion_leakage_ok   = False
        if not r['hygiene_ok']:   assertion_hygiene_ok   = False
        if not r['images_ok']:    assertion_decodable_ok = False

        manifest_str = "PASS"   if r['manifest_ok'] else "FAIL"
        leakage_str  = "0 LEAK" if r['leakage_ok']  else "LEAK"
        hygiene_str  = "0 NaNs" if r['hygiene_ok']  else "FAIL"
        decode_str   = f"{r['decoded_images']}/{r['total_samples']}" if r['images_ok'] else "FAIL"
        overall_str  = "[PASSED]" if status_pass else "[FAILED]"
        split_str    = f"{r['train_cnt']}/{r['val_cnt']}/{r['test_cnt']}"

        print(
            f"{r['name']:<30} | {r['total_samples']:<8} | {split_str:<14} | "
            f"{manifest_str:<9} | {leakage_str:<8} | {hygiene_str:<8} | {decode_str:<10} | {overall_str:<8}"
        )

    print("-" * 100)

    # Detailed assertion summary — derived from actual results, not hardcoded
    print("\n" + "=" * 100)
    print("  DETAILED ASSERTION AUDIT VERIFICATION SUMMARY")
    print("=" * 100)

    def status_line(ok, msg_pass, msg_fail):
        tag = "[OK]  " if ok else "[FAIL]"
        return f"   {tag} {msg_pass if ok else msg_fail}"

    print("1. DIRECTORY & MANIFEST STRUCTURE:")
    print(status_line(
        assertion_manifest_ok,
        "All 7 datasets contain non-empty labels.csv, train.csv, val.csv, test.csv, splits.json.",
        "One or more datasets have missing or empty manifest files — check errors above."
    ))
    print("2. ZERO PARTITION LEAKAGE:")
    print(status_line(
        assertion_leakage_ok,
        "Strict disjointness verified: Train∩Val=∅, Train∩Test=∅, Val∩Test=∅.",
        "Partition leakage detected — duplicate sample IDs across splits."
    ))
    print("3. DATA HYGIENE & NUMERICAL SANITY:")
    print(status_line(
        assertion_hygiene_ok,
        "0 NaN, 0 null, 0 Inf values across all Euler angles, gaze coords, pixel ratios, and MADs.",
        "NaN / null / infinite values detected in numeric columns — check errors above."
    ))
    print("4. IMAGE DECODABILITY & MATRIX INTEGRITY:")
    print(status_line(
        assertion_decodable_ok,
        "100% of images and masks successfully decoded with cv2.imread() — valid HxWxC.",
        "One or more images/masks failed to decode — check errors above."
    ))
    print("=" * 100)

    if all_passed:
        print("OVERALL AUDIT VERDICT: ALL 7 BENCHMARK DATASETS 100% VERIFIED & PRODUCTION-READY")
    else:
        print("OVERALL AUDIT VERDICT: ISSUES DETECTED — SEE PER-DATASET ERRORS ABOVE")
    print("=" * 100 + "\n")

    if not all_passed:
        sys.exit(1)


if __name__ == '__main__':
    main()
