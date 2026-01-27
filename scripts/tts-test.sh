#!/bin/bash
# TTS A/B Comparison - Quick Test Script
# Generates samples from MiniMax Speech-02-HD and Chatterbox

set -e

# Load Replicate API token
source ../.env.local

OUTPUT_DIR="./tts-comparison-output"
mkdir -p "$OUTPUT_DIR"

# Test passage - Shadow Over Innsmouth style
TEXT='The fog rolled in from the harbor as you stepped off the bus, thick and grey like wet wool pressed against your face. Innsmouth lay before you, a town that time had forgotten and God had forsaken. Somewhere in the mist, a church bell tolled—once, twice, then fell silent.'

echo "=== TTS A/B Comparison ==="
echo "Output directory: $OUTPUT_DIR"
echo ""

# MiniMax Speech-02-HD voices for narration
MINIMAX_VOICES=(
  "English_CaptivatingStoryteller"
  "English_Deep-VoicedGentleman"
  "English_WiseScholar"
  "English_ImposingManner"
  "English_MatureBoss"
)

echo "--- MiniMax Speech-02-HD ---"
for VOICE in "${MINIMAX_VOICES[@]}"; do
  echo "Generating: $VOICE..."
  FILENAME="minimax_$(echo $VOICE | tr '[:upper:]' '[:lower:]' | tr -c '[:alnum:]' '_').mp3"
  
  curl -s -X POST https://api.replicate.com/v1/predictions \
    -H "Authorization: Bearer $REPLICATE_API_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{
      \"version\": \"minimax/speech-02-hd\",
      \"input\": {
        \"text\": \"$TEXT\",
        \"voice_id\": \"$VOICE\"
      }
    }" > /tmp/prediction.json
  
  # Wait for completion and download
  PREDICTION_URL=$(cat /tmp/prediction.json | jq -r '.urls.get')
  
  while true; do
    STATUS=$(curl -s -H "Authorization: Bearer $REPLICATE_API_TOKEN" "$PREDICTION_URL" | jq -r '.status')
    if [ "$STATUS" = "succeeded" ]; then
      OUTPUT_URL=$(curl -s -H "Authorization: Bearer $REPLICATE_API_TOKEN" "$PREDICTION_URL" | jq -r '.output')
      curl -s "$OUTPUT_URL" > "$OUTPUT_DIR/$FILENAME"
      echo "  ✓ Saved: $FILENAME"
      break
    elif [ "$STATUS" = "failed" ]; then
      echo "  ✗ Failed: $VOICE"
      break
    fi
    sleep 2
  done
done

echo ""
echo "=== Done! ==="
echo "Listen to samples in: $OUTPUT_DIR"
echo ""
echo "Evaluation links:"
echo "  - MiniMax Speech-02-HD: https://replicate.com/minimax/speech-02-hd"
echo "  - Chatterbox: https://replicate.com/resemble-ai/chatterbox"
echo "  - Qwen3-TTS: https://huggingface.co/spaces/Qwen/Qwen3-TTS"
