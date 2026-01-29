# ZK-DEX Production Deployment Checklist

**Last Updated**: 2026-01-29
**Security Level**: CRITICAL

---

## ⚠️ PRE-DEPLOYMENT SECURITY CHECKS

### 1. Development Mode Verification (CRITICAL)

- [ ] **Verify network configuration**
  ```bash
  # Check target network in truffle-config.js or hardhat.config.js
  cat truffle-config.js | grep -A 10 "networks:"
  ```

- [ ] **Confirm development mode is disabled**
  - The deployment script (`migrations/2_deploy_contracts.js`) automatically sets `development = false` for production networks
  - Contract constructor (`ZkDaiBase.sol`) enforces chainId check - will REVERT if `development = true` on production networks

- [ ] **Verify chainId restrictions**
  - Development mode is only allowed on:
    - `chainId 1337` (Ganache)
    - `chainId 31337` (Hardhat Network)
  - Production networks that will REJECT development mode:
    - `chainId 1` (Ethereum Mainnet)
    - `chainId 11155111` (Sepolia)
    - `chainId 137` (Polygon)
    - `chainId 42161` (Arbitrum One)
    - `chainId 10` (Optimism)

### 2. ZK Circuit Verification

- [ ] **Verify all circuits are compiled with production parameters**
  ```bash
  ls -lh vapp/public/circuits/
  # Should contain:
  # - mint_burn_note.wasm
  # - transfer_note.wasm
  # - convert_note.wasm
  # - make_order.wasm
  # - take_order.wasm
  # - settle_order.wasm
  # - All corresponding verification_key.json files
  ```

- [ ] **Confirm verifier contracts match circuit versions**
  ```bash
  # Check git commit hash of circuits and verifiers
  git log --oneline contracts/verifiers/ vapp/public/circuits/ | head -5
  ```

- [ ] **Run circuit security checks** (if available)
  ```bash
  # Circomspect static analysis (if installed)
  circomspect circuits-circom/main/*.circom

  # Verify R1CS constraints
  snarkjs r1cs info vapp/public/circuits/transfer_note.r1cs
  ```

### 3. Smart Contract Security

- [ ] **Run Slither static analysis**
  ```bash
  slither contracts/ --exclude-dependencies
  ```

- [ ] **Run unit tests**
  ```bash
  npm test
  # All tests must pass
  ```

- [ ] **Verify contract addresses**
  - [ ] DAI token address is correct for target network
  - [ ] All verifier contracts are deployed
  - [ ] No hardcoded addresses remain

### 4. Frontend Security

- [ ] **Content Security Policy is enabled** (`vapp/index.html`)
  ```html
  <meta http-equiv="Content-Security-Policy" content="...">
  ```

- [ ] **Cryptographic security fixes are applied**
  - [ ] `normalizeFieldElement()` used consistently
  - [ ] `getSecureRandomBytes()` replaces all `crypto.getRandomValues()`
  - [ ] Field reduction is uniform across all crypto operations

- [ ] **Build frontend for production**
  ```bash
  cd vapp
  npm run build
  # Verify dist/ output
  ```

### 5. Environment Variables

- [ ] **Set production environment variables**
  ```bash
  export NODE_ENV=production
  export INFURA_API_KEY=<your-key>
  # Or use .env.production file
  ```

- [ ] **No private keys in environment or config files**
  ```bash
  grep -r "PRIVATE_KEY\|SECRET\|0x[a-f0-9]{64}" . --exclude-dir=node_modules
  # Should return no matches
  ```

---

## 🚀 DEPLOYMENT STEPS

### Step 1: Deploy Contracts

```bash
# Dry run (optional)
truffle migrate --network <target-network> --dry-run

# Actual deployment
truffle migrate --network <target-network>
```

**Expected output:**
```
📋 Deployment Configuration:
   Network: <target-network>
   Development mode: false
   ZK proof verification: ✅ ENABLED

✅ Deployment completed:
   ZkDex address: 0x...
   Development mode: false

🔒 Security verification passed: ZK proof verification is ENABLED.
```

**⚠️ STOP DEPLOYMENT IF:**
- Output shows `Development mode: true`
- Output shows `ZK proof verification: ❌ DISABLED`
- Any error message mentioning "SECURITY ERROR"

### Step 2: Post-Deployment Verification

- [ ] **Verify on block explorer**
  ```bash
  # Example for Etherscan
  open "https://etherscan.io/address/<zkdex-address>"
  ```

- [ ] **Call contract view functions**
  ```bash
  truffle console --network <target-network>

  # In console:
  const zkDex = await ZkDex.deployed()
  const isDev = await zkDex.development()
  console.log("Development mode:", isDev)  // MUST be false

  const daiAddr = await zkDex.dai()
  console.log("DAI address:", daiAddr)
  ```

- [ ] **Test with small amount first**
  - Mint 0.01 ETH note
  - Transfer to another account
  - Verify note state transitions

### Step 3: Frontend Deployment

- [ ] **Update contract addresses in frontend**
  ```javascript
  // vapp/src/config/contracts.ts (or equivalent)
  export const CONTRACTS = {
    ZkDex: '<deployed-address>',
    DAI: '<dai-address>',
    network: '<chainId>'
  }
  ```

- [ ] **Deploy frontend**
  ```bash
  cd vapp
  npm run build
  # Deploy dist/ to hosting service (Vercel, Netlify, etc.)
  ```

- [ ] **Verify CSP in production**
  ```bash
  curl -I https://your-zkdex-frontend.com | grep -i "content-security-policy"
  ```

---

## ✅ POST-DEPLOYMENT VERIFICATION

### Security Verification

- [ ] **Confirm ZK proofs are enforced**
  ```bash
  # Try to submit invalid proof (should fail)
  # If this succeeds, development mode is ON - CRITICAL ERROR!
  ```

- [ ] **Check contract events**
  ```bash
  # Verify NoteStateChange events are emitted correctly
  truffle console --network <target-network>
  const zkDex = await ZkDex.deployed()
  const events = await zkDex.getPastEvents('NoteStateChange', {
    fromBlock: 0,
    toBlock: 'latest'
  })
  console.log(events)
  ```

- [ ] **Monitor gas usage**
  - Mint note: ~500k-1M gas
  - Transfer note: ~1M-2M gas
  - Settle order: ~2M-3M gas

### Functional Testing

- [ ] **Test user flow end-to-end**
  1. Create account
  2. Mint ETH note
  3. Transfer to self
  4. Mint DAI note
  5. Create sell order
  6. Take order
  7. Settle order

- [ ] **Test error cases**
  - Invalid proof submission (should revert)
  - Double-spend attempt (should revert)
  - Invalid note state transition (should revert)

---

## 📊 MONITORING & INCIDENT RESPONSE

### Metrics to Track

- [ ] **Transaction success rate**
- [ ] **Gas usage trends**
- [ ] **Note state distribution** (Valid/Trading/Spent)
- [ ] **Order volume and settlement**

### Security Monitoring

- [ ] **Set up alerts for:**
  - Unusual transaction patterns
  - High gas usage
  - Failed proof verifications
  - Contract balance changes

### Emergency Contacts

- **Security Team**: [email]
- **DevOps Team**: [email]
- **Circuit Auditor**: [contact]

### Circuit Breaker (if implemented)

- [ ] Test pause functionality
- [ ] Verify unpause requires multi-sig
- [ ] Document emergency shutdown procedure

---

## 🔴 CRITICAL FAILURES - IMMEDIATE ACTION REQUIRED

**If any of these occur, STOP deployment immediately:**

1. **Development mode enabled on production**
   - Symptom: `development = true` after deployment
   - Action: DO NOT USE. Redeploy with correct settings.

2. **Proof verification bypass detected**
   - Symptom: Transaction succeeds without valid proof
   - Action: Contract is compromised. Emergency shutdown.

3. **Frontend can create notes without ZK proof**
   - Symptom: Note created without calling proof generator
   - Action: Frontend bug. Disable frontend immediately.

4. **Contract balance mismatch**
   - Symptom: Total note values ≠ contract balance
   - Action: Possible double-spend. Pause contract.

---

## 📝 DEPLOYMENT LOG TEMPLATE

```
Deployment Date: YYYY-MM-DD HH:MM UTC
Network: <mainnet/sepolia/etc>
ChainId: <1/11155111/etc>
Deployer Address: 0x...

Contract Addresses:
- ZkDex: 0x...
- MockDai: 0x...
- MintBurnNoteVerifier: 0x...
- TransferNoteVerifier: 0x...
- ConvertNoteVerifier: 0x...
- MakeOrderVerifier: 0x...
- TakeOrderVerifier: 0x...
- SettleOrderVerifier: 0x...

Configuration:
- Development Mode: false ✅
- ZK Proof Verification: ENABLED ✅
- ChainId Check: PASSED ✅

Verification:
- Block Explorer: <link>
- Contract Verified: YES/NO
- Initial Test Transaction: <tx-hash>

Sign-off:
- Developer: [name]
- Reviewer: [name]
- Security Lead: [name]
```

---

## 📚 REFERENCES

- Security Analysis Report: `docs/ZK-DEX_Security_Analysis_Report_EN.md`
- Security Fixes Report: `SECURITY_FIXES.md`
- Circuit Documentation: `circuits-circom/README.md`
- Architecture Documentation: `ARCHITECTURE.md`

---

**⚠️ REMEMBER: Never deploy with `development = true` on production networks. The contract will revert, but multiple safety checks exist to prevent this critical error.**
