"""
SKILLO AI - SHARED COMPUTER VISION PREPROCESSING MODULE (PROMPT 2 UPGRADE)
==========================================================================
Provides standardized, mathematically rigorous image-domain preprocessing:
1. White Balance Correction       : Gray-World color temperature normalization
2. Edge-Preserving Denoising      : Bilateral Filter (full-frame context) / Gaussian fallback
3. Blur-Based Quality Gating      : Variance of Laplacian sharpness estimation
4. Face ROI Square Crop           : Aspect-ratio preserving crop with 15% anatomical padding
5. Illumination Normalization     : CLAHE on L-channel (Lab space) / Gamma correction fallback
6. Geometric Standardization      : Bilinear interpolation to standard 224x224 px
7. Radiometric Scaling            : ImageNet mean/std channel normalization
"""

import cv2
import numpy as np
from typing import Tuple, Dict, Any, Optional

# ImageNet normalization constants
IMAGENET_MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)
IMAGENET_STD  = np.array([0.229, 0.224, 0.225], dtype=np.float32)


# ==============================================================================
# 1. WHITE BALANCE CORRECTION (Gray-World Algorithm)
# ==============================================================================
def correct_white_balance(img_bgr: np.ndarray, method: str = 'gray_world') -> np.ndarray:
    """
    Normalizes color temperature to achieve illuminant invariance.
    
    Gray-World Algorithm:
    Assumes average scene reflectance is neutral gray under canonical illumination.
    Scales each color channel (B, G, R) so their individual spatial means match
    the global cross-channel mean:
      K = (mean(B) + mean(G) + mean(R)) / 3.0
      S_c = K / mean(C) for C in {B, G, R}
      C_out = clamp(C_in * S_c, 0, 255)
    """
    if method != 'gray_world' or img_bgr is None or img_bgr.size == 0:
        return img_bgr

    img_float = img_bgr.astype(np.float32)
    b_mean = float(np.mean(img_float[:, :, 0]))
    g_mean = float(np.mean(img_float[:, :, 1]))
    r_mean = float(np.mean(img_float[:, :, 2]))

    # Prevent division by zero on pitch-black frames
    gray_mean = (b_mean + g_mean + r_mean) / 3.0
    if gray_mean < 1e-4:
        return img_bgr

    scale_b = gray_mean / max(b_mean, 1e-4)
    scale_g = gray_mean / max(g_mean, 1e-4)
    scale_r = gray_mean / max(r_mean, 1e-4)

    # Scale and clamp into valid 8-bit dynamic range
    out = np.empty_like(img_float)
    out[:, :, 0] = np.clip(img_float[:, :, 0] * scale_b, 0, 255)
    out[:, :, 1] = np.clip(img_float[:, :, 1] * scale_g, 0, 255)
    out[:, :, 2] = np.clip(img_float[:, :, 2] * scale_r, 0, 255)

    return out.astype(np.uint8)


# ==============================================================================
# 2. EDGE-PRESERVING DENOISING
# ==============================================================================
def denoise(
    img_bgr: np.ndarray,
    method: str = 'bilateral',
    d: int = 5,
    sigma_color: float = 50.0,
    sigma_space: float = 50.0
) -> np.ndarray:
    """
    Reduces high-frequency sensor/thermal noise while preserving structural edges.
    
    Bilateral filter uses both spatial Euclidean distance and photometric range intensity
    differences to smooth homogeneous regions without blurring facial landmark boundaries.
    """
    if img_bgr is None or img_bgr.size == 0:
        return img_bgr

    if method == 'bilateral':
        return cv2.bilateralFilter(
            img_bgr,
            d=d,
            sigmaColor=sigma_color,
            sigmaSpace=sigma_space
        )
    elif method == 'gaussian':
        return cv2.GaussianBlur(img_bgr, (3, 3), 0)
    else:
        return img_bgr


# ==============================================================================
# 3. ILLUMINATION NORMALIZATION (CLAHE on L-channel vs Gamma Correction)
# ==============================================================================
def normalize_illumination(
    img_bgr: np.ndarray,
    method: str = 'clahe',
    clip_limit: float = 2.0,
    tile_grid_size: Tuple[int, int] = (8, 8),
    gamma: float = 1.8
) -> np.ndarray:
    """
    Stabilizes facial luminance against severe shadows, underexposure, and glare.
    
    CLAHE Method:
    Transforms image to CIE Lab color space. Contrast Limited Adaptive Histogram
    Equalization is applied strictly to the L (Luminance) channel. Chrominance
    channels (a, b) remain completely untouched, strictly preserving natural skin tones.
    
    Gamma Method:
    Non-linear power-law transform I_out = 255 * (I_in / 255)^(1 / gamma)
    Evaluated via 256-entry lookup table for ultra-low latency fallback.
    """
    if img_bgr is None or img_bgr.size == 0:
        return img_bgr

    if method == 'clahe':
        lab = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2Lab)
        l, a, b = cv2.split(lab)
        clahe = cv2.createCLAHE(clipLimit=clip_limit, tileGridSize=tile_grid_size)
        l_norm = clahe.apply(l)
        lab_merged = cv2.merge((l_norm, a, b))
        return cv2.cvtColor(lab_merged, cv2.COLOR_Lab2BGR)

    elif method == 'gamma':
        inv_gamma = 1.0 / max(gamma, 1e-4)
        table = np.array([((i / 255.0) ** inv_gamma) * 255 for i in range(256)]).astype(np.uint8)
        return cv2.LUT(img_bgr, table)

    else:
        return img_bgr


# ==============================================================================
# 4. BLUR-BASED QUALITY GATING (Variance of Laplacian)
# ==============================================================================
def detect_blur_laplacian(img_bgr: np.ndarray) -> float:
    """
    Calculates the sharpness of an image using the Variance of Laplacian:
      Laplacian(I) = d^2I/dx^2 + d^2I/dy^2
      Var = sum((L(x,y) - mean(L))^2) / N
    High variance correlates with crisp, high-frequency edges; low variance indicates blur.
    """
    if img_bgr is None or img_bgr.size == 0:
        return 0.0

    if len(img_bgr.shape) == 3:
        gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
    else:
        gray = img_bgr

    laplacian = cv2.Laplacian(gray, cv2.CV_64F)
    variance = float(laplacian.var())
    return variance


def is_blurry(img_bgr: np.ndarray, threshold: float = 100.0) -> Tuple[bool, float]:
    """
    Quality gate helper. Returns (is_blurry, variance).
    """
    var = detect_blur_laplacian(img_bgr)
    return (var < threshold, var)


# ==============================================================================
# 5. GEOMETRIC ASPECT-PRESERVING SQUARE CROP
# ==============================================================================
def crop_centered_square(img_bgr: np.ndarray, pad_ratio: float = 0.15) -> np.ndarray:
    """
    Crops a centered square region with 15% contextual padding, preventing
    aspect-ratio distortion when resizing non-square camera frames.
    """
    h, w = img_bgr.shape[:2]
    side = int(max(h, w) * (1.0 + pad_ratio))
    cx, cy = w // 2, h // 2
    x0 = max(0, cx - side // 2)
    y0 = max(0, cy - side // 2)
    x1 = min(w, cx + side // 2)
    y1 = min(h, cy + side // 2)
    crop = img_bgr[y0:y1, x0:x1]
    return crop if crop.size > 0 else img_bgr


def crop_face_roi(
    img_bgr: np.ndarray,
    bbox: Optional[Tuple[int, int, int, int]] = None,
    pad_ratio: float = 0.15
) -> np.ndarray:
    """
    Crops facial bounding box with proportional padding to square dimensions.
    """
    h, w = img_bgr.shape[:2]
    if bbox is None:
        return crop_centered_square(img_bgr, pad_ratio=pad_ratio)

    x0, y0, x1, y1 = bbox
    bw = x1 - x0
    bh = y1 - y0
    cx = (x0 + x1) // 2
    cy = (y0 + y1) // 2
    side = int(max(bw, bh) * (1.0 + pad_ratio))

    crop_x0 = max(0, cx - side // 2)
    crop_y0 = max(0, cy - side // 2)
    crop_x1 = min(w, cx + side // 2)
    crop_y1 = min(h, cy + side // 2)

    crop = img_bgr[crop_y0:crop_y1, crop_x0:crop_x1]
    return crop if crop.size > 0 else img_bgr


# ==============================================================================
# 6. QUANTITATIVE METRIC: PSNR (Peak Signal-to-Noise Ratio)
# ==============================================================================
def compute_psnr(img1: np.ndarray, img2: np.ndarray) -> float:
    """
    Computes Peak Signal-to-Noise Ratio (dB) between two identical-dimension images.
    PSNR = 20 * log10(MAX_I / sqrt(MSE))
    """
    if img1.shape != img2.shape:
        return 0.0
    return float(cv2.PSNR(img1, img2))


# ==============================================================================
# 7. UNIFIED PIPELINE FUNCTION (DOCUMENTED STEP ORDER)
# ==============================================================================
def preprocess_face_pipeline(
    img_bgr: np.ndarray,
    target_size: Tuple[int, int] = (224, 224),
    enable_white_balance: bool = True,
    white_balance_method: str = 'gray_world',
    enable_denoise: bool = True,
    denoise_method: str = 'bilateral',
    enable_illumination: bool = True,
    illumination_method: str = 'clahe',
    gamma: float = 1.8,
    enable_quality_gate: bool = True,
    blur_threshold: float = 100.0,
    bbox: Optional[Tuple[int, int, int, int]] = None,
    pad_ratio: float = 0.15,
) -> Dict[str, Any]:
    """
    Executes the canonical, academically defended IVP preprocessing pipeline:
    
    ORDER OF OPERATIONS:
    1. White Balance Correction    : Gray-World color constancy on full frame
    2. Edge-Preserving Denoising   : Bilateral filtering on full frame (preserves edges & context)
    3. Blur Quality Gating         : Variance of Laplacian on full frame
    4. Face ROI Crop               : Aspect-ratio preserving square crop with 15% margin
    5. Illumination Normalization  : CLAHE on L-channel of localized face crop
    6. Geometric Standardization   : Bilinear resize to target 224x224 px
    7. Radiometric Scaling         : ImageNet channel normalization (NCHW tensor)
    
    Returns a dictionary of intermediate stages and final tensor output.
    """
    raw_h, raw_w = img_bgr.shape[:2]
    current = img_bgr.copy()

    # Step 1: White Balance Correction
    wb_img = correct_white_balance(current, method=white_balance_method) if enable_white_balance else current
    current = wb_img

    # Step 2: Edge-Preserving Denoising (full frame)
    denoised_img = denoise(current, method=denoise_method) if enable_denoise else current
    current = denoised_img

    # Step 3: Blur Quality Gate
    blur_var = detect_blur_laplacian(current)
    frame_is_blurry = blur_var < blur_threshold if enable_quality_gate else False

    # Step 4: Face ROI Crop (with 15% boundary context)
    face_crop = crop_face_roi(current, bbox=bbox, pad_ratio=pad_ratio)

    # Step 5: Illumination Normalization (on localized face ROI)
    if enable_illumination:
        illum_crop = normalize_illumination(face_crop, method=illumination_method, gamma=gamma)
    else:
        illum_crop = face_crop

    # Step 6: Geometric Standardization (224x224 Bilinear)
    resized_bgr = cv2.resize(illum_crop, target_size, interpolation=cv2.INTER_LINEAR)
    resized_rgb = cv2.cvtColor(resized_bgr, cv2.COLOR_BGR2RGB)

    # Step 7: Radiometric ImageNet Normalization
    img_float = resized_rgb.astype(np.float32) / 255.0
    norm_hwc = (img_float - IMAGENET_MEAN) / IMAGENET_STD
    tensor_nchw = np.expand_dims(norm_hwc.transpose(2, 0, 1), axis=0).astype(np.float32)

    return {
        'raw_bgr': img_bgr,
        'wb_bgr': wb_img,
        'denoised_bgr': denoised_img,
        'blur_variance': blur_var,
        'is_blurry': frame_is_blurry,
        'face_crop_bgr': face_crop,
        'illum_crop_bgr': illum_crop,
        'resized_224_rgb': resized_rgb,
        'normalized_tensor': tensor_nchw,
    }
