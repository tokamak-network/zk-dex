const express = require('express');

const asyncWrap = require('../lib/asyncWrap.cjs');

const {
  getAccounts,
  addAccount,
  deleteAccount,
} = require('../localstorage.cjs');

const router = express.Router();

/**
 * Get accounts for a key
 * Still needed for fetching account metadata (no sensitive data)
 */
router.get('/:key', asyncWrap(
  async function (req, res) {
    const key = req.params.key;
    const accounts = getAccounts(key);
    return res.status(200).json({
      accounts,
    });
  }
));

/**
 * DEPRECATED: Account creation is now done in the browser
 * This endpoint is kept for backwards compatibility but returns 410 Gone
 *
 * Security Note: Creating accounts server-side was a security risk because
 * it required sending the passphrase to the server. Account creation should
 * now be done entirely in the browser using Web Crypto API.
 */
router.post('/', asyncWrap(
  async function (req, res) {
    return res.status(410).json({
      error: 'DEPRECATED: Account creation has moved to browser-side. Use the browser\'s createAccountLocal() function instead.',
      message: 'This endpoint is no longer available for security reasons. Secret keys should never leave the browser.'
    });
  }
));

/**
 * DEPRECATED: Account unlock is now done in the browser
 * This endpoint is kept for backwards compatibility but returns 410 Gone
 *
 * Security Note: Unlocking accounts server-side was a critical security risk
 * because it required sending the keystore and passphrase to the server.
 * Account unlock should now be done entirely in the browser.
 */
router.post('/unlock', asyncWrap(
  async function (req, res) {
    return res.status(410).json({
      error: 'DEPRECATED: Account unlock has moved to browser-side. Use the browser\'s unlockAccountLocal() function instead.',
      message: 'This endpoint is no longer available for security reasons. Secret keys should never leave the browser.'
    });
  }
));

/**
 * Import account metadata (without keystore)
 * Used to store account metadata on server after browser-side creation
 *
 * Security Note: This should only receive public data (address, publicKey).
 * The keystore is now stored only in browser localStorage, not on the server.
 */
router.post('/import', asyncWrap(
  async function (req, res) {
    const key = req.body.key;
    let account = req.body.account;

    // Security: Strip keystore and secretKey if accidentally included
    if (account) {
      const { keystore, secretKey, ...safeAccount } = account;
      if (keystore || secretKey) {
        console.warn('WARNING: Client attempted to send keystore/secretKey to server. Stripping sensitive data.');
      }
      account = safeAccount;
    }

    const accounts = addAccount(key, account);
    return res.status(200).json({
      accounts,
    });
  }
));

router.delete('/', asyncWrap(
  async function (req, res) {
    const key = req.body.key;
    const address = req.body.address;
    const accounts = deleteAccount(key, address);
    return res.status(200).json({
      accounts,
    });
  }
));

module.exports = router;
