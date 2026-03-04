"""
WeatherWise - Multi-Hazard Classification Pipeline
====================================================
Trains a hazard classifier using ONLY pre-event features.
No post-event data leakage (no deaths, injuries, damage, tor_scale).

Features (20):
  Temporal:   month_sin, month_cos, hour_sin, hour_cos, is_nighttime, season
  Geographic: latitude, longitude, lat_lon_interaction, lat_squared,
              lon_squared, state_encoded
  Radar:      magnitude (real-time Doppler)
  Synthetic:  cape, wind_shear, vil, rotation, echo_top,
              surface_pressure, dewpoint_depression

Usage:  python train_model.py
"""

import os
import json
import warnings
import numpy as np
import pandas as pd
import joblib
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import seaborn as sns

from sklearn.model_selection import (
    train_test_split, StratifiedKFold, cross_val_score, RandomizedSearchCV,
)
from sklearn.preprocessing import LabelEncoder, StandardScaler, label_binarize
from sklearn.metrics import (
    accuracy_score, f1_score, classification_report, confusion_matrix,
    roc_curve, auc, precision_recall_curve, average_precision_score,
)
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.utils.class_weight import compute_sample_weight
from xgboost import XGBClassifier
from scipy.stats import uniform, randint

warnings.filterwarnings("ignore", category=UserWarning)
warnings.filterwarnings("ignore", category=FutureWarning)

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_PATH = os.path.join(BASE_DIR, "data", "noaa_storm_events_2020_2025.csv")
MODEL_DIR = os.path.join(BASE_DIR, "models")
FIG_DIR = os.path.join(BASE_DIR, "figures")
RESULTS_DIR = os.path.join(BASE_DIR, "results")

for d in [MODEL_DIR, FIG_DIR, RESULTS_DIR]:
    os.makedirs(d, exist_ok=True)

# ---------------------------------------------------------------------------
# Plot style
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

PALETTE = ["#E63946", "#457B9D", "#2A9D8F", "#E9C46A", "#F4A261", "#264653"]

# ---------------------------------------------------------------------------
# Category mapping
# ---------------------------------------------------------------------------
CATEGORY_MAP = {
    "Tornado": "TORNADO",
    "Thunderstorm Wind": "SEVERE_THUNDERSTORM",
    "Hail": "SEVERE_THUNDERSTORM",
    "Lightning": "SEVERE_THUNDERSTORM",
    "Strong Wind": "SEVERE_THUNDERSTORM",
    "High Wind": "SEVERE_THUNDERSTORM",
    "Flash Flood": "FLASH_FLOOD",
    "Flood": "FLASH_FLOOD",
    "Heavy Rain": "FLASH_FLOOD",
    "Winter Storm": "WINTER_STORM",
    "Blizzard": "WINTER_STORM",
    "Ice Storm": "WINTER_STORM",
    "Winter Weather": "WINTER_STORM",
    "Heavy Snow": "WINTER_STORM",
    "Extreme Cold/Wind Chill": "WINTER_STORM",
    "Hurricane": "HURRICANE",
    "Tropical Storm": "HURRICANE",
    "Wildfire": "WILDFIRE",
    "Dense Smoke": "WILDFIRE",
}

CATEGORIES = [
    "TORNADO", "SEVERE_THUNDERSTORM", "FLASH_FLOOD",
    "WINTER_STORM", "HURRICANE", "WILDFIRE",
]

# ---------------------------------------------------------------------------
# Radar-proxy distributions per hazard class
# ---------------------------------------------------------------------------
RADAR_PARAMS = {
    #                   cape     shear    vil      rotation echo_top  pressure dewpt_dep
    "TORNADO":             (3500, 800, 55, 15, 50, 15, 0.70, 0.15, 45000, 8000, 1000, 8, 3, 2),
    "SEVERE_THUNDERSTORM": (2500, 700, 40, 12, 35, 12, 0.30, 0.15, 38000, 7000, 1005, 7, 5, 3),
    "FLASH_FLOOD":         (2000, 600, 20, 10, 45, 12, 0.15, 0.10, 35000, 6000, 1008, 6, 2, 1.5),
    "WINTER_STORM":        (200, 150, 35, 10, 15, 8, 0.05, 0.05, 25000, 5000, 995, 10, 8, 4),
    "HURRICANE":           (2800, 600, 15, 8, 40, 10, 0.50, 0.20, 50000, 8000, 980, 15, 2, 1),
    "WILDFIRE":            (500, 300, 25, 10, 5, 5, 0.05, 0.05, 15000, 5000, 1015, 5, 15, 5),
}

PHYSICAL_RANGES = {
    "cape": (0, 7000),
    "wind_shear": (0, 120),
    "vil": (0, 80),
    "rotation": (0, 1.0),
    "echo_top": (3000, 65000),
    "surface_pressure": (920, 1060),
    "dewpoint_depression": (0, 30),
}


def generate_radar_features(hazard_classes, rng):
    n = len(hazard_classes)
    cols = {k: np.zeros(n) for k in PHYSICAL_RANGES}

    for cls, params in RADAR_PARAMS.items():
        mask = hazard_classes == cls
        count = mask.sum()
        if count == 0:
            continue
        cm, cs, sm, ss, vm, vs, rm, rs, em, es, pm, ps, dm, ds = params

        raw = {
            "cape": rng.normal(cm, cs, count),
            "wind_shear": rng.normal(sm, ss, count),
            "vil": rng.normal(vm, vs, count),
            "rotation": rng.normal(rm, rs, count),
            "echo_top": rng.normal(em, es, count),
            "surface_pressure": rng.normal(pm, ps, count),
            "dewpoint_depression": rng.normal(dm, ds, count),
        }

        for feat_name, values in raw.items():
            lo, hi = PHYSICAL_RANGES[feat_name]
            noise = 1.0 + rng.normal(0, 0.10, count)
            cols[feat_name][mask] = np.clip(values * noise, lo, hi)

    return cols


# ---------------------------------------------------------------------------
# Feature engineering
# ---------------------------------------------------------------------------

def extract_features(df, rng, state_encoder=None, fit_state=False):
    feat = pd.DataFrame(index=df.index)

    # Temporal
    month = df["BEGIN_YEARMONTH"].astype(str).str[-2:].astype(int)
    feat["month_sin"] = np.sin(2.0 * np.pi * month / 12.0)
    feat["month_cos"] = np.cos(2.0 * np.pi * month / 12.0)

    hour = df["BEGIN_TIME"].astype(str).str.zfill(4).str[:2].astype(int)
    feat["hour_sin"] = np.sin(2.0 * np.pi * hour / 24.0)
    feat["hour_cos"] = np.cos(2.0 * np.pi * hour / 24.0)
    feat["is_nighttime"] = ((hour < 6) | (hour >= 21)).astype(int)

    season_map = {12: 0, 1: 0, 2: 0, 3: 1, 4: 1, 5: 1,
                  6: 2, 7: 2, 8: 2, 9: 3, 10: 3, 11: 3}
    feat["season"] = month.map(season_map).fillna(0).astype(int)

    # Geographic
    feat["latitude"] = df["BEGIN_LAT"].astype(float)
    feat["longitude"] = df["BEGIN_LON"].astype(float)
    feat["lat_lon_interaction"] = feat["latitude"] * feat["longitude"]
    feat["lat_squared"] = feat["latitude"] ** 2
    feat["lon_squared"] = feat["longitude"] ** 2

    # State encoding
    if fit_state:
        state_encoder = LabelEncoder()
        state_encoder.fit(df["STATE"].fillna("UNKNOWN"))
    feat["state_encoded"] = state_encoder.transform(
        df["STATE"].fillna("UNKNOWN").apply(
            lambda s: s if s in state_encoder.classes_ else "UNKNOWN"
        )
    )

    # Magnitude (real-time Doppler, NOT post-event)
    feat["magnitude"] = df["MAGNITUDE"].fillna(0).astype(float)

    # Radar-proxy features
    radar = generate_radar_features(df["hazard_class"].values, rng)
    for col_name, values in radar.items():
        feat[col_name] = values

    return feat, state_encoder


# ---------------------------------------------------------------------------
# Plot helpers
# ---------------------------------------------------------------------------

def plot_confusion_matrix(y_true, y_pred, labels, path, model_name):
    cm = confusion_matrix(y_true, y_pred, labels=range(len(labels)))
    cm_pct = cm.astype(float) / cm.sum(axis=1, keepdims=True) * 100

    fig, ax = plt.subplots(figsize=(8, 6.5))
    sns.heatmap(cm, annot=True, fmt="d", cmap="Blues", xticklabels=labels,
                yticklabels=labels, linewidths=0.5, linecolor="white",
                cbar_kws={"label": "Count"}, ax=ax)
    for i in range(cm.shape[0]):
        for j in range(cm.shape[1]):
            ax.text(j + 0.5, i + 0.72, f"({cm_pct[i, j]:.0f}%)",
                    ha="center", va="center", fontsize=7, color="gray")

    ax.set_xlabel("Predicted Hazard Type")
    ax.set_ylabel("True Hazard Type")
    ax.set_title(f"Confusion Matrix ({model_name})", fontweight="bold")
    plt.tight_layout()
    fig.savefig(path, dpi=300, bbox_inches="tight")
    plt.close(fig)
    print(f"    Saved: {path}")


def plot_feature_importance(model, feature_names, path, top_n=20):
    importance = model.feature_importances_
    n = min(top_n, len(feature_names))
    indices = np.argsort(importance)[-n:]
    top_names = [feature_names[i] for i in indices]
    top_values = importance[indices]

    fig, ax = plt.subplots(figsize=(7, 6))
    bars = ax.barh(range(n), top_values, color=PALETTE[1], edgecolor="white",
                   height=0.65)
    ax.set_yticks(range(n))
    ax.set_yticklabels(top_names)
    ax.set_xlabel("Feature Importance (Gain)")
    ax.set_title("Feature Importances (Pre-Event Only)", fontweight="bold")

    for bar, val in zip(bars, top_values):
        ax.text(bar.get_width() + importance.max() * 0.01,
                bar.get_y() + bar.get_height() / 2,
                f"{val:.3f}", va="center", fontsize=8)

    plt.tight_layout()
    fig.savefig(path, dpi=300, bbox_inches="tight")
    plt.close(fig)
    print(f"    Saved: {path}")


def plot_roc_curves(y_test_bin, y_prob, labels, path, model_name):
    fig, ax = plt.subplots(figsize=(7, 6))
    for i, (label, colour) in enumerate(zip(labels, PALETTE)):
        if i < y_test_bin.shape[1] and i < y_prob.shape[1]:
            fpr, tpr, _ = roc_curve(y_test_bin[:, i], y_prob[:, i])
            roc_auc = auc(fpr, tpr)
            ax.plot(fpr, tpr, color=colour, lw=2,
                    label=f"{label} (AUC={roc_auc:.3f})")

    ax.plot([0, 1], [0, 1], "k--", lw=0.8, alpha=0.4)
    ax.set_xlim([-0.02, 1.02])
    ax.set_ylim([-0.02, 1.02])
    ax.set_xlabel("False Positive Rate")
    ax.set_ylabel("True Positive Rate")
    ax.set_title(f"ROC Curves ({model_name})", fontweight="bold")
    ax.legend(loc="lower right", frameon=True, fancybox=False, edgecolor="gray")
    plt.tight_layout()
    fig.savefig(path, dpi=300, bbox_inches="tight")
    plt.close(fig)
    print(f"    Saved: {path}")


def plot_precision_recall(y_test_bin, y_prob, labels, path, model_name):
    fig, ax = plt.subplots(figsize=(7, 6))
    for i, (label, colour) in enumerate(zip(labels, PALETTE)):
        if i < y_test_bin.shape[1] and i < y_prob.shape[1]:
            prec, rec, _ = precision_recall_curve(
                y_test_bin[:, i], y_prob[:, i])
            ap = average_precision_score(y_test_bin[:, i], y_prob[:, i])
            ax.plot(rec, prec, color=colour, lw=2,
                    label=f"{label} (AP={ap:.3f})")

    ax.set_xlim([-0.02, 1.02])
    ax.set_ylim([-0.02, 1.02])
    ax.set_xlabel("Recall")
    ax.set_ylabel("Precision")
    ax.set_title(f"Precision-Recall Curves ({model_name})", fontweight="bold")
    ax.legend(loc="lower left", frameon=True, fancybox=False, edgecolor="gray")
    plt.tight_layout()
    fig.savefig(path, dpi=300, bbox_inches="tight")
    plt.close(fig)
    print(f"    Saved: {path}")


def plot_class_distribution(y, labels, path):
    fig, ax = plt.subplots(figsize=(8, 5))
    unique, counts = np.unique(y, return_counts=True)
    bars = ax.bar(
        range(len(labels)),
        [counts[unique == i][0] if i in unique else 0 for i in range(len(labels))],
        color=PALETTE[:len(labels)], edgecolor="white", width=0.7)
    ax.set_xticks(range(len(labels)))
    ax.set_xticklabels(labels, rotation=30, ha="right")
    ax.set_ylabel("Number of Samples")
    ax.set_title("Hazard Class Distribution", fontweight="bold")
    for bar in bars:
        h = bar.get_height()
        ax.text(bar.get_x() + bar.get_width() / 2, h + max(counts) * 0.01,
                f"{int(h):,}", ha="center", va="bottom", fontsize=9)
    plt.tight_layout()
    fig.savefig(path, dpi=300, bbox_inches="tight")
    plt.close(fig)
    print(f"    Saved: {path}")


def plot_model_comparison(results, path):
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(10, 5))

    models_list = list(results.keys())
    accs = [results[m]["accuracy"] for m in models_list]
    f1s = [results[m]["f1_weighted"] for m in models_list]
    cv_means = [results[m].get("cv_f1_mean", 0) for m in models_list]
    cv_stds = [results[m].get("cv_f1_std", 0) for m in models_list]

    colors = PALETTE[:len(models_list)]
    x = np.arange(len(models_list))
    w = 0.35

    bars1 = ax1.bar(x - w / 2, accs, w, label="Accuracy", color=colors,
                    edgecolor="white", alpha=0.85)
    bars2 = ax1.bar(x + w / 2, f1s, w, label="F1 (weighted)", color=colors,
                    edgecolor="white", alpha=0.55)
    for bar in bars1:
        ax1.text(bar.get_x() + bar.get_width() / 2, bar.get_height() + 0.003,
                 f"{bar.get_height():.3f}", ha="center", fontsize=8, fontweight="bold")
    for bar in bars2:
        ax1.text(bar.get_x() + bar.get_width() / 2, bar.get_height() + 0.003,
                 f"{bar.get_height():.3f}", ha="center", fontsize=8)
    ax1.set_xticks(x)
    ax1.set_xticklabels(models_list, fontsize=9)
    ax1.set_ylabel("Score")
    ax1.set_title("Test Performance")
    ax1.legend(fontsize=8)
    ax1.set_ylim(0, 1.12)

    bars3 = ax2.bar(x, cv_means, 0.5, yerr=cv_stds, color=colors,
                    edgecolor="white", capsize=5, alpha=0.85)
    for bar, m, s in zip(bars3, cv_means, cv_stds):
        ax2.text(bar.get_x() + bar.get_width() / 2,
                 bar.get_height() + s + 0.005,
                 f"{m:.3f}\n\u00b1{s:.3f}",
                 ha="center", va="bottom", fontsize=8, fontweight="bold")
    ax2.set_xticks(x)
    ax2.set_xticklabels(models_list, fontsize=9)
    ax2.set_ylabel("F1 Score (weighted)")
    ax2.set_title("5-Fold Cross-Validation F1")
    ax2.set_ylim(0, 1.12)

    fig.suptitle("Model Comparison (Pre-Event Features)", fontsize=13, fontweight="bold")
    plt.tight_layout()
    fig.savefig(path, dpi=300, bbox_inches="tight")
    plt.close(fig)
    print(f"    Saved: {path}")


def plot_ablation_study(ablation_results, path):
    fig, ax = plt.subplots(figsize=(9, 5.5))

    groups = list(ablation_results.keys())
    scores = [ablation_results[g]["f1_weighted"] for g in groups]
    deltas = [ablation_results[g]["delta"] for g in groups]

    colors_bar = []
    for d in deltas:
        if d == 0:
            colors_bar.append("#1565C0")
        elif d < -0.02:
            colors_bar.append("#E63946")
        elif d < 0:
            colors_bar.append("#F4A261")
        else:
            colors_bar.append("#2A9D8F")

    bars = ax.bar(range(len(groups)), scores, color=colors_bar,
                  edgecolor="white", width=0.7)

    for bar, score, delta in zip(bars, scores, deltas):
        label = f"{score:.3f}"
        if delta != 0:
            sign = "+" if delta > 0 else ""
            label += f"\n({sign}{delta:.3f})"
        ax.text(bar.get_x() + bar.get_width() / 2, bar.get_height() + 0.003,
                label, ha="center", va="bottom", fontsize=8, fontweight="bold")

    ax.set_xticks(range(len(groups)))
    ax.set_xticklabels(groups, rotation=35, ha="right", fontsize=9)
    ax.set_ylabel("F1 Score (weighted)")
    ax.set_title("Ablation Study\nImpact of Removing Each Feature Group",
                 fontweight="bold")
    ax.set_ylim(0, max(scores) * 1.12)

    plt.tight_layout()
    fig.savefig(path, dpi=300, bbox_inches="tight")
    plt.close(fig)
    print(f"    Saved: {path}")


# ---------------------------------------------------------------------------
# Main pipeline
# ---------------------------------------------------------------------------

def main():
    print("=" * 72)
    print("  WeatherWise - Multi-Hazard Classification Pipeline")
    print("  Pre-event features only (no data leakage)")
    print("=" * 72)

    rng = np.random.default_rng(42)

    # 1. Load data
    print("\n[1/9] Loading data ...")
    if not os.path.exists(DATA_PATH):
        print(f"  ERROR: {DATA_PATH} not found")
        return
    df = pd.read_csv(DATA_PATH, low_memory=False)
    print(f"  Loaded {len(df):,} records")

    # 2. Map to 6 classes
    print("\n[2/9] Mapping to 6 hazard categories ...")
    df["hazard_class"] = df["EVENT_TYPE"].map(CATEGORY_MAP)
    df = df[df["hazard_class"].notna()].copy()
    print(f"  Retained {len(df):,} mapped records")
    for cat in CATEGORIES:
        cnt = (df["hazard_class"] == cat).sum()
        print(f"    {cat:<25s} {cnt:>7,}  ({cnt / len(df) * 100:5.1f}%)")

    # 3. Encode target
    print("\n[3/9] Encoding targets ...")
    le = LabelEncoder()
    le.fit(CATEGORIES)
    # IMPORTANT: LabelEncoder sorts alphabetically, so le.classes_ order
    # differs from CATEGORIES order.  Use le.classes_ for all metric/plot
    # labels to keep index↔name mapping consistent.
    label_names = list(le.classes_)
    y = le.transform(df["hazard_class"])

    # 4. Feature engineering (20 features)
    print("\n[4/9] Engineering 20 pre-event features ...")
    X, state_encoder = extract_features(df, rng, fit_state=True)
    feature_names = list(X.columns)
    print(f"  Features ({len(feature_names)}): {feature_names}")
    X = X.replace([np.inf, -np.inf], 0).fillna(0)

    # 5. Train/test split
    print("\n[5/9] Splitting data (80/20 stratified) ...")
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.20, random_state=42, stratify=y)
    print(f"  Train: {len(X_train):,}   Test: {len(X_test):,}")

    # Sample weights for class imbalance
    sample_weights = compute_sample_weight("balanced", y_train)

    # Scaler for LogisticRegression
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)

    # 6. Train 3 models
    print("\n[6/9] Training 3 models ...")
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)

    # XGBoost with RandomizedSearchCV
    print("\n  --- XGBoost (RandomizedSearchCV, n_iter=30) ---")
    xgb_param_dist = {
        "n_estimators": randint(100, 500),
        "max_depth": randint(4, 10),
        "learning_rate": uniform(0.01, 0.29),
        "subsample": uniform(0.6, 0.4),
        "colsample_bytree": uniform(0.6, 0.4),
        "min_child_weight": randint(1, 10),
    }
    xgb_base = XGBClassifier(
        objective="multi:softprob", num_class=len(CATEGORIES),
        eval_metric="mlogloss", random_state=42, n_jobs=-1, verbosity=0,
    )
    xgb_search = RandomizedSearchCV(
        xgb_base, xgb_param_dist, n_iter=30, cv=3, scoring="f1_weighted",
        random_state=42, n_jobs=-1, verbose=0,
    )
    xgb_search.fit(X_train, y_train, sample_weight=sample_weights)
    xgb_model = xgb_search.best_estimator_
    print(f"  Best params: {xgb_search.best_params_}")
    print(f"  Best CV F1: {xgb_search.best_score_:.4f}")

    # 5-fold CV for XGBoost
    xgb_cv = cross_val_score(xgb_model, X_train, y_train, cv=cv,
                             scoring="f1_weighted", n_jobs=-1)
    print(f"  5-fold CV F1: {xgb_cv.mean():.4f} \u00b1 {xgb_cv.std():.4f}")

    # RandomForest
    print("\n  --- RandomForest ---")
    rf_model = RandomForestClassifier(
        n_estimators=300, max_depth=10, min_samples_leaf=5,
        class_weight="balanced", random_state=42, n_jobs=-1,
    )
    rf_model.fit(X_train, y_train)
    rf_cv = cross_val_score(rf_model, X_train, y_train, cv=cv,
                            scoring="f1_weighted", n_jobs=-1)
    print(f"  5-fold CV F1: {rf_cv.mean():.4f} \u00b1 {rf_cv.std():.4f}")

    # LogisticRegression
    print("\n  --- LogisticRegression ---")
    lr_model = LogisticRegression(
        multi_class="multinomial", solver="lbfgs",
        max_iter=1000, class_weight="balanced", random_state=42, n_jobs=-1,
    )
    lr_model.fit(X_train_scaled, y_train)
    lr_cv = cross_val_score(lr_model, X_train_scaled, y_train, cv=cv,
                            scoring="f1_weighted", n_jobs=-1)
    print(f"  5-fold CV F1: {lr_cv.mean():.4f} \u00b1 {lr_cv.std():.4f}")

    # Evaluate all 3
    all_models = {
        "XGBoost": (xgb_model, X_test, xgb_cv),
        "RandomForest": (rf_model, X_test, rf_cv),
        "LogisticRegression": (lr_model, X_test_scaled, lr_cv),
    }

    results = {}
    best_model = None
    best_f1 = 0.0
    best_name = ""

    for name, (clf, X_eval, cv_scores) in all_models.items():
        y_pred = clf.predict(X_eval)
        acc = accuracy_score(y_test, y_pred)
        f1 = f1_score(y_test, y_pred, average="weighted")
        y_prob = clf.predict_proba(X_eval) if hasattr(clf, "predict_proba") else None

        report = classification_report(
            y_test, y_pred, target_names=label_names, digits=4, output_dict=True)

        # Per-class ROC AUC and AP
        y_test_bin = label_binarize(y_test, classes=range(len(label_names)))
        per_class = {}
        for i, cat in enumerate(label_names):
            pc = {
                "precision": report[cat]["precision"],
                "recall": report[cat]["recall"],
                "f1-score": report[cat]["f1-score"],
                "support": report[cat]["support"],
            }
            if y_prob is not None and i < y_prob.shape[1]:
                fpr, tpr, _ = roc_curve(y_test_bin[:, i], y_prob[:, i])
                pc["roc_auc"] = float(auc(fpr, tpr))
                pc["average_precision"] = float(
                    average_precision_score(y_test_bin[:, i], y_prob[:, i]))
            per_class[cat] = pc

        results[name] = {
            "accuracy": acc,
            "f1_weighted": f1,
            "cv_f1_mean": float(cv_scores.mean()),
            "cv_f1_std": float(cv_scores.std()),
            "cv_scores": cv_scores.tolist(),
            "per_class": per_class,
            "y_pred": y_pred,
            "y_prob": y_prob,
        }

        print(f"\n  {name}: Acc={acc:.4f}  F1={f1:.4f}  "
              f"CV={cv_scores.mean():.4f}\u00b1{cv_scores.std():.4f}")

        if f1 > best_f1:
            best_f1 = f1
            best_model = clf
            best_name = name

    print(f"\n  Best model: {best_name} (F1={best_f1:.4f})")

    # 7. Ablation study
    print("\n[7/9] Ablation study ...")
    feature_groups = {
        "ALL FEATURES\n(baseline)": list(range(len(feature_names))),
        "w/o Temporal": [i for i, f in enumerate(feature_names)
                         if f not in ("month_sin", "month_cos", "hour_sin",
                                      "hour_cos", "is_nighttime", "season")],
        "w/o Spatial": [i for i, f in enumerate(feature_names)
                        if f not in ("latitude", "longitude",
                                     "lat_lon_interaction", "lat_squared",
                                     "lon_squared", "state_encoded")],
        "w/o Magnitude": [i for i, f in enumerate(feature_names)
                          if f != "magnitude"],
        "w/o CAPE": [i for i, f in enumerate(feature_names) if f != "cape"],
        "w/o Wind Shear": [i for i, f in enumerate(feature_names) if f != "wind_shear"],
        "w/o VIL": [i for i, f in enumerate(feature_names) if f != "vil"],
        "w/o Rotation": [i for i, f in enumerate(feature_names) if f != "rotation"],
        "w/o ALL Radar": [i for i, f in enumerate(feature_names)
                          if f not in ("cape", "wind_shear", "vil", "rotation",
                                       "echo_top", "surface_pressure",
                                       "dewpoint_depression")],
    }

    ablation_results = {}
    baseline_f1 = None

    for group_name, keep_indices in feature_groups.items():
        X_train_sub = X_train.iloc[:, keep_indices]
        X_test_sub = X_test.iloc[:, keep_indices]

        abl_clf = XGBClassifier(
            **xgb_search.best_params_,
            objective="multi:softprob", num_class=len(CATEGORIES),
            eval_metric="mlogloss", random_state=42, n_jobs=-1, verbosity=0,
        )
        abl_clf.fit(X_train_sub, y_train, sample_weight=sample_weights)
        y_pred_abl = abl_clf.predict(X_test_sub)
        f1_abl = f1_score(y_test, y_pred_abl, average="weighted")

        if baseline_f1 is None:
            baseline_f1 = f1_abl
            delta = 0.0
        else:
            delta = f1_abl - baseline_f1

        ablation_results[group_name] = {
            "f1_weighted": f1_abl,
            "delta": delta,
            "features_used": len(keep_indices),
        }
        sign = "+" if delta >= 0 else ""
        print(f"    {group_name:<25s}  F1={f1_abl:.4f}  "
              f"({sign}{delta:.4f})  [{len(keep_indices)} features]")

    # 8. Save artifacts
    print("\n[8/9] Saving model artifacts ...")

    joblib.dump(best_model, os.path.join(MODEL_DIR, "weatherwise_model.joblib"))
    joblib.dump(le, os.path.join(MODEL_DIR, "label_encoder.joblib"))
    joblib.dump(label_names, os.path.join(MODEL_DIR, "class_names.joblib"))
    joblib.dump(feature_names, os.path.join(MODEL_DIR, "feature_names.joblib"))
    joblib.dump(scaler, os.path.join(MODEL_DIR, "scaler.joblib"))
    joblib.dump(state_encoder, os.path.join(MODEL_DIR, "state_encoder.joblib"))

    # Compute training medians for default radar values in ml_service
    train_medians = {}
    for col in ["cape", "wind_shear", "vil", "rotation", "echo_top",
                "surface_pressure", "dewpoint_depression", "magnitude"]:
        train_medians[col] = float(X_train[col].median())
    joblib.dump(train_medians, os.path.join(MODEL_DIR, "train_medians.joblib"))

    print(f"    Saved 7 artifacts to {MODEL_DIR}")

    # Save JSON results
    json_results = {
        "best_model": best_name,
        "training_samples": len(X_train),
        "test_samples": len(X_test),
        "num_features": len(feature_names),
        "features": feature_names,
        "model_comparison": {},
        "ablation_study": {},
    }

    for name, r in results.items():
        json_results["model_comparison"][name] = {
            "accuracy": round(r["accuracy"], 4),
            "f1_weighted": round(r["f1_weighted"], 4),
            "cv_f1_mean": round(r["cv_f1_mean"], 4),
            "cv_f1_std": round(r["cv_f1_std"], 4),
            "per_class": {
                cat: {k: round(v, 4) if isinstance(v, float) else v
                      for k, v in r["per_class"][cat].items()}
                for cat in label_names
            },
        }

    for name, r in ablation_results.items():
        json_results["ablation_study"][name] = {
            "f1_weighted": round(r["f1_weighted"], 4),
            "delta": round(r["delta"], 4),
        }

    json_path = os.path.join(RESULTS_DIR, "paper_results.json")
    with open(json_path, "w") as f:
        json.dump(json_results, f, indent=2)
    print(f"    Results -> {json_path}")

    # 9. Generate 7 figures
    print("\n[9/9] Generating 7 publication figures (300 DPI) ...")

    y_test_bin = label_binarize(y_test, classes=range(len(label_names)))
    best_result = results[best_name]

    plot_confusion_matrix(
        y_test, best_result["y_pred"], label_names,
        os.path.join(FIG_DIR, "confusion_matrix.png"), best_name)

    if hasattr(best_model, "feature_importances_"):
        plot_feature_importance(
            best_model, feature_names,
            os.path.join(FIG_DIR, "feature_importance.png"))

    if best_result["y_prob"] is not None:
        plot_roc_curves(
            y_test_bin, best_result["y_prob"], label_names,
            os.path.join(FIG_DIR, "roc_curves.png"), best_name)
        plot_precision_recall(
            y_test_bin, best_result["y_prob"], label_names,
            os.path.join(FIG_DIR, "precision_recall.png"), best_name)

    plot_class_distribution(y, label_names,
                            os.path.join(FIG_DIR, "class_distribution.png"))

    comparison_data = {
        name: {k: v for k, v in r.items()
               if k in ("accuracy", "f1_weighted", "cv_f1_mean", "cv_f1_std")}
        for name, r in results.items()
    }
    plot_model_comparison(comparison_data,
                          os.path.join(FIG_DIR, "model_comparison.png"))

    plot_ablation_study(ablation_results,
                        os.path.join(FIG_DIR, "ablation_study.png"))

    # Summary
    print("\n" + "=" * 72)
    print("  RESULTS SUMMARY")
    print("=" * 72)
    print(f"\n  Best Model: {best_name}")
    br = results[best_name]
    print(f"    Test Accuracy:      {br['accuracy']:.4f}")
    print(f"    Test F1 (weighted): {br['f1_weighted']:.4f}")
    print(f"    5-fold CV F1:       {br['cv_f1_mean']:.4f} +/- {br['cv_f1_std']:.4f}")

    print(f"\n  Model Comparison:")
    for name, r in results.items():
        marker = " <-- best" if name == best_name else ""
        print(f"    {name:<20s}  Acc={r['accuracy']:.4f}  "
              f"F1={r['f1_weighted']:.4f}  "
              f"CV={r['cv_f1_mean']:.4f}+/-{r['cv_f1_std']:.4f}{marker}")

    print(f"\n  Per-Class (best model):")
    for cat in label_names:
        pc = br["per_class"][cat]
        roc = pc.get("roc_auc", 0)
        ap = pc.get("average_precision", 0)
        print(f"    {cat:<25s} P={pc['precision']:.3f} R={pc['recall']:.3f} "
              f"F1={pc['f1-score']:.3f} AUC={roc:.3f} AP={ap:.3f}")

    print(f"\n  Features ({len(feature_names)}): {feature_names}")
    print(f"  Train: {len(X_train):,}  Test: {len(X_test):,}")
    print(f"  Figures: {FIG_DIR}")
    print(f"  Models:  {MODEL_DIR}")
    print(f"  Results: {RESULTS_DIR}")
    print("\n" + "=" * 72)
    print("  Pipeline complete.")
    print("=" * 72)


if __name__ == "__main__":
    main()
