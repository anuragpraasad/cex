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

interface UserBalance  {
  USD : {
    "total" : number
    "locked" : number,
  },
  Stocks : {
    [ticker : string] : number
  }
}

const BALANCES: Record<string,UserBalance> = {
  "1" : {
    USD : {
      total : 36000,
      locked : 100
    },
    Stocks : {
      SOL : 23
    }
  }
};

const ORDERBOOKS = {
  SOL: {
    BIDS: {},
    ASKS: {},
  },
};

app.get("/getorderbook", (req, res) => {
  return res.json({
    orderbook: ORDERBOOKS,
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
      return res.status(400).json({
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

app.post("/order", authMiddleware, async (req, res) => {
  const userId = req.userId;
  const side = req.body.side;
  const type = req.body.type;
  const stockid = req.body.stockid;
  const price = req.body.price;
  const quantity = req.body.quantity;
  const status = req.body.status;
  const filledquantity = req.body.filledquantity;

  if (!userId) {
    return res.status(400).json({ msg: "Unauthorised" });
  }

  // ------------------------------------------------------------------------------------
  // lock the balance
  // check that the User has Sufficient Balance or not
  const userBalance = BALANCES[userId.toString()]
  if (!userBalance){
    return res.json({
      msg : "Balance is not availble"
    })
  }
  const lockedBalance = price * quantity;
  if(userBalance.USD["total"] < lockedBalance){
    return res.json({
      "msg" : "You have insifficient Balance"
    })
  }
  userBalance.USD["locked"] -= lockedBalance;
  // -------------------------------------------------------------------------------------------

  // update the order db
  const createdOrder = await prisma.order.create({
    data: {
      userId: userId,
      side: side,
      type: type,
      stockid: stockid,
      price: price,
      quantity: quantity,
      status: status,
      filledquantity: filledquantity,
    },
  });

  // update the orderbook

  res.status(200).json({ msg: "order created" });
});

app.get("/order/:orderId", (req, res) => {
  // TODO
  res.status(200).json({ msg: "get order" });
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
