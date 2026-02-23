"""
WeatherWise — Model Evaluation Script
=======================================
Loads the trained XGBoost model and the original dataset, reconstructs the
held-out test set using the saved test indices, computes per-sample predictions
and confidence scores, and writes a detailed evaluation CSV plus console metrics.

Usage:
    python evaluate.py

Outputs:
    ml/results/evaluation_results.csv
"""

import os
import re
import warnings
import numpy as np
import pandas as pd
import joblib

from sklearn.metrics import (
    accuracy_score,
    classification_report,
    precision_score,
    recall_score,
    f1_score,
)

warnings.filterwarnings("ignore", category=UserWarning)

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_PATH = os.path.join(BASE_DIR, "data", "synthetic_storm_events.csv")
MODEL_PATH = os.path.join(BASE_DIR, "models", "weatherwise_model.joblib")
TEST_IDX_PATH = os.path.join(BASE_DIR, "results", "test_indices.npy")
RESULTS_DIR = os.path.join(BASE_DIR, "results")
OUTPUT_CSV = os.path.join(RESULTS_DIR, "evaluation_results.csv")

os.makedirs(RESULTS_DIR, exist_ok=True)

# ---------------------------------------------------------------------------
# Category mapping (must match train_model.py exactly)
# ---------------------------------------------------------------------------
CATEGORY_MAP = {
    "Tornado": "TORNADO",
    "Thunderstorm Wind": "SEVERE_THUNDERSTORM",
    "Hail": "SEVERE_THUNDERSTORM",
    "Flash Flood": "FLASH_FLOOD",
    "Winter Storm": "WINTER_STORM",
    "Hurricane": "HURRICANE",
    "Wildfire": "WILDFIRE",
}


# ---------------------------------------------------------------------------
# Feature engineering  (duplicated from train_model.py for standalone use)
# ---------------------------------------------------------------------------

def parse_damage(value: str) -> float:
    """Convert damage strings like '25K', '1.5M' to float dollars."""
    if pd.isna(value) or value == "" or value == "0":
        return 0.0
    value = str(value).strip().upper()
    match = re.match(r"^([\d.]+)\s*([KMB]?)$", value)
    if not match:
        try:
            return float(value)
        except ValueError:
            return 0.0
    number = float(match.group(1))
    suffix = match.group(2)
    multipliers = {"K": 1e3, "M": 1e6, "B": 1e9, "": 1.0}
    return number * multipliers.get(suffix, 1.0)


def cyclical_encode(values: pd.Series, period: float):
    """Return (sin, cos) cyclical encoding of *values* with given period."""
    radians = 2.0 * np.pi * values / period
    return np.sin(radians), np.cos(radians)


def extract_features(df: pd.DataFrame, le_state) -> pd.DataFrame:
    """Build the feature matrix from raw storm-event columns.

    Uses the *same* LabelEncoder that was fitted during training so that
    state codes are consistent.
    """
    feat = pd.DataFrame(index=df.index)

    # Month — cyclical
    month = df["BEGIN_YEARMONTH"].astype(str).str[-2:].astype(int)
    feat["month_sin"], feat["month_cos"] = cyclical_encode(month, 12.0)

    # Hour — cyclical
    hour = df["BEGIN_TIME"].astype(str).str.zfill(4).str[:2].astype(int)
    feat["hour_sin"], feat["hour_cos"] = cyclical_encode(hour, 24.0)

    # Geographic
    feat["lat"] = df["BEGIN_LAT"].astype(float)
    feat["lon"] = df["BEGIN_LON"].astype(float)

    # State — label encoded (using training-time encoder)
    feat["state_enc"] = le_state.transform(df["STATE"].astype(str))

    # Magnitude
    feat["magnitude"] = df["MAGNITUDE"].fillna(0).astype(float)

    # Damage estimate
    feat["damage_estimate"] = df["DAMAGE_PROPERTY"].apply(parse_damage)
    feat["damage_log"] = np.log1p(feat["damage_estimate"])

    # Is nighttime
    feat["is_nighttime"] = ((hour < 6) | (hour >= 21)).astype(int)

    # Season
    season_map = {
        12: "winter", 1: "winter", 2: "winter",
        3: "spring", 4: "spring", 5: "spring",
        6: "summer", 7: "summer", 8: "summer",
        9: "fall", 10: "fall", 11: "fall",
    }
    season = month.map(season_map)
    for s in ["spring", "summer", "fall", "winter"]:
        feat[f"season_{s}"] = (season == s).astype(int)

    # Casualties
    feat["deaths"] = df["DEATHS_DIRECT"].fillna(0).astype(int)
    feat["injuries"] = df["INJURIES_DIRECT"].fillna(0).astype(int)

    # Path length proxy
    dlat = df["END_LAT"].astype(float) - df["BEGIN_LAT"].astype(float)
    dlon = df["END_LON"].astype(float) - df["BEGIN_LON"].astype(float)
    feat["path_length"] = np.sqrt(dlat ** 2 + dlon ** 2)

    return feat


# ---------------------------------------------------------------------------
# Main evaluation
# ---------------------------------------------------------------------------

def main():
    print("=" * 65)
    print("  WeatherWise — Model Evaluation")
    print("=" * 65)

    # ------------------------------------------------------------------
    # 1. Load model artifact
    # ------------------------------------------------------------------
    print("\n[1/4] Loading model artifact ...")
    artifact = joblib.load(MODEL_PATH)
    model = artifact["model"]
    le_target = artifact["label_encoder_target"]
    le_state = artifact["label_encoder_state"]
    feature_names = artifact["feature_names"]
    categories = artifact["categories"]
    print(f"  Model loaded from {MODEL_PATH}")
    print(f"  Categories: {categories}")

    # ------------------------------------------------------------------
    # 2. Reconstruct held-out test set
    # ------------------------------------------------------------------
    print("\n[2/4] Loading data and reconstructing test set ...")
    df_full = pd.read_csv(DATA_PATH)
    test_indices = np.load(TEST_IDX_PATH)
    df_test = df_full.loc[test_indices].copy()
    df_test["TARGET"] = df_test["EVENT_TYPE"].map(CATEGORY_MAP)
    y_true_labels = df_test["TARGET"].values
    y_true = le_target.transform(y_true_labels)

    print(f"  Full dataset : {len(df_full):,} records")
    print(f"  Test set     : {len(df_test):,} records")

    # ------------------------------------------------------------------
    # 3. Predict
    # ------------------------------------------------------------------
    print("\n[3/4] Running predictions ...")
    X_test = extract_features(df_test, le_state)
    # Ensure column order matches training
    X_test = X_test[feature_names]

    y_pred = model.predict(X_test)
    y_prob = model.predict_proba(X_test)

    y_pred_labels = le_target.inverse_transform(y_pred)
    confidence = np.max(y_prob, axis=1)
    correct = (y_pred == y_true).astype(int)

    # ------------------------------------------------------------------
    # 4. Write results CSV
    # ------------------------------------------------------------------
    print("\n[4/4] Writing evaluation results ...")
    results_df = pd.DataFrame({
        "event_id": range(1, len(df_test) + 1),
        "true_type": y_true_labels,
        "predicted_type": y_pred_labels,
        "confidence": np.round(confidence, 4),
        "correct": correct,
    })
    results_df.to_csv(OUTPUT_CSV, index=False)
    print(f"  Results saved -> {OUTPUT_CSV}")

    # ------------------------------------------------------------------
    # Console metrics
    # ------------------------------------------------------------------
    acc = accuracy_score(y_true, y_pred)
    print("\n" + "-" * 65)
    print(f"  Overall Accuracy: {acc:.4f}  ({acc * 100:.2f}%)")
    print("-" * 65)

    print("\n  Per-class Metrics:")
    report = classification_report(
        y_true, y_pred, target_names=categories, digits=4,
    )
    print(report)

    # Confidence analysis
    correct_mask = correct == 1
    incorrect_mask = correct == 0

    avg_conf_correct = confidence[correct_mask].mean() if correct_mask.any() else 0.0
    avg_conf_incorrect = confidence[incorrect_mask].mean() if incorrect_mask.any() else 0.0

    print("-" * 65)
    print(f"  Avg confidence (correct predictions)   : {avg_conf_correct:.4f}")
    print(f"  Avg confidence (incorrect predictions)  : {avg_conf_incorrect:.4f}")
    print(f"  Confidence gap                          : {avg_conf_correct - avg_conf_incorrect:.4f}")
    print("-" * 65)

    # Per-class confidence breakdown
    print("\n  Per-class confidence breakdown:")
    print(f"  {'Category':<25s} {'Correct':>8s} {'Incorrect':>10s} {'Support':>8s}")
    print(f"  {'-' * 53}")
    for i, cat in enumerate(categories):
        mask_cat = y_true == i
        if not mask_cat.any():
            continue
        cat_correct = correct_mask & mask_cat
        cat_incorrect = incorrect_mask & mask_cat
        c_conf = confidence[cat_correct].mean() if cat_correct.any() else 0.0
        i_conf = confidence[cat_incorrect].mean() if cat_incorrect.any() else 0.0
        support = mask_cat.sum()
        print(f"  {cat:<25s} {c_conf:>8.4f} {i_conf:>10.4f} {support:>8d}")

    print("\n" + "=" * 65)
    print("  Evaluation complete.")
    print("=" * 65)


if __name__ == "__main__":
    main()
