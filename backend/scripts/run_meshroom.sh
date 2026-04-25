#!/bin/bash

INPUT_DIR=$1
JOB_ID=$2

OUTPUT_DIR="temp/$JOB_ID/meshroom_output"

mkdir -p $OUTPUT_DIR

echo "Starting Meshroom photogrammetry..."
echo "Input: $INPUT_DIR"
echo "Output: $OUTPUT_DIR"

# Check if Meshroom is installed
if ! command -v meshroom_photogrammetry &> /dev/null; then
    echo "ERROR: Meshroom not found. Please install Meshroom CLI."
    echo "Download from: https://alicevision.org/#meshroom"
    exit 1
fi

# Run Meshroom CLI
meshroom_photogrammetry \
    --input $INPUT_DIR \
    --output $OUTPUT_DIR \
    --save $OUTPUT_DIR/pipeline.mg

if [ $? -eq 0 ]; then
    echo "Meshroom processing completed successfully"
    exit 0
else
    echo "Meshroom processing failed"
    exit 1
fi
