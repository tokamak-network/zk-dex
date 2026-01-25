import { toBeHex, zeroPadValue, toBigInt } from 'ethers'

export function useFormatters() {
  function padLeft(value: string | number | bigint, length: number): string {
    const hex = toBeHex(toBigInt(value))
    return zeroPadValue(hex, length / 2)
  }

  function hexToNumberString(hex: string): string {
    return toBigInt(hex).toString()
  }

  function toNumberString(value: bigint | number | string): string {
    return value.toString()
  }

  function formatAddress(a: string | number | bigint): string {
    const bn = toBigInt(a)
    const hex = toBeHex(bn)
    return zeroPadValue(hex, 20)
  }

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
    abbreviateZk
  }
}
