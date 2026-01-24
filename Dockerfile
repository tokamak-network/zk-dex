# ZK-DEX Dockerfile
# Conditional build: uses local circuit artifacts if available, otherwise builds from scratch

# ============================================
# Stage 1: Build Circom compiler (only if needed)
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
# Stage 2: Runtime image
# ============================================
FROM node:20-bookworm-slim

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

# Conditional circuit build:
# If zkey files exist (local build), use them
# Otherwise, download ptau and compile
RUN if [ -f "circuits-circom/build/mint_burn_note.zkey" ]; then \
        echo "✓ Using pre-built circuit artifacts"; \
        ls -la circuits-circom/build/*.zkey | head -6; \
    else \
        echo "No pre-built circuits found, building from scratch..."; \
        mkdir -p circuits-circom/ptau && \
        echo "Downloading Powers of Tau (pot20, ~400MB)..." && \
        curl -L --retry 3 --retry-delay 5 \
            -o circuits-circom/ptau/pot20_final.ptau \
            "https://storage.googleapis.com/zkevm/ptau/powersOfTau28_hez_final_20.ptau" && \
        echo "Compiling circuits..." && \
        cd circuits-circom && npm run compile && \
        echo "Running trusted setup..." && \
        npm run setup && \
        echo "Generating verifiers..." && \
        npm run generate-verifiers || true; \
    fi

# Verify circuit artifacts
RUN echo "=== Circuit artifacts ===" && \
    ls -la circuits-circom/build/*.zkey 2>/dev/null | head -6 || echo "Warning: No zkey files" && \
    ls -la circuits-circom/build/*_js/*.wasm 2>/dev/null | head -6 || echo "Warning: No wasm files"

# Set environment variables
ENV NODE_ENV=development

# Expose Ganache port
EXPOSE 8545

# Default command: run tests
CMD ["npm", "test"]
