const express = require('express');

const router = express.Router();

/**
 * DEPRECATED: Proof generation has moved to browser-side Web Workers
 *
 * This endpoint is no longer available for security reasons.
 * All ZK proof generation should now be done entirely in the browser
 * using the proofGenerator service and Web Workers.
 *
 * Security Note: Server-side proof generation was a critical security risk
 * because it required sending secret keys to the server. With browser-side
 * proof generation:
 * - Secret keys never leave the browser
 * - Proofs are generated in isolated Web Workers
 * - Circuit files are cached in IndexedDB for performance
 *
 * Migration Guide:
 * - Import { proofGenerator } from '@/lib/proofGenerator'
 * - Use proofGenerator.generateProof(circuitName, inputs, onProgress)
 * - Circuit inputs should be prepared using functions from '@/lib/circuitInputs'
 */
router.post('/', function (req, res) {
  return res.status(410).json({
    error: 'DEPRECATED: Proof generation has moved to browser-side Web Workers.',
    message: 'This endpoint is no longer available for security reasons. Secret keys should never leave the browser.',
    migration: {
      hint: 'Use proofGenerator.generateProof() from @/lib/proofGenerator in the browser',
      documentation: 'See vapp/src/lib/proofGenerator.ts for usage'
    }
  });
});

module.exports = router;
