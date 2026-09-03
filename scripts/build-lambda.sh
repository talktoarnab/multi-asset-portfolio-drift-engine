#!/usr/bin/env bash
#
# Assembles the Lambda deployment package that Terraform archives.
#
# Layout matters: handlers import via `from backend.common...`, so the source
# has to sit under a `backend/` directory inside the zip while dependencies go
# at the root where Python can find them.
#
#   build/lambda/backend/{api,common,cron}   application code
#   build/lambda/{jwt,requests,...}          third-party dependencies
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUILD="$ROOT/build/lambda"

rm -rf "$BUILD"
mkdir -p "$BUILD/backend"

# The Python runtime already ships boto3 and botocore; bundling them would add
# well over 100 MB to the unzipped package for no benefit.
grep -v '^boto3' "$ROOT/backend/requirements.txt" > "$BUILD/.requirements.txt"
"${PYTHON:-python3}" -m pip install --quiet --target "$BUILD" --requirement "$BUILD/.requirements.txt"
rm "$BUILD/.requirements.txt"

for package in api common cron; do
  cp -R "$ROOT/backend/$package" "$BUILD/backend/"
done

find "$BUILD" -type d -name '__pycache__' -prune -exec rm -rf {} +
find "$BUILD" -type d -name '*.dist-info' -prune -exec rm -rf {} +

echo "Built $BUILD"
