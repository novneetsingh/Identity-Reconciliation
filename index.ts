import express, { Application, Request, Response } from "express";
import prisma from "./config/prisma";

const app: Application = express();

app.use(express.json());

// test the connection to the database
(async () => {
  try {
    await prisma.$connect();
    console.log("Database connection successful");
  } catch (error) {
    console.log("Database connection failed");
    console.log(error);
    process.exit(1);
  }
})();

app.get("/", (req: Request, res: Response) => {
  res.send("<h1>Identity Reconciliation API</h1>");
});

app.listen(3000, () => {
  console.log("server started at http://localhost:3000");
});
