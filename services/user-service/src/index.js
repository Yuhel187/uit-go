import express from "express";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

// Simple route để test
app.get("/", (req, res) => {
  res.json({ message: "UserService is running 🚀" });
});

app.listen(port, () => {
  console.log(`✅ UserService listening on port ${port}`);
});
