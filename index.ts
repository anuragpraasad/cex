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

const BALANCES = {};

const ORDERBOOKS = {
  SOL: {},
  BTC: {},
};

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

app.post("/order", (req, res) => {
  // TODO
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
