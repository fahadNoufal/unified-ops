#!/bin/bash

echo "Starting Unified Operations Platform Backend..."
echo ""

# Check if venv exists
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

# Activate venv
source venv/bin/activate

# Install dependencies
echo "Installing dependencies..."
pip install -r requirements.txt

# Run the server
echo ""
echo "Starting FastAPI server on http://localhost:8000"
echo "API Docs available at http://localhost:8000/api/docs"
echo ""
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
