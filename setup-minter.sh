#!/bin/bash

set -eu

echo "0x$(openssl rand -hex 32)" | pnpm exec wrangler secret put MINTER_PRIVATE_KEY
