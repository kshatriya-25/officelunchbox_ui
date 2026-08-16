import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { PublicMenuItem } from '../types'

const STORAGE_KEY = 'olb.cart'

export interface CartLine {
  menu_item_id: number
  name: string
  unit_price: string
  quantity: number
  image_path: string | null
  food_type: string
}

interface CartState {
  /** The date the cart was filled for. A cart from yesterday is meaningless
   *  because the menu and its prices are published per service date. */
  serviceDate: string | null
  lines: CartLine[]
  dropZoneId: number | null
  note: string
}

const empty: CartState = { serviceDate: null, lines: [], dropZoneId: null, note: '' }

function restore(): CartState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return empty
    return { ...empty, ...JSON.parse(raw) }
  } catch {
    return empty
  }
}

function persist(state: CartState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Ignore quota errors — the cart still works in memory.
  }
}

const cartSlice = createSlice({
  name: 'cart',
  initialState: restore(),
  reducers: {
    setQuantity(
      state,
      action: PayloadAction<{ item: PublicMenuItem; quantity: number; serviceDate: string }>,
    ) {
      const { item, quantity, serviceDate } = action.payload

      // Menu rolled over to a new day — start clean rather than carrying stale prices.
      if (state.serviceDate && state.serviceDate !== serviceDate) {
        state.lines = []
        state.note = ''
      }
      state.serviceDate = serviceDate

      const existing = state.lines.find((line) => line.menu_item_id === item.id)

      if (quantity <= 0) {
        state.lines = state.lines.filter((line) => line.menu_item_id !== item.id)
      } else if (existing) {
        existing.quantity = quantity
        // Refresh the snapshot in case a price override landed since it was added.
        existing.unit_price = item.price
      } else {
        state.lines.push({
          menu_item_id: item.id,
          name: item.name,
          unit_price: item.price,
          quantity,
          image_path: item.image_path,
          food_type: item.food_type,
        })
      }

      persist(state)
    },

    /** Trim lines that have sold out or vanished from today's menu. */
    reconcile(state, action: PayloadAction<{ items: PublicMenuItem[]; serviceDate: string }>) {
      const { items, serviceDate } = action.payload

      if (state.serviceDate && state.serviceDate !== serviceDate) {
        Object.assign(state, { ...empty, serviceDate })
        persist(state)
        return
      }
      state.serviceDate = serviceDate

      const byId = new Map(items.map((i) => [i.id, i]))
      state.lines = state.lines.flatMap((line) => {
        const live = byId.get(line.menu_item_id)
        if (!live || live.is_sold_out) return []
        return [
          {
            ...line,
            unit_price: live.price,
            // `qty_remaining` is null when unlimited — nothing to clamp against.
            quantity: live.qty_remaining === null ? line.quantity : Math.min(line.quantity, live.qty_remaining),
          },
        ]
      })
      persist(state)
    },

    setDropZone(state, action: PayloadAction<number | null>) {
      state.dropZoneId = action.payload
      persist(state)
    },

    setNote(state, action: PayloadAction<string>) {
      state.note = action.payload
      persist(state)
    },

    clearCart(state) {
      Object.assign(state, { ...empty, dropZoneId: state.dropZoneId })
      persist(state)
    },
  },
})

export const { setQuantity, reconcile, setDropZone, setNote, clearCart } = cartSlice.actions
export default cartSlice.reducer
