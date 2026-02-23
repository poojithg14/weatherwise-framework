"""
WeatherWise — XGBoost Hazard-Type Classification Pipeline
==========================================================
Loads synthetic NOAA-style storm event data, engineers features, trains an
XGBoost multi-class classifier via GridSearchCV, evaluates on a held-out
test set, generates publication-quality figures, and persists the trained
model for downstream use by the WeatherWise backend.

Usage:
    python train_model.py

Outputs:
    ml/models/weatherwise_model.joblib
    ml/figures/confusion_matrix.png
    ml/figures/feature_importance.png
    ml/figures/roc_curves.png
    ml/figures/precision_recall_curves.png
"""

import os
import re
import warnings
import numpy as np
import pandas as pd
import joblib
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.ticker as mticker
import seaborn as sns

from sklearn.model_selection import train_test_split, GridSearchCV, StratifiedKFold
from sklearn.preprocessing import LabelEncoder, label_binarize
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    roc_curve,
    auc,
    precision_recall_curve,
    average_precision_score,
)
from xgboost import XGBClassifier

warnings.filterwarnings("ignore", category=UserWarning)

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_PATH = os.path.join(BASE_DIR, "data", "synthetic_storm_events.csv")
MODEL_DIR = os.path.join(BASE_DIR, "models")
FIG_DIR = os.path.join(BASE_DIR, "figures")
RESULTS_DIR = os.path.join(BASE_DIR, "results")
MODEL_PATH = os.path.join(MODEL_DIR, "weatherwise_model.joblib")

# Ensure output directories exist
for d in [MODEL_DIR, FIG_DIR, RESULTS_DIR]:
    os.makedirs(d, exist_ok=True)

# ---------------------------------------------------------------------------
# Global plot style — clean, white background, Arial font
# ---------------------------------------------------------------------------
plt.rcParams.update({
    "figure.facecolor": "white",
    "axes.facecolor": "white",
    "savefig.facecolor": "white",
    "font.family": "sans-serif",
    "font.sans-serif": ["Arial", "Helvetica", "DejaVu Sans"],
    "font.size": 11,
    "axes.titlesize": 13,
    "axes.labelsize": 11,
    "xtick.labelsize": 10,
    "ytick.labelsize": 10,
    "legend.fontsize": 9,
    "figure.dpi": 150,
    "savefig.dpi": 300,
    "axes.grid": False,
    "axes.spines.top": False,
    "axes.spines.right": False,
})

# Colour palette — distinct, colourblind-friendly
PALETTE = ["#E63946", "#457B9D", "#2A9D8F", "#E9C46A", "#F4A261", "#264653"]

# Category mapping
CATEGORY_MAP = {
    "Tornado": "TORNADO",
    "Thunderstorm Wind": "SEVERE_THUNDERSTORM",
    "Hail": "SEVERE_THUNDERSTORM",
    "Flash Flood": "FLASH_FLOOD",
    "Winter Storm": "WINTER_STORM",
    "Hurricane": "HURRICANE",
    "Wildfire": "WILDFIRE",
}
CATEGORIES = ["TORNADO", "SEVERE_THUNDERSTORM", "FLASH_FLOOD",
              "WINTER_STORM", "HURRICANE", "WILDFIRE"]

# ---------------------------------------------------------------------------
# Feature engineering helpers
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


def extract_features(df: pd.DataFrame) -> pd.DataFrame:
    """Build the feature matrix from raw storm-event columns."""
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

    # State — label encoded
    le_state = LabelEncoder()
    feat["state_enc"] = le_state.fit_transform(df["STATE"].astype(str))

    # Magnitude
    feat["magnitude"] = df["MAGNITUDE"].fillna(0).astype(float)

    # Damage estimate (parsed)
    feat["damage_estimate"] = df["DAMAGE_PROPERTY"].apply(parse_damage)
    # Log-transform damage to reduce skew
    feat["damage_log"] = np.log1p(feat["damage_estimate"])

    # Is nighttime (before 6 AM or after 9 PM)
    feat["is_nighttime"] = ((hour < 6) | (hour >= 21)).astype(int)

    # Season (one-hot encoded into 4 binary columns)
    season_map = {
        12: "winter", 1: "winter", 2: "winter",
        3: "spring", 4: "spring", 5: "spring",
        6: "summer", 7: "summer", 8: "summer",
        9: "fall", 10: "fall", 11: "fall",
    }
    season = month.map(season_map)
    for s in ["spring", "summer", "fall", "winter"]:
        feat[f"season_{s}"] = (season == s).astype(int)

    # Casualties features
    feat["deaths"] = df["DEATHS_DIRECT"].fillna(0).astype(int)
    feat["injuries"] = df["INJURIES_DIRECT"].fillna(0).astype(int)

    # Path length proxy (Euclidean distance between begin/end coords)
    dlat = df["END_LAT"].astype(float) - df["BEGIN_LAT"].astype(float)
    dlon = df["END_LON"].astype(float) - df["BEGIN_LON"].astype(float)
    feat["path_length"] = np.sqrt(dlat ** 2 + dlon ** 2)

    return feat, le_state


# ---------------------------------------------------------------------------
# Plotting helpers
# ---------------------------------------------------------------------------

def plot_confusion_matrix(y_true, y_pred, labels, path):
    """Annotated confusion-matrix heatmap."""
    cm = confusion_matrix(y_true, y_pred, labels=range(len(labels)))
    cm_pct = cm.astype(float) / cm.sum(axis=1, keepdims=True) * 100

    fig, ax = plt.subplots(figsize=(8, 6.5))
    sns.heatmap(
        cm, annot=True, fmt="d", cmap="Blues", xticklabels=labels,
        yticklabels=labels, linewidths=0.5, linecolor="white",
        cbar_kws={"label": "Count"}, ax=ax,
    )
    # Overlay percentages in smaller font
    for i in range(cm.shape[0]):
        for j in range(cm.shape[1]):
            ax.text(j + 0.5, i + 0.72, f"({cm_pct[i, j]:.0f}%)",
                    ha="center", va="center", fontsize=7, color="gray")

    ax.set_xlabel("Predicted Hazard Type")
    ax.set_ylabel("True Hazard Type")
    ax.set_title("WeatherWise — Confusion Matrix", fontweight="bold")
    plt.tight_layout()
    fig.savefig(path, dpi=300, bbox_inches="tight")
    plt.close(fig)
    print(f"  Saved: {path}")


def plot_feature_importance(model, feature_names, path, top_n=15):
    """Horizontal bar chart of the top-N most important features."""
    importance = model.feature_importances_
    indices = np.argsort(importance)[-top_n:]
    top_names = [feature_names[i] for i in indices]
    top_values = importance[indices]

    fig, ax = plt.subplots(figsize=(7, 5.5))
    bars = ax.barh(range(top_n), top_values, color=PALETTE[1], edgecolor="white",
                   height=0.65)
    ax.set_yticks(range(top_n))
    ax.set_yticklabels(top_names)
    ax.set_xlabel("Feature Importance (Gain)")
    ax.set_title("WeatherWise — Top 15 Feature Importances", fontweight="bold")

    # Value labels
    for bar, val in zip(bars, top_values):
        ax.text(bar.get_width() + importance.max() * 0.01,
                bar.get_y() + bar.get_height() / 2,
                f"{val:.3f}", va="center", fontsize=8)

    plt.tight_layout()
    fig.savefig(path, dpi=300, bbox_inches="tight")
    plt.close(fig)
    print(f"  Saved: {path}")


def plot_roc_curves(y_test_bin, y_prob, labels, path):
    """One-vs-rest ROC curve per hazard type with AUC in legend."""
    fig, ax = plt.subplots(figsize=(7, 6))
    for i, (label, colour) in enumerate(zip(labels, PALETTE)):
        fpr, tpr, _ = roc_curve(y_test_bin[:, i], y_prob[:, i])
        roc_auc = auc(fpr, tpr)
        ax.plot(fpr, tpr, color=colour, lw=2,
                label=f"{label}  (AUC = {roc_auc:.3f})")

    ax.plot([0, 1], [0, 1], "k--", lw=0.8, alpha=0.4)
    ax.set_xlim([-0.02, 1.02])
    ax.set_ylim([-0.02, 1.02])
    ax.set_xlabel("False Positive Rate")
    ax.set_ylabel("True Positive Rate")
    ax.set_title("WeatherWise — ROC Curves (One-vs-Rest)", fontweight="bold")
    ax.legend(loc="lower right", frameon=True, fancybox=False, edgecolor="gray")
    plt.tight_layout()
    fig.savefig(path, dpi=300, bbox_inches="tight")
    plt.close(fig)
    print(f"  Saved: {path}")


def plot_precision_recall_curves(y_test_bin, y_prob, labels, path):
    """Precision-Recall curve per hazard type with AP in legend."""
    fig, ax = plt.subplots(figsize=(7, 6))
    for i, (label, colour) in enumerate(zip(labels, PALETTE)):
        precision, recall, _ = precision_recall_curve(y_test_bin[:, i], y_prob[:, i])
        ap = average_precision_score(y_test_bin[:, i], y_prob[:, i])
        ax.plot(recall, precision, color=colour, lw=2,
                label=f"{label}  (AP = {ap:.3f})")

    ax.set_xlim([-0.02, 1.02])
    ax.set_ylim([-0.02, 1.02])
    ax.set_xlabel("Recall")
    ax.set_ylabel("Precision")
    ax.set_title("WeatherWise — Precision-Recall Curves", fontweight="bold")
    ax.legend(loc="lower left", frameon=True, fancybox=False, edgecolor="gray")
    plt.tight_layout()
    fig.savefig(path, dpi=300, bbox_inches="tight")
    plt.close(fig)
    print(f"  Saved: {path}")


# ---------------------------------------------------------------------------
# Main pipeline
# ---------------------------------------------------------------------------

def main():
    print("=" * 65)
    print("  WeatherWise — XGBoost Hazard Classification Training Pipeline")
    print("=" * 65)

    # ------------------------------------------------------------------
    # 1. Load data
    # ------------------------------------------------------------------
    print("\n[1/6] Loading data ...")
    df = pd.read_csv(DATA_PATH)
    print(f"  Loaded {len(df):,} records from {DATA_PATH}")

    # ------------------------------------------------------------------
    # 2. Map target to 6 categories
    # ------------------------------------------------------------------
    print("\n[2/6] Mapping event types to 6 hazard categories ...")
    df["TARGET"] = df["EVENT_TYPE"].map(CATEGORY_MAP)
    assert df["TARGET"].notna().all(), "Unmapped event types found!"

    le_target = LabelEncoder()
    le_target.fit(CATEGORIES)
    y = le_target.transform(df["TARGET"])

    print("  Category distribution:")
    for cat in CATEGORIES:
        cnt = (df["TARGET"] == cat).sum()
        print(f"    {cat:<25s} {cnt:>5,}  ({cnt / len(df) * 100:5.1f}%)")

    # ------------------------------------------------------------------
    # 3. Feature engineering
    # ------------------------------------------------------------------
    print("\n[3/6] Engineering features ...")
    X, le_state = extract_features(df)
    feature_names = list(X.columns)
    print(f"  Features ({len(feature_names)}): {feature_names}")

    # ------------------------------------------------------------------
    # 4. Train/test split — stratified 80/20
    # ------------------------------------------------------------------
    print("\n[4/6] Splitting data (80/20 stratified) ...")
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.20, random_state=42, stratify=y,
    )
    print(f"  Train: {len(X_train):,}   Test: {len(X_test):,}")

    # Save test indices for evaluate.py
    test_indices_path = os.path.join(RESULTS_DIR, "test_indices.npy")
    np.save(test_indices_path, X_test.index.values)
    print(f"  Saved test indices -> {test_indices_path}")

    # ------------------------------------------------------------------
    # 5. XGBoost GridSearchCV
    # ------------------------------------------------------------------
    print("\n[5/6] Training XGBoost with GridSearchCV ...")
    print("  (This may take a few minutes ...)\n")

    xgb = XGBClassifier(
        objective="multi:softprob",
        num_class=len(CATEGORIES),
        eval_metric="mlogloss",
        use_label_encoder=False,
        random_state=42,
        n_jobs=-1,
        verbosity=0,
    )

    param_grid = {
        "n_estimators": [100, 200, 300],
        "max_depth": [4, 6, 8],
        "learning_rate": [0.01, 0.05, 0.1],
        "subsample": [0.8, 1.0],
    }

    cv = StratifiedKFold(n_splits=3, shuffle=True, random_state=42)
    grid = GridSearchCV(
        estimator=xgb,
        param_grid=param_grid,
        cv=cv,
        scoring="accuracy",
        verbose=1,
        n_jobs=-1,
        refit=True,
    )
    grid.fit(X_train, y_train)

    best_model = grid.best_estimator_
    print(f"\n  Best parameters : {grid.best_params_}")
    print(f"  Best CV accuracy: {grid.best_score_:.4f}")

    # ------------------------------------------------------------------
    # 6. Evaluate on test set
    # ------------------------------------------------------------------
    print("\n[6/6] Evaluating on test set ...")
    y_pred = best_model.predict(X_test)
    y_prob = best_model.predict_proba(X_test)
    acc = accuracy_score(y_test, y_pred)

    print(f"\n  Test Accuracy: {acc:.4f}  ({acc * 100:.2f}%)\n")
    report = classification_report(y_test, y_pred, target_names=CATEGORIES, digits=4)
    print(report)

    # ------------------------------------------------------------------
    # 7. Save model artifact
    # ------------------------------------------------------------------
    artifact = {
        "model": best_model,
        "label_encoder_target": le_target,
        "label_encoder_state": le_state,
        "feature_names": feature_names,
        "categories": CATEGORIES,
        "best_params": grid.best_params_,
        "test_accuracy": acc,
    }
    joblib.dump(artifact, MODEL_PATH)
    print(f"  Model saved -> {MODEL_PATH}")

    # ------------------------------------------------------------------
    # 8. Generate publication figures
    # ------------------------------------------------------------------
    print("\n  Generating figures (300 DPI) ...")
    y_test_bin = label_binarize(y_test, classes=range(len(CATEGORIES)))

    plot_confusion_matrix(
        y_test, y_pred, CATEGORIES,
        os.path.join(FIG_DIR, "confusion_matrix.png"),
    )
    plot_feature_importance(
        best_model, feature_names,
        os.path.join(FIG_DIR, "feature_importance.png"),
    )
    plot_roc_curves(
        y_test_bin, y_prob, CATEGORIES,
        os.path.join(FIG_DIR, "roc_curves.png"),
    )
    plot_precision_recall_curves(
        y_test_bin, y_prob, CATEGORIES,
        os.path.join(FIG_DIR, "precision_recall_curves.png"),
    )

    # ------------------------------------------------------------------
    # 9. Paper-ready summary
    # ------------------------------------------------------------------
    print("\n" + "=" * 65)
    print("  PAPER SUMMARY  (copy-paste into manuscript)")
    print("=" * 65)
    print(f"""
Model            : XGBoost (multi:softprob)
Best parameters  : {grid.best_params_}
Cross-val acc.   : {grid.best_score_:.4f}
Test accuracy    : {acc:.4f}
Num. features    : {len(feature_names)}
Training samples : {len(X_train):,}
Test samples     : {len(X_test):,}
Categories       : {', '.join(CATEGORIES)}

Classification Report:
{report}
""")
    print("=" * 65)
    print("  Pipeline complete.")
    print("=" * 65)


if __name__ == "__main__":
    main()
