import express from "express";
import { PrismaClient } from "./generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import authMiddleware from "./middleware";
import jwt from "jsonwebtoken";
import { ORDERBOOK } from "./orderbook";
import { BALANCES } from "./balances";
import { createClient } from "redis";

// Create the client (defaults to localhost:6379)
const redisClient = createClient({
  url: "rediss://default:gQAAAAAAAqHDAAIgcDExOGRiYzUyNGVlZDg0ZDEyOGE5OTEyZjlmNGRlNTJkZA@proper-chamois-172483.upstash.io:6379",
});
await redisClient.connect();

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({ adapter });

const app = express();
app.use(express.json());

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

app.get("/showfilledtable", async (req, res) => {
  const filledtable = await prisma.fill.findMany();
  console.log(filledtable);
  return res.json({
    msg: filledtable,
  });
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
  let finalPrice = null;

  if (type === "LIMIT") {
    if (!price) {
      return res.json({
        msg: " The LIMIT order must include a PRICE",
      });
    }
    finalPrice = price;
  } else if (type === "MARKET") {
    finalPrice = null;
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
  // 3. Persist the new order record in the database.\
  const newOrder = {
    userId: userId,
    side: side,
    type: type,
    stockid: stockid,
    price: finalPrice,
    quantity: quantity,
    status: status,
    filledquantity: filledquantity,
  };
  const createdOrder = await prisma.order.create({
    data: newOrder,
  });
  const redispush = await redisClient.rPush(
    "ORDER_QUEUE",
    JSON.stringify(createdOrder),
  );
  console.log(redispush);

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
  const stockAsks = ORDERBOOK[stockid]["ASKS"];
  if (Object.keys(stockAsks).length == 0) {
    return res.json({
      msg: "There is no ASKS for this " + ticker?.title,
    });
  }
  const stockBids = ORDERBOOK[stockid]["BIDS"];
  if (Object.keys(stockBids).length == 0) {
    return res.json({
      msg: "There is no BIDS available for the " + ticker?.title,
    });
  }

  if (otype === "BIDS" && mtype === "MARKET") {
    const sortedPrices = Object.keys(stockAsks)
      .map(Number)
      .sort((a, b) => a - b);
    let remainingquantity = quantity; // quantity that the user wants to BUY
    let filledQuantity = 0;
    for (const currentPrice of sortedPrices) {
      if (remainingquantity === 0) break;

      const currentpricelevel = stockAsks[currentPrice];
      if (!currentpricelevel) continue;

      // 3. Process individual orders at this specific price level
      while (remainingquantity > 0 && currentpricelevel.orders.length > 0) {
        let currentorder = currentpricelevel.orders[0];
        let availableOrderQuantity =
          currentorder!.quantity - currentorder!.filledQuantity;

        if (remainingquantity >= availableOrderQuantity) {
          // --- FULL ORDER FILL ---
          remainingquantity -= availableOrderQuantity;
          filledQuantity += availableOrderQuantity;
          currentpricelevel.totalQuantity -= availableOrderQuantity;

          const filledOrder = await prisma.fill.create({
            data: {
              stockid,
              price: currentPrice, // Safely locked to the current loop's price
              buyorderid: userId, // MAKE SURE you generate/pass an OrderId here!
              sellorderid: currentorder!.orderId, // FIXED: Now using orderId instead of userId
              quantity: availableOrderQuantity,
            },
          });
          console.log(filledOrder);
          currentpricelevel.orders.shift();
        } else {
          // --- PARTIAL ORDER FILL ---
          currentorder!.filledQuantity += remainingquantity;
          currentpricelevel.totalQuantity -= remainingquantity;
          filledQuantity += remainingquantity;

          const filledOrder = await prisma.fill.create({
            data: {
              stockid,
              price: currentPrice,
              buyorderid: userId,
              sellorderid: currentorder!.orderId,
              quantity: remainingquantity,
            },
          });
          console.log(filledOrder);

          remainingquantity = 0;
        }
      }
      if (currentpricelevel.orders.length === 0) {
        delete stockAsks[currentPrice];
      }
    }
    return res.json({
      msg: "Order has been created",
      filledQuantity: filledQuantity,
    });
  }

  if (otype === "ASKS" && mtype === "MARKET") {
    const StockBids = ORDERBOOK[stockid]["BIDS"];
    const sortedPrices = Object.keys(StockBids)
      .map(Number)
      .sort((a, b) => b - a);
    let remainingquantity = quantity;
    let filledQuantity = 0;
    for (const currentPrice of sortedPrices) {
      if (remainingquantity === 0) break;
      const currentpricelevel = StockBids[currentPrice];
      if (!currentpricelevel) continue;

      while (remainingquantity > 0 && currentpricelevel.orders.length > 0) {
        const currentOrder = currentpricelevel.orders[0];
        const currentavailableOrderQuantity =
          currentOrder!.quantity - currentOrder!.filledQuantity;

        if (remainingquantity >= currentavailableOrderQuantity) {
          remainingquantity -= currentavailableOrderQuantity;
          filledQuantity += currentavailableOrderQuantity;
          currentpricelevel.totalQuantity -= currentavailableOrderQuantity;

          const filledOrder = await prisma.fill.create({
            data: {
              stockid,
              price: currentPrice,
              buyorderid: currentOrder!.orderId,
              sellorderid: userId,
              quantity: currentavailableOrderQuantity,
            },
          });
          console.log(filledOrder);

          currentpricelevel.orders.shift();
        } else {
          currentOrder!.filledQuantity += remainingquantity;
          currentpricelevel.totalQuantity -= remainingquantity;
          filledQuantity += remainingquantity;
          const filledOrder = await prisma.fill.create({
            data: {
              stockid,
              price: currentPrice,
              buyorderid: currentOrder!.orderId,
              sellorderid: userId,
              quantity: remainingquantity,
            },
          });
          console.log(filledOrder);
          remainingquantity = 0;
        }
      }
      if (currentpricelevel.orders.length === 0) {
        delete StockBids[currentPrice];
      }
    }

    return res.json({
      msg: "Order has been created",
      filledQuantity: filledQuantity,
    });
  }

  if (otype === "BIDS" && mtype === "LIMIT") {
    const stockAsks = ORDERBOOK[stockid]["ASKS"] || {};
    let remainingquantity = quantity;

    let askPrices = Object.keys(stockAsks)
      .map(Number)
      .sort((a, b) => a - b);
    let filledQuantity = 0;
    for (const askPrice of askPrices) {
      if (remainingquantity <= 0) break;
      if (askPrice > finalPrice) break;
      const currentPriceLevel = stockAsks[askPrice]!;
      while (remainingquantity > 0 && currentPriceLevel.orders.length > 0) {
        const currentOrder = currentPriceLevel.orders[0];
        const currentAvailableQuantity =
          currentOrder!.quantity - currentOrder!.filledQuantity;

        if (remainingquantity >= currentAvailableQuantity) {
          remainingquantity -= currentAvailableQuantity;
          currentPriceLevel.totalQuantity -= currentAvailableQuantity;
          filledQuantity += currentAvailableQuantity;

          const filledOrder = await prisma.fill.create({
            data: {
              stockid,
              price: askPrice,
              buyorderid: createdOrder.id,
              sellorderid: currentOrder!.orderId,
              quantity: currentAvailableQuantity,
            },
          });
          console.log(filledOrder);

          currentPriceLevel.orders.shift();
        } else {
          currentOrder!.filledQuantity += remainingquantity;
          currentPriceLevel.totalQuantity -= remainingquantity;
          filledQuantity += remainingquantity;

          const filledOrder = await prisma.fill.create({
            data: {
              stockid,
              price: askPrice,
              buyorderid: createdOrder.id,
              sellorderid: currentOrder!.orderId,
              quantity: remainingquantity,
            },
          });
          console.log(filledOrder);

          remainingquantity = 0;
        }
      }

      if (currentPriceLevel.orders.length === 0) {
        delete ORDERBOOK[stockid]["ASKS"][askPrice];
      }
    }

    if (remainingquantity > 0) {
      const newOrder = {
        userId: userId,
        quantity: remainingquantity,
        filledQuantity: 0,
        orderId: createdOrder.id,
        createdAt: new Date().toISOString(),
      };

      if (ORDERBOOK[stockid]["BIDS"][finalPrice]) {
        ORDERBOOK[stockid]["BIDS"][finalPrice]!.totalQuantity +=
          newOrder.quantity;
        ORDERBOOK[stockid]["BIDS"][finalPrice]!.orders.push(newOrder);
      } else {
        ORDERBOOK[stockid]["BIDS"][finalPrice] = {
          totalQuantity: newOrder.quantity,
          orders: [newOrder],
        };
      }
    }

    return res.json({
      msg: "Order has been created",
      filledQuantity: filledQuantity,
    });
  }
  if (otype === "ASKS" && mtype === "LIMIT") {
    const stockBids = ORDERBOOK[stockid]["BIDS"] || {};
    let remainingquantity = quantity;

    let bidPrices = Object.keys(stockBids)
      .map(Number)
      .sort((a, b) => b - a);
    let filledQuantity = 0;

    for (const bidPrice of bidPrices) {
      if (remainingquantity <= 0) break;
      if (bidPrice < finalPrice) break;

      const currentPriceLevel = stockBids[bidPrice]!;

      while (remainingquantity > 0 && currentPriceLevel.orders.length > 0) {
        const currentOrder = currentPriceLevel.orders[0];
        const currentAvailableQuantity =
          currentOrder!.quantity - currentOrder!.filledQuantity;

        if (remainingquantity >= currentAvailableQuantity) {
          remainingquantity -= currentAvailableQuantity;
          currentPriceLevel.totalQuantity -= currentAvailableQuantity;
          filledQuantity += currentAvailableQuantity;

          const filledOrder = await prisma.fill.create({
            data: {
              stockid,
              price: bidPrice,
              buyorderid: currentOrder!.orderId,
              sellorderid: createdOrder.id,
              quantity: currentAvailableQuantity,
            },
          });
          console.log(filledOrder);

          currentPriceLevel.orders.shift();
        } else {
          currentOrder!.filledQuantity += remainingquantity;
          currentPriceLevel.totalQuantity -= remainingquantity;
          filledQuantity += remainingquantity;

          const filledOrder = await prisma.fill.create({
            data: {
              stockid,
              price: bidPrice,
              buyorderid: currentOrder!.orderId,
              sellorderid: createdOrder.id,
              quantity: remainingquantity,
            },
          });
          console.log(filledOrder);

          remainingquantity = 0;
        }
      }

      if (currentPriceLevel.orders.length === 0) {
        delete ORDERBOOK[stockid]["BIDS"][bidPrice];
      }
    }

    if (remainingquantity > 0) {
      const newOrder = {
        userId: userId,
        quantity: remainingquantity,
        filledQuantity: 0,
        orderId: createdOrder.id,
        createdAt: new Date().toISOString(),
      };

      if (ORDERBOOK[stockid]["ASKS"][finalPrice]) {
        ORDERBOOK[stockid]["ASKS"][finalPrice]!.totalQuantity +=
          newOrder.quantity;
        ORDERBOOK[stockid]["ASKS"][finalPrice]!.orders.push(newOrder);
      } else {
        ORDERBOOK[stockid]["ASKS"][finalPrice] = {
          totalQuantity: newOrder.quantity,
          orders: [newOrder],
        };
      }
    }

    return res.json({
      msg: "Order has been created",
      filledQuantity: filledQuantity,
    });
  }

  // 6. Update the in-memory Order Book with the new order.

  // before the update we have to fill the order

  //upddate the in memory ORDERBOOK

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
