"""
WeatherWise - ML Prediction Service (Flask API)
=================================================
Serves the trained hazard-classification model via a REST API.

Endpoints:
    GET  /health         - Health check with model status
    POST /predict        - Single-point hazard prediction
    POST /predict_route  - Multi-waypoint route risk assessment

Usage:  python ml_service.py
Runs on: http://localhost:5000
"""

import os
import logging
import traceback
import numpy as np
import joblib

from flask import Flask, request, jsonify
from flask_cors import CORS

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------
app = Flask(__name__)
cors_origins = os.environ.get(
    "CORS_ORIGINS", "http://localhost:8080,http://localhost:5173,http://localhost:3000"
).split(",")
CORS(app, origins=cors_origins)

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_DIR = os.path.join(BASE_DIR, "models")

# ---------------------------------------------------------------------------
# Global state
# ---------------------------------------------------------------------------
model = None
label_encoder = None
feature_names = None
class_names = None
scaler = None
state_encoder = None
train_medians = None
model_loaded = False

CATEGORIES_DEFAULT = [
    "TORNADO", "SEVERE_THUNDERSTORM", "FLASH_FLOOD",
    "WINTER_STORM", "HURRICANE", "WILDFIRE",
]

# Default radar values (overwritten by train_medians if available)
DEFAULT_RADAR = {
    "cape": 1500, "wind_shear": 30, "vil": 25, "rotation": 0.15,
    "echo_top": 30000, "surface_pressure": 1005, "dewpoint_depression": 5,
    "magnitude": 0,
}


def load_model():
    """Load all model artifacts from ml/models/."""
    global model, label_encoder, feature_names, class_names
    global scaler, state_encoder, train_medians, model_loaded

    artifacts = {
        "weatherwise_model.joblib": "model",
        "label_encoder.joblib": "label_encoder",
        "feature_names.joblib": "feature_names",
        "class_names.joblib": "class_names",
        "scaler.joblib": "scaler",
        "state_encoder.joblib": "state_encoder",
        "train_medians.joblib": "train_medians",
    }

    for filename, var_name in artifacts.items():
        path = os.path.join(MODEL_DIR, filename)
        if os.path.exists(path):
            globals()[var_name] = joblib.load(path)
            print(f"    Loaded {filename}")
        else:
            print(f"    Missing {filename}")

    model_loaded = model is not None and label_encoder is not None
    if model_loaded:
        print(f"  Model loaded ({len(feature_names or [])} features)")
    else:
        print("  WARNING: Model not loaded. Run train_model.py first.")


def get_default(key):
    """Get default value from training medians, falling back to hardcoded."""
    if train_medians and key in train_medians:
        return train_medians[key]
    return DEFAULT_RADAR.get(key, 0)


# ---------------------------------------------------------------------------
# Feature construction
# ---------------------------------------------------------------------------

def build_feature_vector(lat, lon, month, hour, state="UNKNOWN",
                         magnitude=None, cape=None, wind_shear=None,
                         vil=None, rotation=None, echo_top=None,
                         surface_pressure=None, dewpoint_depression=None):
    """Build 20-feature vector matching train_model.py feature order."""
    month_sin = np.sin(2.0 * np.pi * month / 12.0)
    month_cos = np.cos(2.0 * np.pi * month / 12.0)
    hour_sin = np.sin(2.0 * np.pi * hour / 24.0)
    hour_cos = np.cos(2.0 * np.pi * hour / 24.0)
    is_nighttime = int(hour < 6 or hour >= 21)

    season_map = {12: 0, 1: 0, 2: 0, 3: 1, 4: 1, 5: 1,
                  6: 2, 7: 2, 8: 2, 9: 3, 10: 3, 11: 3}
    season = season_map.get(month, 0)

    lat_lon_interaction = lat * lon
    lat_squared = lat ** 2
    lon_squared = lon ** 2

    # State encoding
    state_val = 0
    if state_encoder is not None:
        state_upper = state.upper() if state else "UNKNOWN"
        if state_upper in state_encoder.classes_:
            state_val = int(state_encoder.transform([state_upper])[0])

    mag = magnitude if magnitude is not None else get_default("magnitude")
    c = cape if cape is not None else get_default("cape")
    ws = wind_shear if wind_shear is not None else get_default("wind_shear")
    v = vil if vil is not None else get_default("vil")
    r = rotation if rotation is not None else get_default("rotation")
    et = echo_top if echo_top is not None else get_default("echo_top")
    sp = surface_pressure if surface_pressure is not None else get_default("surface_pressure")
    dd = dewpoint_depression if dewpoint_depression is not None else get_default("dewpoint_depression")

    return np.array([
        month_sin, month_cos, hour_sin, hour_cos, is_nighttime, season,
        lat, lon, lat_lon_interaction, lat_squared, lon_squared, state_val,
        mag, c, ws, v, r, et, sp, dd,
    ]).reshape(1, -1)


def estimate_severity(hazard_type, rotation=0, vil=0, magnitude=0):
    """Estimate severity from radar parameters."""
    severity = "Moderate"
    factors = []

    if hazard_type == "TORNADO":
        if rotation > 0.7 and vil > 60:
            severity, factors = "EF3-EF4", [f"High rotation ({rotation:.2f})", f"Very high VIL ({vil})"]
        elif rotation > 0.4 and vil > 40:
            severity, factors = "EF1-EF2", [f"Moderate rotation ({rotation:.2f})"]
        elif rotation > 0.2:
            severity, factors = "EF0-EF1", [f"Low rotation ({rotation:.2f})"]
        else:
            severity, factors = "EF0", ["Minimal rotation detected"]
    elif hazard_type == "SEVERE_THUNDERSTORM":
        if vil > 50:
            severity, factors = "Significant", [f"High VIL ({vil}) - large hail possible"]
        elif magnitude > 70:
            severity, factors = "Significant", [f"High winds ({magnitude} kts)"]
        else:
            severity, factors = "Moderate", ["Standard parameters"]
    elif hazard_type == "FLASH_FLOOD":
        if vil > 50:
            severity, factors = "Life-threatening", [f"Very high VIL ({vil})"]
        elif vil > 30:
            severity, factors = "Significant", [f"Elevated VIL ({vil})"]
        else:
            severity, factors = "Moderate", ["Moderate flooding expected"]
    elif hazard_type == "WINTER_STORM":
        if magnitude > 12:
            severity, factors = "Major", [f"Heavy accumulation ({magnitude} in)"]
        elif magnitude > 6:
            severity, factors = "Significant", [f"Moderate accumulation ({magnitude} in)"]
        else:
            severity, factors = "Advisory", ["Light to moderate winter weather"]
    elif hazard_type == "HURRICANE":
        if magnitude > 110:
            severity, factors = "Category 3+", [f"Major winds ({magnitude} kts)"]
        elif magnitude > 83:
            severity, factors = "Category 1-2", [f"Hurricane-force winds ({magnitude} kts)"]
        else:
            severity, factors = "Tropical Storm", [f"Tropical storm winds ({magnitude} kts)"]
    elif hazard_type == "WILDFIRE":
        severity, factors = "Dangerous", ["Wildfire/smoke detected"]

    if not factors:
        factors = [f"Standard {hazard_type.lower().replace('_', ' ')} indicators"]
    return severity, factors


# ---------------------------------------------------------------------------
# API Endpoints
# ---------------------------------------------------------------------------

@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status": "ok",
        "model_loaded": model_loaded,
        "features": len(feature_names) if feature_names else 0,
        "classes": class_names or CATEGORIES_DEFAULT,
    })


@app.route("/predict", methods=["POST"])
def predict():
    if not model_loaded:
        return jsonify({"error": "Model not loaded. Run train_model.py first."}), 503

    try:
        data = request.get_json(force=True)

        lat = float(data.get("lat", 0))
        lon = float(data.get("lon", 0))
        month = int(data.get("month", 6))
        hour = int(data.get("hour", 12))
        state = str(data.get("state", "UNKNOWN"))

        features = build_feature_vector(
            lat=lat, lon=lon, month=month, hour=hour, state=state,
            magnitude=data.get("magnitude"),
            cape=data.get("cape"),
            wind_shear=data.get("wind_shear"),
            vil=data.get("vil"),
            rotation=data.get("rotation"),
            echo_top=data.get("echo_top"),
            surface_pressure=data.get("surface_pressure"),
            dewpoint_depression=data.get("dewpoint_depression"),
        )

        probabilities = model.predict_proba(features)[0]
        predicted_idx = int(np.argmax(probabilities))
        hazard_type = label_encoder.inverse_transform([predicted_idx])[0]
        probability = float(probabilities[predicted_idx])

        cats = class_names or CATEGORIES_DEFAULT
        all_probs = {cats[i]: round(float(probabilities[i]), 4)
                     for i in range(min(len(cats), len(probabilities)))}

        rot = float(data.get("rotation", get_default("rotation")))
        v = float(data.get("vil", get_default("vil")))
        mag = float(data.get("magnitude", get_default("magnitude")))
        severity, factors = estimate_severity(hazard_type, rot, v, mag)

        cape_val = float(data.get("cape", 0))
        ws_val = float(data.get("wind_shear", 0))
        if cape_val > 2000:
            factors.append(f"High CAPE ({cape_val:.0f} J/kg)")
        if ws_val > 40:
            factors.append(f"Strong shear ({ws_val:.0f} kts)")

        return jsonify({
            "hazard_type": hazard_type,
            "probability": round(probability, 4),
            "all_probabilities": all_probs,
            "severity_estimate": severity,
            "confidence": round(float(np.max(probabilities)), 4),
            "contributing_factors": factors,
        })

    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 400


@app.route("/predict_route", methods=["POST"])
def predict_route():
    if not model_loaded:
        return jsonify({"error": "Model not loaded. Run train_model.py first."}), 503

    try:
        data = request.get_json(force=True)
        waypoints = data.get("waypoints", [])
        month = int(data.get("month", 6))
        hour = int(data.get("hour", 12))
        state = str(data.get("state", "UNKNOWN"))

        if not waypoints:
            return jsonify({"error": "At least one waypoint required"}), 400

        severity_weight = {
            "TORNADO": 1.0, "HURRICANE": 0.9, "FLASH_FLOOD": 0.7,
            "SEVERE_THUNDERSTORM": 0.6, "WINTER_STORM": 0.5, "WILDFIRE": 0.8,
        }

        segments = []
        for i, wp in enumerate(waypoints):
            lat = float(wp.get("lat", 0))
            lon = float(wp.get("lon", 0))

            features = build_feature_vector(lat=lat, lon=lon, month=month,
                                            hour=hour, state=state)
            probabilities = model.predict_proba(features)[0]
            predicted_idx = int(np.argmax(probabilities))
            hazard_type = label_encoder.inverse_transform([predicted_idx])[0]
            probability = float(probabilities[predicted_idx])
            risk_score = probability * severity_weight.get(hazard_type, 0.5)

            if risk_score > 0.6:
                risk_level = "EXTREME"
            elif risk_score > 0.4:
                risk_level = "HIGH"
            elif risk_score > 0.25:
                risk_level = "MODERATE"
            elif risk_score > 0.1:
                risk_level = "LOW"
            else:
                risk_level = "MINIMAL"

            cats = class_names or CATEGORIES_DEFAULT
            all_probs = {cats[j]: round(float(probabilities[j]), 4)
                         for j in range(min(len(cats), len(probabilities)))}

            segments.append({
                "waypoint_index": i, "lat": lat, "lon": lon,
                "hazard_type": hazard_type,
                "probability": round(probability, 4),
                "risk_score": round(risk_score, 4),
                "risk_level": risk_level,
                "confidence": round(float(np.max(probabilities)), 4),
                "all_probabilities": all_probs,
            })

        avg_risk = np.mean([s["risk_score"] for s in segments])
        if avg_risk > 0.5:
            overall = "EXTREME - Avoid route"
        elif avg_risk > 0.35:
            overall = "HIGH - Consider alternative"
        elif avg_risk > 0.2:
            overall = "MODERATE - Proceed with caution"
        elif avg_risk > 0.1:
            overall = "LOW - Normal conditions"
        else:
            overall = "MINIMAL - Clear conditions"

        highest = max(segments, key=lambda s: s["risk_score"])

        return jsonify({
            "route_risk_segments": segments,
            "overall_route_risk": overall,
            "highest_risk_point": highest,
            "average_risk_score": round(float(avg_risk), 4),
            "total_waypoints": len(waypoints),
        })

    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 400


# ---------------------------------------------------------------------------
# Startup
# ---------------------------------------------------------------------------

load_model()

if __name__ == "__main__":
    port = int(os.environ.get("ML_PORT", 5000))
    logger.info("WeatherWise ML Prediction Service")
    logger.info("CORS origins: %s", cors_origins)
    logger.info("Model loaded: %s", model_loaded)
    logger.info("Endpoints: GET /health | POST /predict | POST /predict_route")
    logger.info("Starting on http://0.0.0.0:%d", port)
    app.run(host="0.0.0.0", port=port, debug=False)
