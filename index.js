require("dotenv").config();

// Import both bots
const mainBot = require("./main-bot");
const decodeBot = require("./decode-bot");

console.log("Starting both bots...");
console.log("Main bot: DISCORD_TOKEN");
console.log("Decode bot: DECODE_BOT_TOKEN");
