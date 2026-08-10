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
        totalQuantity: 28, // (10-2) + (20-0)
        orders: [
          {
            userId: 1,
            quantity: 10,
            filledQuantity: 2,
            orderId: 101,
            createdAt: "2026-08-09 1000",
          },
          {
            userId: 2,
            quantity: 20,
            filledQuantity: 0,
            orderId: 102,
            createdAt: "2026-08-09 1005",
          },
        ],
      },
      // Lower Bids
      145.0: {
        totalQuantity: 15, // (15-5) + (5-0)
        orders: [
          {
            userId: 3,
            quantity: 15,
            filledQuantity: 5,
            orderId: 103,
            createdAt: "2026-08-09 1010",
          },
          {
            userId: 4,
            quantity: 5,
            filledQuantity: 0,
            orderId: 104,
            createdAt: "2026-08-09 1015",
          },
        ],
      },
      144.5: {
        totalQuantity: 70, // (50-10) + (30-0)
        orders: [
          {
            userId: 5,
            quantity: 50,
            filledQuantity: 10,
            orderId: 105,
            createdAt: "2026-08-09 1020",
          },
          {
            userId: 6,
            quantity: 30,
            filledQuantity: 0,
            orderId: 106,
            createdAt: "2026-08-09 1025",
          },
        ],
      },
    },
    ASKS: {
      // Lowest Ask (Best price for a buyer to hit)
      150.0: {
        totalQuantity: 30, // (25-5) + (10-0)
        orders: [
          {
            userId: 7,
            quantity: 25,
            filledQuantity: 5,
            orderId: 107,
            createdAt: "2026-08-09 1000",
          },
          {
            userId: 8,
            quantity: 10,
            filledQuantity: 0,
            orderId: 108,
            createdAt: "2026-08-09 1005",
          },
        ],
      },
      // Higher Asks
      150.5: {
        totalQuantity: 18, // (12-2) + (8-0)
        orders: [
          {
            userId: 9,
            quantity: 12,
            filledQuantity: 2,
            orderId: 109,
            createdAt: "2026-08-09 1010",
          },
          {
            userId: 10,
            quantity: 8,
            filledQuantity: 0,
            orderId: 110,
            createdAt: "2026-08-09 1015",
          },
        ],
      },
      151.0: {
        totalQuantity: 90, // (100-50) + (40-0)
        orders: [
          {
            userId: 11,
            quantity: 100,
            filledQuantity: 50,
            orderId: 111,
            createdAt: "2026-08-09 1020",
          },
          {
            userId: 12,
            quantity: 40,
            filledQuantity: 0,
            orderId: 112,
            createdAt: "2026-08-09 1025",
          },
        ],
      },
    },
  },
};