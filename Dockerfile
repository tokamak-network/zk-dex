# ZK-DEX Dockerfile
# Multi-stage build: circuits → contracts → backend / frontend

# ============================================
# Stage 1: Build Circom compiler
# ============================================
FROM rust:1.75-slim-bookworm AS circom-builder

RUN apt-get update && apt-get install -y \
    git \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Build circom from source
RUN git clone https://github.com/iden3/circom.git /circom \
    && cd /circom \
    && git checkout v2.1.8 \
    && cargo build --release

# ============================================
# Stage 2: ZK-DEX base (circuits + contracts)
# ============================================
FROM node:20-bookworm-slim AS zkdex-base

# Install system dependencies
RUN apt-get update && apt-get install -y \
    git \
    python3 \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy circom binary from builder stage
COPY --from=circom-builder /circom/target/release/circom /usr/local/bin/circom

# Create app directory
WORKDIR /app

# Copy package files first for better layer caching
COPY package*.json ./
COPY circuits-circom/package*.json ./circuits-circom/

# Install root dependencies
RUN npm install

# Install circuits-circom dependencies
WORKDIR /app/circuits-circom
RUN npm install

# Return to app root
WORKDIR /app

# Copy the rest of the source code (includes pre-built circuits if available)
COPY . .

# Use pot20 in Docker (supports ~1M constraints, sufficient for all circuits, ~400MB vs 4.5GB for pot22)
ENV PTAU_SIZE=20

# Add snarkjs to PATH for circuit build scripts
ENV PATH="/app/circuits-circom/node_modules/.bin:${PATH}"

# Conditional circuit build:
# If zkey files exist (local build), use them
# Otherwise, download ptau and compile from scratch
RUN if [ -f "circuits-circom/build/mint_burn_note/mint_burn_note.zkey" ]; then \
        echo "✓ Using pre-built circuit artifacts"; \
        ls -la circuits-circom/build/*/*.zkey | head -6; \
    else \
        echo "No pre-built circuits found, building from scratch..."; \
        cd circuits-circom && \
        echo "Compiling circuits..." && \
        npm run compile && \
        echo "Running trusted setup (downloads pot${PTAU_SIZE})..." && \
        npm run setup && \
        echo "Generating Solidity verifiers..." && \
        npm run generate-verifiers; \
    fi

# Verify circuit artifacts
RUN echo "=== Circuit artifacts ===" && \
    ls -la circuits-circom/build/*/*.zkey 2>/dev/null | head -6 || echo "Warning: No zkey files" && \
    ls -la circuits-circom/build/*/*_js/*.wasm 2>/dev/null | head -6 || echo "Warning: No wasm files"

# Compile Solidity contracts (generates build/contracts/*.json ABI artifacts)
RUN npx truffle compile

# Deploy contracts to temporary Ganache to populate build/contracts/*.json with addresses.
# Addresses are deterministic (same mnemonic + fresh chain + same deploy order), so the
# addresses baked into the frontend bundle will match runtime Ganache deployments.
RUN npx -y ganache \
    --host 127.0.0.1 --port 8545 --networkId 1337 \
    --accounts 10 --defaultBalanceEther 1000 \
    --gasLimit 12000000 --gasPrice 20000000000 \
    --mnemonic "candy maple cake sugar pudding cream honey rich smooth crumble sweet treat" \
    &>/dev/null & \
    GANACHE_PID=$! && \
    echo "Starting temporary Ganache for contract deployment..." && \
    sleep 5 && \
    npx truffle migrate --network development --reset && \
    echo "Contract addresses populated in build/contracts/*.json" && \
    kill $GANACHE_PID 2>/dev/null || true

# Set environment variables
ENV NODE_ENV=development

# Default command: run tests
CMD ["npm", "test"]

# ============================================
# Stage 3: Frontend development (Vite dev server)
# ============================================
FROM node:20-bookworm-slim AS vapp-development

WORKDIR /app

# Install vapp dependencies
COPY vapp/package*.json vapp/package-lock.json ./
RUN npm ci --legacy-peer-deps

# Copy vapp source
COPY vapp/ .

# Copy contract ABIs from zkdex-base (needed for TypeScript compilation)
# vapp/src/stores/contract.ts imports from ../../../build/contracts/
COPY --from=zkdex-base /app/build/contracts/ /build/contracts/

# Copy circuit files for browser-side proof generation
COPY --from=zkdex-base /app/circuits-circom/build/ /tmp/circuits-build/
RUN CIRCUITS="mint_burn_note transfer_note make_order take_order settle_order convert_note" && \
    for c in $CIRCUITS; do \
        mkdir -p public/circuits/$c && \
        cp /tmp/circuits-build/$c/${c}_js/${c}.wasm public/circuits/$c/ && \
        cp /tmp/circuits-build/$c/${c}.zkey public/circuits/$c/; \
    done && \
    rm -rf /tmp/circuits-build && \
    echo "=== Circuit files for frontend ===" && \
    du -sh public/circuits/

EXPOSE 8080

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

# ============================================
# Stage 4: Frontend production build
# ============================================
FROM vapp-development AS vapp-builder

RUN npm run build

# ============================================
# Stage 5: Frontend production (nginx)
# ============================================
FROM nginx:alpine AS vapp-production

# Copy built files (includes circuit wasm/zkey in dist/circuits/)
COPY --from=vapp-builder /app/dist /usr/share/nginx/html

# Copy nginx config
COPY vapp/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
