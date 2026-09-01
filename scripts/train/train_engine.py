"""
SKILLO AI - VISION MODEL TRAINING ENGINE (PHASE 1)
===================================================
Trains 3 MobileNetV2 vision models using PyTorch:
1. pose   : 3D Head Pose Regression (Yaw, Pitch, Roll) -> SmoothL1Loss
2. affect : 7-Class Emotion Classification            -> CrossEntropyLoss
3. gaze   : 3D Gaze Spherical Angle Regression        -> SmoothL1Loss

Epochs: 20 per model
Optimizer: AdamW (lr=1e-4, weight_decay=1e-2)
Outputs:
  - Checkpoints : scripts/train/checkpoints/best_<task>_model.pth
  - Curves      : scripts/train/plots/<task>_learning_curve.csv
"""

import os
import sys
import time
import cv2
import numpy as np
import pandas as pd
import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_ROOT = os.path.join(BASE_DIR, 'data')
CHECKPOINT_DIR = os.path.join(BASE_DIR, 'checkpoints')
PLOTS_DIR = os.path.join(BASE_DIR, 'plots')
os.makedirs(CHECKPOINT_DIR, exist_ok=True)
os.makedirs(PLOTS_DIR, exist_ok=True)

# ImageNet normalization constants
IMAGENET_MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)
IMAGENET_STD  = np.array([0.229, 0.224, 0.225], dtype=np.float32)

def preprocess_image(img_bgr: np.ndarray, target_size=(224, 224)) -> torch.Tensor:
    """Standardizes image to 224x224 RGB float32 tensor with ImageNet normalization."""
    img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
    img_resized = cv2.resize(img_rgb, target_size, interpolation=cv2.INTER_LINEAR)
    img_norm = (img_resized / 255.0 - IMAGENET_MEAN) / IMAGENET_STD
    # Convert HWC to CHW
    tensor = torch.from_numpy(img_norm.transpose(2, 0, 1)).float()
    return tensor


# ==============================================================================
# MODEL ARCHITECTURE: MobileNetV2 Backbone
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


# ==============================================================================
# DATASETS
# ==============================================================================
class PoseDataset(Dataset):
    def __init__(self, split='train'):
        records = []
        # 1. 3DDFA_V2
        df1 = pd.read_csv(os.path.join(DATA_ROOT, '3ddfa_v2', f'{split}.csv'))
        img_dir1 = os.path.join(DATA_ROOT, '3ddfa_v2', 'images')
        for _, r in df1.iterrows():
            img_p = os.path.join(img_dir1, r['filename'])
            if os.path.exists(img_p):
                records.append((img_p, [r['ground_truth_yaw'], r['ground_truth_pitch'], r['ground_truth_roll']]))

        # 2. BIWI
        df2 = pd.read_csv(os.path.join(DATA_ROOT, 'biwi', f'{split}.csv'))
        img_dir2 = os.path.join(DATA_ROOT, 'biwi', 'images')
        for _, r in df2.iterrows():
            img_p = os.path.join(img_dir2, r['filename'])
            if os.path.exists(img_p):
                records.append((img_p, [r['yaw_deg'], r['pitch_deg'], r['roll_deg']]))

        self.records = records

    def __len__(self):
        return len(self.records)

    def __getitem__(self, idx):
        img_path, target = self.records[idx]
        img = cv2.imread(img_path)
        tensor = preprocess_image(img)
        target_tensor = torch.tensor(target, dtype=torch.float32)
        return tensor, target_tensor


class AffectDataset(Dataset):
    def __init__(self, split='train'):
        df = pd.read_csv(os.path.join(DATA_ROOT, 'fer2013', f'{split}.csv'))
        img_dir = os.path.join(DATA_ROOT, 'fer2013', 'images')
        records = []
        for _, r in df.iterrows():
            img_p = os.path.join(img_dir, r['filename'])
            if os.path.exists(img_p):
                records.append((img_p, int(r['emotion_class_idx'])))
        self.records = records

    def __len__(self):
        return len(self.records)

    def __getitem__(self, idx):
        img_path, label = self.records[idx]
        img = cv2.imread(img_path)
        tensor = preprocess_image(img)
        return tensor, torch.tensor(label, dtype=torch.long)


class GazeDataset(Dataset):
    def __init__(self, split='train'):
        df = pd.read_csv(os.path.join(DATA_ROOT, 'mpiigaze', f'{split}.csv'))
        img_dir = os.path.join(DATA_ROOT, 'mpiigaze', 'images')
        records = []
        for _, r in df.iterrows():
            img_p = os.path.join(img_dir, r['filename'])
            if os.path.exists(img_p):
                records.append((img_p, [r['ground_truth_pitch'], r['ground_truth_yaw']]))
        self.records = records

    def __len__(self):
        return len(self.records)

    def __getitem__(self, idx):
        img_path, target = self.records[idx]
        img = cv2.imread(img_path)
        tensor = preprocess_image(img)
        return tensor, torch.tensor(target, dtype=torch.float32)


# ==============================================================================
# TRAINING LOOP
# ==============================================================================
def train_task(task_name: str, model: nn.Module, criterion: nn.Module, train_loader: DataLoader, val_loader: DataLoader, num_epochs=20):
    print(f"\n[{task_name.upper()}] Starting PyTorch Training (20 Epochs)...")
    optimizer = torch.optim.AdamW(model.parameters(), lr=1e-4, weight_decay=1e-2)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=num_epochs)

    best_val_loss = float('inf')
    best_checkpoint_path = os.path.join(CHECKPOINT_DIR, f'best_{task_name}_model.pth')
    history = []

    for epoch in range(1, num_epochs + 1):
        model.train()
        train_loss = 0.0
        for inputs, targets in train_loader:
            optimizer.zero_grad()
            outputs = model(inputs)
            loss = criterion(outputs, targets)
            loss.backward()
            optimizer.step()
            train_loss += loss.item() * inputs.size(0)

        train_loss /= len(train_loader.dataset)
        scheduler.step()

        # Validation
        model.eval()
        val_loss = 0.0
        val_metric = 0.0
        with torch.no_grad():
            for inputs, targets in val_loader:
                outputs = model(inputs)
                loss = criterion(outputs, targets)
                val_loss += loss.item() * inputs.size(0)
                if task_name == 'affect':
                    preds = torch.argmax(outputs, dim=1)
                    val_metric += (preds == targets).sum().item()
                else:
                    # MAE
                    mae = torch.mean(torch.abs(outputs - targets)).item()
                    val_metric += mae * inputs.size(0)

        val_loss /= len(val_loader.dataset)
        if task_name == 'affect':
            val_acc = (val_metric / len(val_loader.dataset)) * 100.0
            metric_str = f"Val Acc: {val_acc:.1f}%"
        else:
            val_mae = val_metric / len(val_loader.dataset)
            metric_str = f"Val MAE: {val_mae:.2f} deg"

        history.append({
            'epoch': epoch,
            'train_loss': round(train_loss, 4),
            'val_loss': round(val_loss, 4)
        })

        if val_loss < best_val_loss:
            best_val_loss = val_loss
            torch.save(model.state_dict(), best_checkpoint_path)
            saved_marker = " * [BEST]"
        else:
            saved_marker = ""

        if epoch % 5 == 0 or epoch == 1 or epoch == num_epochs:
            print(f"  Epoch {epoch:02d}/20 | Train Loss: {train_loss:.4f} | Val Loss: {val_loss:.4f} | {metric_str}{saved_marker}")

    # Save learning curve CSV
    curve_df = pd.DataFrame(history)
    curve_csv = os.path.join(PLOTS_DIR, f'{task_name}_learning_curve.csv')
    curve_df.to_csv(curve_csv, index=False)
    print(f"  [OK] Saved {task_name} checkpoint to: {best_checkpoint_path}")
    print(f"  [OK] Saved {task_name} learning curve to: {curve_csv}")


def main():
    t0 = time.time()
    torch.manual_seed(42)
    np.random.seed(42)

    print("=" * 80)
    print("  SKILLO AI - VISION MODEL MULTI-TASK TRAINING ENGINE (PHASE 1)")
    print("=" * 80)

    # 1. Pose Engine (Yaw, Pitch, Roll)
    pose_train = PoseDataset(split='train')
    pose_val   = PoseDataset(split='val')
    pose_train_loader = DataLoader(pose_train, batch_size=8, shuffle=True)
    pose_val_loader   = DataLoader(pose_val, batch_size=8, shuffle=False)
    pose_model = MobileNetV2VisionEngine(num_outputs=3, is_classifier=False)
    train_task('pose', pose_model, nn.SmoothL1Loss(), pose_train_loader, pose_val_loader, num_epochs=20)

    # 2. Affect Engine (7-class Emotion)
    affect_train = AffectDataset(split='train')
    affect_val   = AffectDataset(split='val')
    affect_train_loader = DataLoader(affect_train, batch_size=8, shuffle=True)
    affect_val_loader   = DataLoader(affect_val, batch_size=8, shuffle=False)
    affect_model = MobileNetV2VisionEngine(num_outputs=7, is_classifier=True)
    train_task('affect', affect_model, nn.CrossEntropyLoss(), affect_train_loader, affect_val_loader, num_epochs=20)

    # 3. Gaze Engine (Pitch, Yaw)
    gaze_train = GazeDataset(split='train')
    gaze_val   = GazeDataset(split='val')
    gaze_train_loader = DataLoader(gaze_train, batch_size=8, shuffle=True)
    gaze_val_loader   = DataLoader(gaze_val, batch_size=8, shuffle=False)
    gaze_model = MobileNetV2VisionEngine(num_outputs=2, is_classifier=False)
    train_task('gaze', gaze_model, nn.SmoothL1Loss(), gaze_train_loader, gaze_val_loader, num_epochs=20)

    elapsed = time.time() - t0
    print("\n" + "=" * 80)
    print(f"ALL 3 VISION MODELS TRAINED & CHECKPOINTED SUCCESSFULLY in {elapsed:.2f}s")
    print("=" * 80)

if __name__ == '__main__':
    main()
