// require("dotenv").config();
// const { Client, GatewayIntentBits, EmbedBuilder } = require("discord.js");
// const { fetchMenu } = require("./node");

// const client = new Client({
//   intents: [
//     GatewayIntentBits.Guilds,
//     GatewayIntentBits.GuildMessages,
//     GatewayIntentBits.MessageContent,
//     GatewayIntentBits.GuildMessageReactions,
//   ],
// });

// // Store active polls
// const activePolls = new Map();

// client.once("ready", () => {
//   client.user.setActivity("Đặt món", { type: "WATCHING" });
// });

// client.on("messageCreate", async (message) => {
//   if (message.author.bot) return;

//   // Handle food ordering commands
//   if (message.content.includes("eat:")) {
//     const timeEatMatch = message.content.match(/^time:(\d+),eat:([^,\s]+)$/);
//     const eatOnlyMatch = message.content.match(/^eat:([^,\s]+)$/);

//     let merchantId;
//     let pollDurationMinutes = 30;

//     if (timeEatMatch) {
//       pollDurationMinutes = parseInt(timeEatMatch[1]);
//       merchantId = timeEatMatch[2];
//     } else if (eatOnlyMatch) {
//       merchantId = eatOnlyMatch[1];
//     } else {
//       await message.reply(
//         "❌ Format không đúng. Vui lòng sử dụng: `time:[phút],eat:[merchant-id]` hoặc `eat:[merchant-id]`"
//       );
//       return;
//     }

//     try {
//       await message.reply("🔍 Đang tìm kiếm menu...");

//       const menu = await fetchMenu(merchantId);
//       const categories = menu.categories.filter((cat) => cat.items.length > 0);

//       const today = new Date();
//       const dateOptions = {
//         weekday: "long",
//         year: "numeric",
//         month: "long",
//         day: "numeric",
//       };
//       const vietnameseDate = today.toLocaleDateString("vi-VN", dateOptions);

//       let menuNumber = 1;
//       const menuItems = new Map();

//       await message.channel.send(
//         `**🍽️ Hôm nay ăn gì? - ${vietnameseDate}**\nThời gian còn lại: ${pollDurationMinutes} phút\n`
//       );

//       let currentSection = "";
//       let currentItems = [];

//       async function sendItemChunk(sectionName, items) {
//         if (items.length === 0) return;

//         let chunkText = sectionName ? `**${sectionName}**\n\n` : "";
//         for (const item of items) {
//           chunkText += item;
//         }
//         await message.channel.send(chunkText);
//       }

//       for (const category of categories) {
//         if (currentItems.length > 0 && category.name.includes("**")) {
//           await sendItemChunk(currentSection, currentItems);
//           currentItems = [];
//         }

//         if (category.name.includes("**")) {
//           currentSection = category.name;
//         }

//         for (const item of category.items) {
//           const price = item.priceInMinorUnit
//             ? `${item.priceInMinorUnit.toLocaleString()} VNĐ`
//             : "N/A";
//           const itemText = `\`${menuNumber}\` ${item.name} - ${price}\n`;

//           menuItems.set(menuNumber, {
//             name: item.name,
//             price: price,
//             category: category.name,
//           });
//           menuNumber++;

//           currentItems.push(itemText);

//           if (currentItems.length >= 10) {
//             await sendItemChunk(currentSection, currentItems);
//             currentItems = [];
//             currentSection = "";
//           }
//         }
//       }

//       if (currentItems.length > 0) {
//         await sendItemChunk(currentSection, currentItems);
//       }

//       const instructionsText =
//         "**Cách đặt món:**\n" +
//         "• Gõ số món ăn bạn muốn chọn (VD: `1` hoặc `1 2 3`)\n" +
//         "• Có thể chọn nhiều món cùng lúc\n" +
//         `• Khảo sát sẽ kết thúc sau ${pollDurationMinutes} phút\n`;

//       const pollMessage = await message.channel.send(instructionsText);

//       activePolls.set(pollMessage.id, {
//         items: menuItems,
//         selections: new Map(),
//         endTime: Date.now() + pollDurationMinutes * 60000,
//         userMessages: new Map(),
//       });

//       setTimeout(async () => {
//         const poll = activePolls.get(pollMessage.id);
//         if (!poll) return;

//         await message.channel.send(
//           `**🔔 Khảo sát đã kết thúc sau ${pollDurationMinutes} phút!**`
//         );

//         await showListAll(message, true);

//         activePolls.delete(pollMessage.id);
//       }, pollDurationMinutes * 60000);
//     } catch (error) {
//       await message.reply(
//         "❌ Không thể lấy được menu. Vui lòng kiểm tra lại ID merchant!"
//       );
//     }
//   }

//   // Handle listAll command
//   if (message.content.toLowerCase() === "listall") {
//     await showListAll(message, false);
//     return;
//   }

//   // Handle number-only messages for food selection
//   const numberPattern = /^[\d\s]+$/;
//   if (numberPattern.test(message.content.trim())) {
//     const activePoll = Array.from(activePolls.entries()).find(
//       ([_, poll]) => Date.now() < poll.endTime
//     );

//     if (!activePoll) {
//       await message.reply("❌ Không có khảo sát nào đang diễn ra!");
//       return;
//     }

//     const [pollId, poll] = activePoll;
//     const numbers = message.content.trim().split(/\s+/).map(Number);
//     const validSelections = numbers.filter(
//       (n) => !isNaN(n) && poll.items.has(n)
//     );

//     if (validSelections.length > 0) {
//       const userSelections =
//         poll.selections.get(message.author.id) || new Map();
//       validSelections.forEach((n) => {
//         userSelections.set(n, (userSelections.get(n) || 0) + 1);
//       });
//       poll.selections.set(message.author.id, userSelections);

//       try {
//         const fetchedMessage = await message.fetch();
//         await fetchedMessage.react("👍");
//       } catch (error) {
//         // Ignore reaction errors
//       }

//       const selectedItems = validSelections
//         .map((n) => `• ${poll.items.get(n).name} - ${poll.items.get(n).price}`)
//         .join("\n");

//       const replyMsg = await message.reply({
//         content: `✅ Đã ghi nhận lựa chọn của bạn:\n${selectedItems}`,
//         allowedMentions: { repliedUser: false },
//       });

//       if (!poll.userMessages) poll.userMessages = new Map();
//       if (!poll.userMessages.get(message.author.id)) {
//         poll.userMessages.set(message.author.id, new Map());
//       }
//       poll.userMessages.get(message.author.id).set(message.id, {
//         selections: validSelections,
//         replyId: replyMsg.id,
//       });

//       const filter = (m) => m.id === message.id;
//       const collector = message.channel.createMessageCollector({
//         filter,
//         time: 3600000,
//       });

//       collector.on("end", async (collected, reason) => {
//         if (reason === "messageDelete") {
//           try {
//             const replyMessage = await message.channel.messages.fetch(
//               replyMsg.id
//             );
//             await replyMessage.delete();
//           } catch (error) {
//             // Ignore deletion errors
//           }

//           if (userSelections) {
//             validSelections.forEach((num) => {
//               const currentCount = userSelections.get(num);
//               if (currentCount === 1) {
//                 userSelections.delete(num);
//               } else {
//                 userSelections.set(num, currentCount - 1);
//               }
//             });
//             if (userSelections.size === 0) {
//               poll.selections.delete(message.author.id);
//             }
//           }

//           if (poll.userMessages?.get(message.author.id)) {
//             poll.userMessages.get(message.author.id).delete(message.id);
//           }
//         }
//       });
//     }
//     return;
//   }
// });

// // Add message deletion handler
// client.on("messageDelete", async (message) => {
//   if (message.author.bot) return;

//   const activePoll = Array.from(activePolls.entries()).find(
//     ([_, poll]) => Date.now() < poll.endTime
//   );

//   if (!activePoll) return;
//   const [pollId, poll] = activePoll;

//   if (poll.userMessages?.get(message.author.id)?.has(message.id)) {
//     const messageData = poll.userMessages
//       .get(message.author.id)
//       .get(message.id);

//     const userSelections = poll.selections.get(message.author.id);
//     if (userSelections) {
//       messageData.selections.forEach((num) => userSelections.delete(num));

//       if (userSelections.size === 0) {
//         poll.selections.delete(message.author.id);
//       }
//     }

//     try {
//       const channel = message.channel;
//       const replyMessage = await channel.messages.fetch(messageData.replyId);
//       await replyMessage.delete();
//     } catch (error) {
//       // Ignore deletion errors
//     }

//     poll.userMessages.get(message.author.id).delete(message.id);
//   }
// });

// // Handle errors
// client.on("error", (error) => {
//   // Critical errors should still be logged
//   console.error("Discord client error:", error);
// });

// // Login the bot
// client.login(process.env.DISCORD_TOKEN).catch((error) => {
//   // Critical login errors should still be logged
//   console.error("Failed to login:", error);
// });
