#!/bin/sh
set -e

MODEL="${OLLAMA_MODEL:-qwen2.5:7b}"

ollama serve &
SERVER_PID=$!

echo "[ollama] Waiting for server to be ready..."
until ollama list > /dev/null 2>&1; do
  sleep 2
done
echo "[ollama] Server ready."

if ollama list | grep -q "${MODEL}"; then
  echo "[ollama] Model ${MODEL} already present."
else
  echo "[ollama] Pulling model ${MODEL} (this may take several minutes)..."
  until ollama pull "${MODEL}"; do
    echo "[ollama] Pull failed or interrupted — retrying in 30 s..."
    sleep 30
  done
  echo "[ollama] Model ${MODEL} ready."
fi

wait "${SERVER_PID}"
