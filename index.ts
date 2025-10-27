import express, { Application, Request, Response } from "express";
import prisma from "./config/prisma";
import { identify } from "./controllers/identity.controllers";

const app: Application = express();

app.use(express.json());

(async () => {
  try {
    await prisma.$connect();
    console.log("✅ Database connection successfull");
  } catch (error) {
    console.error("❌ Database connection failed");
    console.error(error);
    process.exit(1);
  }
})();

app.get("/", (req: Request, res: Response) => {
  res.send(
    "<h1>Identity Reconciliation API</h1><p>POST to /identify with email and/or phoneNumber</p>"
  );
});

app.post("/identify", identify);

app.listen(3000, () => {
  console.log(`🚀 Server started at http://localhost:3000`);
});
