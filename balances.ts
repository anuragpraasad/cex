export interface UserBalance {
  USD: {
    total: number;
    locked: number;
  };
  Stocks: {
    [ticker: string]: number;
  };
}


export const BALANCES: Record<string, UserBalance> = {
  "1": {
    USD: {
      total: 36000,
      locked: 100,
    },
    Stocks: {
      SOL: 23,
    },
  },
  "5": {
    USD: {
      total: 50000,
      locked: 100,
    },
    Stocks: {
      SOL: 100,
    },
  },
};