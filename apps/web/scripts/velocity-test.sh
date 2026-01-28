#!/bin/bash
# Narrator Velocity Test - Compare model response times
# Usage:
#   ./scripts/velocity-test.sh              # Test current guest model
#   ./scripts/velocity-test.sh --compare    # Compare all candidates

API_URL="${API_URL:-http://localhost:7272/api/pulse}"

# Color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Test a single request and return timing
test_model() {
  local CHAT_ID=$(uuidgen | tr '[:upper:]' '[:lower:]')
  local MSG_ID=$(uuidgen | tr '[:upper:]' '[:lower:]')

  local START=$(python3 -c 'import time; print(time.time())')

  local RESPONSE=$(curl -s -X POST "$API_URL" \
    -H "Content-Type: application/json" \
    -d "{
      \"id\": \"$CHAT_ID\",
      \"messages\": [{
        \"id\": \"$MSG_ID\",
        \"role\": \"user\",
        \"parts\": [{\"type\": \"text\", \"text\": \"Let's start the story \\\"Shadow Over Innsmouth\\\".\"}]
      }],
      \"selectedStoryId\": \"shadow-over-innsmouth\",
      \"language\": \"en\",
      \"guestPulseCount\": 0
    }" 2>/dev/null)

  local END=$(python3 -c 'import time; print(time.time())')
  local ELAPSED=$(python3 -c "print(f'{$END - $START:.1f}')")
  local CHARS=${#RESPONSE}

  # Check for error
  if echo "$RESPONSE" | grep -q '"error"'; then
    echo "ERROR"
  else
    echo "$ELAPSED"
  fi
}

echo ""
echo "🚀 Narrator Velocity Test"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "API: $API_URL"
echo ""

if [[ "$1" == "--compare" ]]; then
  echo "📊 Comparing models (this will take a few minutes)..."
  echo ""
  echo "To test a specific model, change the guest model in:"
  echo "  apps/web/app/(chat)/api/pulse/route.ts line ~255"
  echo ""
  echo "Candidate models for storytelling:"
  echo ""
  echo "  minimax/minimax-m2-her     - Built for roleplay/storytelling (\$0.30/\$1.20)"
  echo "  deepseek/deepseek-chat     - Fast, good quality (\$0.14/\$0.28)"
  echo "  meta-llama/llama-3.3-70b   - Great for creative (\$0.10/\$0.30)"
  echo "  qwen/qwen-2.5-72b-instruct - Strong reasoning (\$0.15/\$0.40)"
  echo "  cohere/command-r-plus      - Good narratives (\$2.50/\$10)"
  echo ""
else
  echo "Testing current guest model configuration..."
  echo ""

  RESULT=$(test_model)

  if [[ "$RESULT" == "ERROR" ]]; then
    echo -e "${RED}✗ Request failed${NC}"
  else
    echo -e "${GREEN}✓ Response time: ${RESULT}s${NC}"
  fi
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
