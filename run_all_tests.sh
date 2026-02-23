#!/bin/bash
# =============================================================================
# WeatherWise Framework — Complete Test & Evaluation Runner
# =============================================================================
# Runs all backend tests, ML training, and evaluation scripts.
# Usage: bash run_all_tests.sh
# =============================================================================

set -e

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
PASS=0
FAIL=0

print_header() {
    echo ""
    echo "============================================================"
    echo "  $1"
    echo "============================================================"
}

run_step() {
    local description="$1"
    shift
    echo ""
    echo "--- $description ---"
    if "$@"; then
        echo "[PASS] $description"
        PASS=$((PASS + 1))
    else
        echo "[FAIL] $description"
        FAIL=$((FAIL + 1))
    fi
}

# =============================================================================
# 1. Backend (Java / Maven)
# =============================================================================
print_header "STEP 1: Backend Tests (Java Spring Boot + GraphQL)"

if [ -f "$ROOT_DIR/backend/mvnw" ]; then
    MVN="bash $ROOT_DIR/backend/mvnw"
elif command -v mvn &> /dev/null; then
    MVN="mvn"
else
    echo "[WARN] Maven not found. Skipping backend tests."
    MVN=""
fi

if [ -n "$MVN" ]; then
    run_step "Maven compile" $MVN -f "$ROOT_DIR/backend/pom.xml" compile -q
    run_step "Maven unit & integration tests" $MVN -f "$ROOT_DIR/backend/pom.xml" test -q
fi

# =============================================================================
# 2. ML Model Training (Python)
# =============================================================================
print_header "STEP 2: ML Model Training"

if command -v python &> /dev/null; then
    PYTHON="python"
elif command -v python3 &> /dev/null; then
    PYTHON="python3"
else
    echo "[WARN] Python not found. Skipping ML steps."
    PYTHON=""
fi

if [ -n "$PYTHON" ]; then
    if [ -f "$ROOT_DIR/ml/requirements.txt" ]; then
        run_step "Install ML dependencies" $PYTHON -m pip install -q -r "$ROOT_DIR/ml/requirements.txt"
    fi
    run_step "Generate synthetic data" $PYTHON "$ROOT_DIR/ml/generate_synthetic_data.py"
    run_step "Train XGBoost model" $PYTHON "$ROOT_DIR/ml/train_model.py"
    if [ -f "$ROOT_DIR/ml/evaluate.py" ]; then
        run_step "Evaluate model" $PYTHON "$ROOT_DIR/ml/evaluate.py"
    fi
fi

# =============================================================================
# 3. Evaluation Scripts
# =============================================================================
print_header "STEP 3: Evaluation & Figure Generation"

if [ -n "$PYTHON" ]; then
    if [ -f "$ROOT_DIR/evaluation/historical_simulation.py" ]; then
        run_step "Historical simulation" $PYTHON "$ROOT_DIR/evaluation/historical_simulation.py"
    fi
    if [ -f "$ROOT_DIR/evaluation/graphql_benchmark.py" ]; then
        run_step "GraphQL benchmark" $PYTHON "$ROOT_DIR/evaluation/graphql_benchmark.py"
    fi
    if [ -f "$ROOT_DIR/evaluation/generate_paper_figures.py" ]; then
        run_step "Generate paper figures" $PYTHON "$ROOT_DIR/evaluation/generate_paper_figures.py"
    fi
fi

# =============================================================================
# Summary
# =============================================================================
print_header "SUMMARY"

TOTAL=$((PASS + FAIL))
echo "  Total steps:  $TOTAL"
echo "  Passed:       $PASS"
echo "  Failed:       $FAIL"
echo ""

if [ "$FAIL" -gt 0 ]; then
    echo "  STATUS: SOME STEPS FAILED"
    exit 1
else
    echo "  STATUS: ALL STEPS PASSED"
    exit 0
fi
