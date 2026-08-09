export interface Order {
  userId: number;
  quantity: number;
  filledQuantity: number;
  orderId: number;
  createdAt: string;
}
export interface OrderBook {
  BIDS: {
    [amount: number]: {
      totalQuantity: number;
      orders: Order[];
    };
  };
  ASKS: {
    [amount: number]: {
      totalQuantity: number;
      orders: Order[];
    };
  };
}
export const ORDERBOOK: Record<number, OrderBook> = {
  1: {
    BIDS: {
      // Highest Bid (Best price for a seller to hit)
      145.5: {
        totalQuantity: 10,
        orders: [
          {
            userId: 1,
            quantity: 10,
            filledQuantity: 0,
            orderId: 101,
            createdAt: "2026-07-28 2300",
          },
        ],
      },
      // Lower Bids
      145.0: {
        totalQuantity: 15,
        orders: [
          {
            userId: 3,
            quantity: 15,
            filledQuantity: 0,
            orderId: 103,
            createdAt: "2026-07-28 2305",
          },
        ],
      },
      144.5: {
        totalQuantity: 50,
        orders: [
          {
            userId: 4,
            quantity: 50,
            filledQuantity: 0,
            orderId: 104,
            createdAt: "2026-07-28 2310",
          },
        ],
      },
    },
    ASKS: {
      // Lowest Ask (Best price for a buyer to hit)
      150.0: {
        totalQuantity: 25,
        orders: [
          {
            userId: 2,
            quantity: 25,
            filledQuantity: 0,
            orderId: 102,
            createdAt: "2026-07-28 2300",
          },
        ],
      },
      // Higher Asks
      150.5: {
        totalQuantity: 12,
        orders: [
          {
            userId: 5,
            quantity: 12,
            filledQuantity: 0,
            orderId: 105,
            createdAt: "2026-07-28 2315",
          },
        ],
      },
      151.0: {
        totalQuantity: 100,
        orders: [
          {
            userId: 6,
            quantity: 100,
            filledQuantity: 0,
            orderId: 106,
            createdAt: "2026-07-28 2320",
          },
        ],
      },
    },
  },
};