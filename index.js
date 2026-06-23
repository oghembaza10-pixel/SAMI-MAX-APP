const express = require("express");
const webhook = require("./webhook");

const app = express();

app.use(express.json());

app.use("/webhook", webhook);

app.get("/", (req, res) => {
  res.send("Samy Online");
});

app.listen(3000, () => {
  console.log("Samy démarré");
});
