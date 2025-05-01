#!/bin/bash

# Usage: ./upload_csv.sh path/to/your/file.csv

FILE=$1
URL="http://localhost:8000/12345/upload-inventory"

if [[ -z "$FILE" ]]; then
  echo "Usage: $0 path/to/your/file.csv"
  exit 1
fi

if [[ ! -f "$FILE" ]]; then
  echo "Error: File '$FILE' does not exist."
  exit 2
fi

echo "Uploading '$FILE' to $URL..."

curl -F "file=@${FILE}" "$URL"

echo ""
echo "Upload complete."

