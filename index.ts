import express from "express";
import { PrismaClient } from "./generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import authMiddleware from "./middleware";
import jwt from "jsonwebtoken";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({ adapter });

const app = express();
app.use(express.json());

interface UserBalance {
  USD: {
    total: number;
    locked: number;
  };
  Stocks: {
    [ticker: string]: number;
  };
}

interface Order {
  userId: number;
  quantity: number;
  filledQuantity: number;
  orderId: number;
  createdAt: string;
}
interface OrderBook {
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
const ORDERBOOK: Record<number, OrderBook> = {
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
const BALANCES: Record<string, UserBalance> = {
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

app.get("/getorderbook", (req, res) => {
  return res.json({
    orderbook: ORDERBOOK,
  });
});

app.post("/signup", async (req, res) => {
  const username = req.body.username;
  const password = req.body.password;
  const user = await prisma.user.findUnique({
    where: {
      username: username,
    },
  });
  if (user) {
    return res.json({
      message: "User with the particular username already exist",
    });
  }
  const hashedPassword = await Bun.password.hash(password);
  try {
    const user = await prisma.user.create({
      data: {
        username: username,
        password: hashedPassword,
      },
    });
    res.status(200).json({
      status: 200,
      msg: "User created Successfully",
      userCreated: {
        userId: user.id,
        username: user.username,
      },
    });
  } catch (e) {
    res.status(400).json({
      status: 400,
      msg: "User could not be created",
    });
  }
});

app.post("/signin", async (req, res) => {
  const username = req.body.username;
  const password = req.body.password;
  const user = await prisma.user.findUnique({
    where: {
      username: username,
    },
  });
  if (!user) {
    return res.status(400).json({
      status: 400,
      msg: "Username not found",
    });
  }
  try {
    const isMatch = await Bun.password.verify(password, user.password);
    if (isMatch) {
      const token = jwt.sign(
        {
          userid: user.id,
        },
        process.env.JWT_SECRET!,
      );
      return res.status(200).json({
        status: 200,
        token: token,
      });
    } else {
      return res.status(400).json({
        status: 400,
        msg: "Password is Wrong !!",
      });
    }
  } catch (e) {
    return res.status(400).json({
      status: 400,
      msg: "Error Occurred",
    });
  }
});

app.post("/post-stock", async (req, res) => {
  const title = req.body.title;
  const symbol = req.body.symbol;
  try {
    const stock = await prisma.stock.create({
      data: {
        title,
        symbol,
      },
    });

    return res.status(200).json({
      status: 200,
      msg: "Stock entered successfully",
      stock: stock,
    });
  } catch (e) {
    return res.status(400).json({
      status: 400,
      msg: "Error Occurred",
    });
  }
});

/**
 * ORDER CREATION ENDPOINT
 *
 * Summary of Actions Performed:
 * 1. Extract request data and validate user authentication.
 * 2. Verify user balance and lock the required funds.
 * 3. Persist the new order record in the database.
 * 4. Fetch stock metadata from the database.
 * 5. Initialize the in-memory Order Book structures if they do not exist.
 * 6. Update the in-memory Order Book with the new order.
 * 7. Return a success response to the client.
 */
app.post("/order", authMiddleware, async (req, res) => {
  // 1. Extract request data and validate user authentication.
  const userId = req.userId;
  const side = req.body.side;
  const type = req.body.type;
  const stockid = req.body.stockid;
  const price = req.body.price;
  const quantity = req.body.quantity;
  const status = req.body.status;
  const filledquantity = req.body.filledquantity;
  let finalPrice = null

  if(type === "LIMIT"){
    if (!price) { 
      return res.json({
        msg : " The LIMIT order must include a PRICE"
      })
    }
    finalPrice = price
  }
  else if(type === "MARKET"){ 
    finalPrice = null
  }

  if (!userId) {
    return res.status(400).json({ msg: "Unauthorised" });
  }
  console.log(" The user Id is of the format " + typeof userId);

  // ------------------------------------------------------------------------------------
  // lock the balance
  // check that the User has Sufficient Balance or not
  // 2. Verify user balance and lock the required funds.
  const userBalance = BALANCES[userId.toString()];
  if (!userBalance) {
    return res.json({
      msg: "Balance is not availble",
    });
  }
  const lockedBalance = price * quantity;
  if (userBalance.USD["total"] < lockedBalance) {
    return res.json({
      msg: "You have insifficient Balance",
    });
  }
  userBalance.USD["locked"] -= lockedBalance;
  console.log(" balance is locked ");
  // -------------------------------------------------------------------------------------------

  // update the order db
  // 3. Persist the new order record in the database.
  const createdOrder = await prisma.order.create({
    data: {
      userId: userId,
      side: side,
      type: type,
      stockid: stockid,
      price: finalPrice,
      quantity: quantity,
      status: status,
      filledquantity: filledquantity,
    },
  });

  // update the In memory Order Book
  // 4. Fetch stock metadata from the database.
  const ticker = await prisma.stock.findUnique({
    where: {
      id: stockid,
    },
  });
  console.log("You have created an order for" + ticker?.title);

  //safety check for the presence of stockid
  // 5. Initialize the in-memory Order Book structures if they do not exist.
  if (!ORDERBOOK[stockid]) {
    ORDERBOOK[stockid] = {
      BIDS: {},
      ASKS: {},
    };
  }
  type OrderType = "BIDS" | "ASKS";
  type MarketType = "LIMIT" | "MARKET";
  var otype: OrderType;
  var mtype: MarketType;
  otype = side === "BUY" ? "BIDS" : "ASKS";
  mtype = type === "LIMIT" ? "LIMIT" : "MARKET";

  //safety cehck for the presence of price
  if (!ORDERBOOK[stockid][otype][price]) {
    ORDERBOOK[stockid][otype][price] = {
      totalQuantity: 0,
      orders: [],
    };
  }

  if (otype == "BIDS" && mtype == "MARKET") {
    const stockAsks = ORDERBOOK[stockid]["ASKS"];
    if (Object.keys(stockAsks).length == 0) {
      return res.json({
        msg: "There is no ASKS for this " + ticker?.title,
      });
    }
    const priceStrings = Object.keys(stockAsks);
    let priceNumbers = priceStrings.map((price) => Number(price));
    let remainingquantity = quantity; // quantity that the BIDS is wanting to sell
    while (remainingquantity > 0 && priceNumbers.length > 0) {
      const lowestAskPrice = Math.min(...priceNumbers);
      const currentpricelevel = stockAsks[lowestAskPrice];
      // individual order level
      while (remainingquantity > 0 && currentpricelevel!.orders.length > 0) {
        let currentorder = currentpricelevel!.orders[0];
        let availableOrderQuantity =
          currentorder!.quantity - currentorder!.filledQuantity;
        if (remainingquantity >= availableOrderQuantity) {
          // full order fill
          remainingquantity -= availableOrderQuantity;
          currentpricelevel!.totalQuantity -= availableOrderQuantity;
          currentpricelevel!.orders.shift();
        } else {
          //partial order fill
          currentorder!.filledQuantity += remainingquantity;
          currentpricelevel!.totalQuantity -= remainingquantity;
          remainingquantity = 0;
        }
      }
      if (currentpricelevel!.orders.length === 0) {
        priceNumbers = priceNumbers.filter((p) => p !== lowestAskPrice);
        delete stockAsks[lowestAskPrice];
      }
    }
  }

  if (otype == "ASKS" && mtype == "MARKET") {
    const StockBids = ORDERBOOK[stockid]["BIDS"];
    const priceStrings = Object.keys(StockBids);
    if (priceStrings.length == 0) {
      return res.json({
        msg: "There is no BIDS fro the ASK that you made",
      });
    }
    let priceNumbers = priceStrings.map((p) => Number(p));
    let remainingquantity = quantity;
    while (priceNumbers.length > 0 && remainingquantity > 0) {
      const highestBidPrice = Math.max(...priceNumbers);
      const currentpricelevel = ORDERBOOK[stockid]["BIDS"][highestBidPrice];
      //individual Order Level
      while (remainingquantity > 0 && currentpricelevel!.orders.length > 0) {
        const currentOrder = currentpricelevel!.orders[0];
        const currentavailableOrderQuantity =
          currentOrder!.quantity - currentOrder!.filledQuantity;
        if (remainingquantity >= currentavailableOrderQuantity) {
          // the order is completely filled
          remainingquantity -= currentavailableOrderQuantity;
          currentpricelevel!.totalQuantity -= currentavailableOrderQuantity;
          currentpricelevel!.orders.shift();
        } else {
          // the order should Be partially filled
          currentOrder!.filledQuantity += remainingquantity;
          currentpricelevel!.totalQuantity -= remainingquantity;
          remainingquantity = 0;
        }
      }
      if (currentpricelevel!.orders.length === 0) {
        priceNumbers = priceNumbers.filter((p) => p !== highestBidPrice);
        delete ORDERBOOK[stockid]["BIDS"][highestBidPrice];
      }
    }
  }

  const currentPriceLevel = ORDERBOOK[stockid][otype][price]!;

  // 6. Update the in-memory Order Book with the new order.
  const newOrder = {
    userId: userId, 
    quantity,
    filledQuantity: filledquantity,
    orderId: createdOrder.id,
    createdAt: new Date().toISOString(),
  };

  // before the update we have to fill the order

  //upddate the in memory ORDERBOOK
  currentPriceLevel["totalQuantity"] += quantity;
  currentPriceLevel.orders.push(newOrder);
  console.log(createdOrder);
  console.log("Updated the ORDERBOOK");

  // 7. Return a success response to the client.
  res.status(200).json({ msg: "order created" });
});

app.delete("/order/:orderId", (req, res) => {
  // TODO
  res.status(200).json({ msg: "order deleted" });
});

app.get("/depth/:symbol", (req, res) => {
  // TODO
  res.status(200).json({ msg: "depth" });
});

app.get("/orders", (req, res) => {
  // TODO
  res.status(200).json({ msg: "all orders" });
});

app.get("/fills", (req, res) => {
  // TODO
  res.status(200).json({ msg: "fills" });
});

app.get("/balance/usd", (req, res) => {
  // TODO
  res.status(200).json({ msg: "usd balance" });
});

app.get("/balance", (req, res) => {
  // TODO
  res.status(200).json({ msg: "balance" });
});

app.listen(3000, () => {
  console.log("Server running at http://localhost:3000");
});
