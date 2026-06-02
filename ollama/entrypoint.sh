#!/bin/sh
set -e

MODEL="${OLLAMA_MODEL:-qwen2.5:7b}"

# Start the Ollama server in background
ollama serve &
SERVER_PID=$!

# Wait until the API is accepting connections
echo "[ollama] Waiting for server to be ready..."
until curl -sf http://localhost:11434/api/tags > /dev/null 2>&1; do
  sleep 2
done
echo "[ollama] Server ready."

# Pull the model if not already present
if ollama list | grep -q "^${MODEL}"; then
  echo "[ollama] Model ${MODEL} already present."
else
  echo "[ollama] Pulling model ${MODEL}..."
  ollama pull "${MODEL}"
  echo "[ollama] Model ${MODEL} pulled successfully."
fi

# Wait for the server process to keep the container alive
wait "${SERVER_PID}"
