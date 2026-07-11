#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

RPC_URL="${LOCAL_RPC_URL:-http://127.0.0.1:8545}"
NODE_LOG="${LOCAL_NODE_LOG:-/tmp/group8-hardhat-node.log}"
DEPLOY_LOG="${LOCAL_DEPLOY_LOG:-/tmp/group8-local-deploy.log}"
STARTED_NODE_PID=""

rpc_ready() {
  curl -sS -X POST \
    -H 'Content-Type: application/json' \
    --data '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}' \
    "$RPC_URL" >/dev/null 2>&1
}

cleanup() {
  if [[ -n "$STARTED_NODE_PID" ]]; then
    kill "$STARTED_NODE_PID" >/dev/null 2>&1 || true
    wait "$STARTED_NODE_PID" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

if rpc_ready; then
  echo "Using existing local Hardhat RPC at $RPC_URL"
else
  echo "Starting local Hardhat node at $RPC_URL"
  npm run node >"$NODE_LOG" 2>&1 &
  STARTED_NODE_PID="$!"

  for _ in {1..60}; do
    if rpc_ready; then
      break
    fi
    sleep 1
  done

  if ! rpc_ready; then
    echo "Hardhat node did not become ready. Log: $NODE_LOG" >&2
    exit 1
  fi
fi

echo "Compiling contracts..."
npm run compile

echo "Running unit tests..."
npm test

echo "Resetting local Ignition deployment records for a fresh localhost deploy..."
rm -rf ignition/deployments/chain-31337

echo "Deploying locally with Hardhat Ignition..."
npm run deploy:local | tee "$DEPLOY_LOG"

CONTRACT_ADDRESS="$(node -e "const f=require('./ignition/deployments/chain-31337/deployed_addresses.json'); console.log(f['CrowdfundingPlatformModule#CrowdfundingPlatform']);")"
if [[ -z "$CONTRACT_ADDRESS" || "$CONTRACT_ADDRESS" == "undefined" ]]; then
  echo "Could not read local deployed contract address" >&2
  exit 1
fi

echo "Exporting frontend ABI/deployment metadata for $CONTRACT_ADDRESS..."
CONTRACT_ADDRESS="$CONTRACT_ADDRESS" CONTRACT_NETWORK="localhost" npm run export:abi

echo "Checking, building, and E2E testing SvelteKit frontend..."
npm run frontend:check
npm run frontend:build
npm run frontend:test:e2e

echo "Running frontend-ABI local smoke test..."
CONTRACT_ADDRESS="$CONTRACT_ADDRESS" LOCAL_RPC_URL="$RPC_URL" npm run test:local:smoke

echo
printf 'Full local stack test passed.\nContract: %s\nDeploy log: %s\nNode log: %s\n' "$CONTRACT_ADDRESS" "$DEPLOY_LOG" "$NODE_LOG"
