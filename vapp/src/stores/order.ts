import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import * as api from '@/api'
import { useAccountStore } from './account'
import { useNoteStore, type Note } from './note'
import { logger } from '@/lib/logger'

export interface Order {
  hash: string
  maker: string
  price: string
  sourceToken: string
  targetToken: string
  sourceAmount: string
  targetAmount: string
  state: string  // '0x0' = CREATED, '0x1' = TAKEN, '0x2' = SETTLED
}

export interface OrderHistory {
  orderId: string
  type: string  // '0x0' = Sell, '0x1' = Buy
  state: string
  price: string
  makerNote: string
  makerNoteAmount: string
  takerNote?: string
  takerNoteAmount?: string
  timestamp?: string
  orderMaker?: string
  orderTaker?: string
  parentNote?: string
  sourceToken?: string
  targetToken?: string
  takerNoteToMaker?: string
}

export type BuyOrSell = 'buy' | 'sell'
export type MakeOrTake = 'make' | 'take'

export const useOrderStore = defineStore('order', () => {
  const accountStore = useAccountStore()
  const noteStore = useNoteStore()

  const orders = ref<Order[]>([])
  const orderHistory = ref<OrderHistory[]>([])
  const selectedOrder = ref<Order | null>(null)
  const daiAmount = ref('0')
  const doYouWantToBuyOrSell = ref<BuyOrSell>('buy')
  const doYouWantToMakeOrTake = ref<MakeOrTake>('make')

  const orderList = computed(() => {
    const list: Record<string, number> = {}
    orders.value.forEach(order => {
      // only valid orders (CREATED state)
      if (order.state === '0x0') {
        list[order.price] = (list[order.price] || 0) + 1
      }
    })
    return list
  })

  const ongoingOrderHistory = computed(() => {
    return orderHistory.value.filter(order => parseInt(order.state) <= 1)
  })

  const completedOrderHistory = computed(() => {
    return orderHistory.value.filter(order => parseInt(order.state) > 1)
  })

  const notesFilteredByOrderType = computed((): Note[] => {
    const notes = noteStore.notes

    if (doYouWantToBuyOrSell.value === 'buy') {
      if (doYouWantToMakeOrTake.value === 'make') {
        return notes.filter(note => note.token === '0x1' && note.state === '0x1')
      } else {
        return notes.filter(note => note.token === '0x0' && note.state === '0x1')
      }
    } else {
      if (doYouWantToMakeOrTake.value === 'make') {
        return notes.filter(note => note.token === '0x0' && note.state === '0x1')
      } else {
        return notes.filter(note => note.token === '0x1' && note.state === '0x1')
      }
    }
  })

  /** Replaces the orders list. */
  function setOrders(newOrders: Order[]) {
    orders.value = newOrders
  }

  /**
   * Appends an order to the list.
   * @param order - the order to add
   */
  function addOrder(order: Order) {
    orders.value.push(order)
  }

  /** Replaces the order history list. */
  function setOrderHistory(history: OrderHistory[]) {
    orderHistory.value = history
  }

  /**
   * Appends an order history entry.
   * @param history - the order history entry to add
   */
  function addOrderHistory(history: OrderHistory) {
    orderHistory.value.push(history)
  }

  /** Sets the currently selected order. */
  function setSelectedOrder(order: Order | null) {
    selectedOrder.value = order
  }

  /** Sets the DAI amount for order creation. */
  function setDaiAmount(amount: string) {
    daiAmount.value = amount
  }

  /** Sets the buy/sell preference. */
  function selectBuyOrSell(choice: BuyOrSell) {
    doYouWantToBuyOrSell.value = choice
  }

  /** Sets the make/take preference. */
  function selectMakeOrTake(choice: MakeOrTake) {
    doYouWantToMakeOrTake.value = choice
  }

  /** Fetches orders from the API. */
  async function loadOrders() {
    try {
      const data = await api.getOrders(accountStore.key!)
      orders.value = data || []
    } catch (err) {
      logger.error('Failed to load orders:', err)
    }
  }

  /** Fetches order history from the API. */
  async function loadOrderHistory() {
    try {
      const data = await api.getOrderHistory(accountStore.key!)
      orderHistory.value = data || []
    } catch (err) {
      logger.error('Failed to load order history:', err)
    }
  }

  /** Resets all order state to initial values. */
  function reset() {
    orders.value = []
    orderHistory.value = []
    selectedOrder.value = null
    daiAmount.value = '0'
    doYouWantToBuyOrSell.value = 'buy'
    doYouWantToMakeOrTake.value = 'make'
  }

  return {
    orders,
    orderHistory,
    selectedOrder,
    daiAmount,
    doYouWantToBuyOrSell,
    doYouWantToMakeOrTake,
    orderList,
    ongoingOrderHistory,
    completedOrderHistory,
    notesFilteredByOrderType,
    setOrders,
    addOrder,
    setOrderHistory,
    addOrderHistory,
    setSelectedOrder,
    setDaiAmount,
    selectBuyOrSell,
    selectMakeOrTake,
    loadOrders,
    loadOrderHistory,
    reset
  }
})
