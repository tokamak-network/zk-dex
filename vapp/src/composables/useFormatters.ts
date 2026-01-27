import { toBeHex, zeroPadValue, toBigInt } from 'ethers'

export function useFormatters() {
  /**
   * Left-pads a value to a specified byte length in hex.
   * @param value - the value to pad
   * @param length - the target length in bits (divided by 2 for byte count)
   * @returns the zero-padded hex string
   */
  function padLeft(value: string | number | bigint, length: number): string {
    const hex = toBeHex(toBigInt(value))
    return zeroPadValue(hex, length / 2)
  }

  /**
   * Converts a hex string to a decimal number string.
   * @param hex - the hex string to convert
   * @returns the decimal representation as a string
   */
  function hexToNumberString(hex: string): string {
    return toBigInt(hex).toString()
  }

  /**
   * Converts a bigint, number, or string to a decimal string.
   * @param value - the value to convert
   * @returns the decimal representation as a string
   */
  function toNumberString(value: bigint | number | string): string {
    return value.toString()
  }

  /**
   * Formats a value as a 20-byte zero-padded Ethereum address.
   * @param a - the value to format as an address
   * @returns the zero-padded 20-byte hex address
   */
  function formatAddress(a: string | number | bigint): string {
    const bn = toBigInt(a)
    const hex = toBeHex(bn)
    return zeroPadValue(hex, 20)
  }

  /**
   * Converts an order state hex code to a human-readable string.
   * @param value - the hex state code (0x0=CREATED, 0x1=TAKEN, 0x2=SETTLED)
   * @returns the human-readable state string
   */
  function orderState(value: string): string {
    switch (value) {
      case '0x0':
        return 'CREATED'
      case '0x1':
        return 'TAKEN'
      case '0x2':
        return 'SETTLED'
      default:
        return ''
    }
  }

  /**
   * Converts a note state hex code to a human-readable string.
   * @param value - the hex state code (0x0=INVALID, 0x1=VALID, 0x2=TRADING, 0x3=SPENT)
   * @returns the human-readable state string
   */
  function noteState(value: string): string {
    switch (value) {
      case '0x0':
        return 'INVALID'
      case '0x1':
        return 'VALID'
      case '0x2':
        return 'TRADING'
      case '0x3':
        return 'SPENT'
      default:
        return ''
    }
  }

  /**
   * Converts a transfer note type hex code to "Send" or "Receive".
   * @param value - the hex type code (0x0=Send, 0x1=Receive)
   * @returns the human-readable type string
   */
  function transferNoteType(value: string): string {
    switch (value) {
      case '0x0':
        return 'Send'
      case '0x1':
        return 'Receive'
      default:
        return ''
    }
  }

  /**
   * Converts an order type hex code to "Sell" or "Buy".
   * @param value - the hex type code (0x0=Sell, 0x1=Buy)
   * @returns the human-readable order type string
   */
  function orderType(value: string): string {
    switch (value) {
      case '0x0':
        return 'Sell'
      case '0x1':
        return 'Buy'
      default:
        return ''
    }
  }

  /**
   * Converts a token type value to "ETH" or "DAI".
   * @param type - the token type value (handles both short and padded hex formats)
   * @returns the human-readable token name
   */
  function tokenType(type: string): string {
    // Handle both short format (0x0, 0x1) and padded format (0x000...000, 0x000...001)
    const value = toBigInt(type || '0x0').toString()
    switch (value) {
      case '0':
        return 'ETH'
      case '1':
        return 'DAI'
      default:
        return ''
    }
  }

  /**
   * Checks if a note is a smart note based on its flag.
   * @param value - the hex flag (0x0=false, 0x1=true)
   * @returns true if smart note, false if not, or empty string for unknown values
   */
  function isSmartNote(value: string): boolean | string {
    switch (value) {
      case '0x0':
        return false
      case '0x1':
        return true
      default:
        return ''
    }
  }

  /**
   * Abbreviates an address to "0x1234...5678" format.
   * @param address - the full address string
   * @returns the abbreviated address
   */
  function abbreviate(address: string): string {
    if (!address) return ''
    const pre = address.substring(0, 6)
    const pos = address.substring(address.length - 4)
    return `${pre}...${pos}`
  }

  /**
   * Format ZK account address for display (0x... -> zk0x...)
   * This is display-only, actual address remains unchanged
   */
  function formatZkAddress(address: string): string {
    if (!address) return ''
    if (address.startsWith('0x')) {
      return 'zk' + address
    }
    return 'zk0x' + address
  }

  /**
   * Abbreviate ZK account address (zk0x1234...5678)
   */
  function abbreviateZk(address: string): string {
    if (!address) return ''
    const zkAddr = formatZkAddress(address)
    const pre = zkAddr.substring(0, 8) // zk0x + 4 chars
    const pos = zkAddr.substring(zkAddr.length - 4)
    return `${pre}...${pos}`
  }

  /**
   * Formats a Unix timestamp to a "YYYY-MM-DD HH:MM" string.
   * @param ts - the Unix timestamp in seconds
   * @returns the formatted date string, or "-" if no timestamp provided
   */
  function formatTimestamp(ts: number | undefined): string {
    if (!ts) return '-'
    const d = new Date(ts * 1000)
    const pad = (n: number) => n.toString().padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
  }

  return {
    padLeft,
    hexToNumberString,
    toNumberString,
    formatAddress,
    formatZkAddress,
    orderState,
    noteState,
    transferNoteType,
    orderType,
    tokenType,
    isSmartNote,
    abbreviate,
    abbreviateZk,
    formatTimestamp
  }
}
