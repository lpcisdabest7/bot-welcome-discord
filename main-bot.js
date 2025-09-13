const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const { OpenAI } = require("openai");
require("dotenv").config();
const axios = require("axios");
const ExcelJS = require("exceljs");
const readline = require("readline");
const fs = require("fs");
const { gunzipSync } = require("zlib");
const { appendToSheet } = require("./sheets");
const { handleWeatherCommand } = require("./weather");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.MessageContent, // Required for reading message content
  ],
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const config = {
  welcomeChannelIds: process.env.CHANNEL_ID
    ? process.env.CHANNEL_ID.split(",").map((id) => id.trim())
    : [],
  datcomChannelId: process.env.DATCOM,
  serverRules: [
    "1. Tôn trọng mọi thành viên",
    "2. Không spam và quảng cáo",
    "3. Tuân thủ quy tắc của Discord",
    "4. Giữ gìn môi trường lành mạnh",
  ],
};

const activePolls = new Map();
const activeGames = new Map();

// Sự kiện khi bot sẵn sàng
client.on("ready", () => {
  console.log(`Main bot ${client.user.tag} is ready!`);
  console.log(`Main bot intents:`, client.options.intents);
  client.user.setActivity("Chào mừng thành viên mới", { type: "WATCHING" });
});

// Hàm tạo embed welcome message
function createWelcomeEmbed(member) {
  return new EmbedBuilder()
    .setColor("#00ff00")
    .setTitle(`🎉 Chào mừng thành viên mới!`)
    .setDescription(`Chào mừng ${member} đã tham gia server của chúng tôi!`)
    .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
    .addFields({
      name: "📜 Luật Server",
      value: config.serverRules.join("\n"),
    })
    .setFooter({
      text: `ID: ${member.id}`,
      iconURL: member.guild.iconURL(),
    })
    .setTimestamp();
}

async function generateTriviaQuestion() {
  const response = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [
      {
        role: "system",
        content: `
              Bạn là một bot chuyên tạo câu hỏi quiz về bóng đá chuyên nghiệp, với kiến thức phong phú về lịch sử bóng đá, cầu thủ, câu lạc bộ, huấn luyện viên và các khía cạnh khác nhau trong môn thể thao này. Hãy tạo câu hỏi theo định dạng sau:
              [Câu hỏi]
              A. [Đáp án A]
              B. [Đáp án B]
              C. [Đáp án C]
              D. [Đáp án D]
              ---
              Đáp án đúng: [A/B/C/D]
              Giải thích: [Giải thích chi tiết về đáp án đúng]

              Đảm bảo rằng các câu hỏi bao gồm các chủ đề đa dạng và không chỉ tập trung vào đội tuyển quốc gia, ví dụ:
              - **Cầu thủ huyền thoại**: thành tích cá nhân, những khoảnh khắc đáng nhớ, kỷ lục đặc biệt và sự nghiệp tại câu lạc bộ và đội tuyển.
              - **Câu lạc bộ nổi tiếng**: lịch sử, thành tích đáng chú ý, sự kiện đặc biệt, các kỷ lục của CLB trong nước và quốc tế.
              - **Huấn luyện viên nổi bật**: các chiến thuật độc đáo, thành tích huấn luyện nổi bật, ảnh hưởng của họ trong bóng đá hiện đại.
              - **Các trận đấu kinh điển**: thông tin về trận đấu kinh điển giữa các câu lạc bộ và đội tuyển, kịch bản hấp dẫn hoặc kết quả bất ngờ.
              - **Những sự kiện và câu chuyện ít được biết đến** trong bóng đá quốc tế và câu lạc bộ, như các cầu thủ chưa nổi tiếng hoặc các sự kiện lịch sử quan trọng nhưng ít người biết đến.

              Câu hỏi cần có độ khó vừa phải để thách thức các chuyên gia bóng đá, đảm bảo thông tin chính xác và đáng tin cậy.
            `,
      },
      {
        role: "user",
        content: `
              Bạn là một chuyên gia về lịch sử bóng đá toàn diện, có hiểu biết sâu sắc về cầu thủ, câu lạc bộ, huấn luyện viên và các sự kiện đáng nhớ. Khi tạo câu hỏi, đảm bảo rằng các chủ đề phong phú và đa dạng, bao gồm thông tin từ cấp độ câu lạc bộ đến đội tuyển, từ những chiến thuật đặc biệt của các huấn luyện viên đến những thành tích cá nhân nổi bật của cầu thủ. Tránh tập trung quá nhiều vào đội tuyển quốc gia và mở rộng sang các khía cạnh thú vị khác trong bóng đá.
            `,
      },
    ],
    temperature: 1.0,
  });

  const content = response.choices[0].message.content;
  const [question, answerSection] = content.split("---");
  const answerLines = answerSection.trim().split("\n");
  const correctAnswer = answerLines[0].split(": ")[1].charAt(0);
  const explanation = answerLines[1].split(": ")[1];

  return {
    question: question.trim(),
    correctAnswer: correctAnswer,
    explanation: explanation,
  };
}

// Sự kiện khi nhận tin nhắn
client.on("messageCreate", async (message) => {
  console.log(
    `[MAIN BOT] Received message: "${message.content}" from ${
      message.author.username
    } in ${message.guild ? message.guild.name : "DM"}`
  );

  if (message.author.bot) {
    console.log(
      `[MAIN BOT] Ignoring bot message from ${message.author.username}`
    );
    return;
  }

  console.log(
    `[MAIN BOT] Message mentions bot: ${message.mentions.has(client.user)}`
  );
  console.log(`[MAIN BOT] Message is in guild: ${!!message.guild}`);
  console.log(
    `[MAIN BOT] Message starts with !tt: ${message.content.startsWith("!tt")}`
  );

  // Handle specific commands that don't require mentioning the bot
  const isWeatherCommand = message.content.startsWith("!tt");
  const isQuizCommand = message.content.startsWith("!quiz");
  const isTestCommand = message.content === "/test";
  const isFoodCommand = message.content.includes("eat:");
  const isListAllCommand = message.content.toLowerCase() === "listall";
  const isNumberMessage = /^[\d\s]+$/.test(message.content.trim());

  // Allow these commands without mentioning the bot
  const allowedCommands =
    isWeatherCommand ||
    isQuizCommand ||
    isTestCommand ||
    isFoodCommand ||
    isListAllCommand ||
    isNumberMessage;

  // For other messages, require mentioning the bot or being in DM
  if (!allowedCommands && !message.mentions.has(client.user) && message.guild) {
    console.log(
      `[MAIN BOT] Ignoring message - doesn't mention bot and not an allowed command`
    );
    return;
  }

  console.log(`[MAIN BOT] Processing message: "${message.content}"`);

  if (message.content.startsWith("!quiz")) {
    const args = message.content.split(" ");
    const delay = args[1] ? parseInt(args[1]) * 1000 : 10000;

    try {
      const loadingMsg = await message.channel.send(
        "🤔 Đang tạo câu hỏi quiz..."
      );

      const quiz = await generateTriviaQuestion();

      await loadingMsg.delete();

      activeGames.set(message.channelId, {
        correctAnswer: quiz.correctAnswer,
        explanation: quiz.explanation,
        answers: new Map(),
        endTime: Date.now() + delay,
      });

      await message.channel.send(
        quiz.question +
          "\n\n💡 Trả lời bằng cách gõ A, B, C hoặc D\n⏰ Thời gian: " +
          delay / 1000 +
          " giây"
      );

      setTimeout(async () => {
        const game = activeGames.get(message.channelId);
        if (!game) return;

        let summary = "🎯 Kết quả:\n\n";
        summary += `Đáp án đúng: ${game.correctAnswer}\n`;
        summary += `📝 Giải thích: ${game.explanation}\n\n`;

        if (game.answers.size === 0) {
          summary += "Không có ai trả lời 😅";
        } else {
          const correctUsers = [];
          const wrongUsers = [];

          game.answers.forEach((answer, userId) => {
            const user = message.guild.members.cache.get(userId);
            const username = user ? user.displayName : "Unknown User";

            if (answer === game.correctAnswer) {
              correctUsers.push(`${username} (${answer})`);
            } else {
              wrongUsers.push(`${username} (${answer})`);
            }
          });

          summary += `✅ Trả lời đúng (${correctUsers.length}):\n${
            correctUsers.length > 0 ? correctUsers.join("\n") : "Không có"
          }\n\n`;
          summary += `❌ Trả lời sai (${wrongUsers.length}):\n${
            wrongUsers.length > 0 ? wrongUsers.join("\n") : "Không có"
          }`;
        }

        await message.channel.send(summary);
        activeGames.delete(message.channelId);
      }, delay);
    } catch (error) {
      console.error("Lỗi:", error);
      await message.channel.send("❌ Đã có lỗi xảy ra khi tạo câu hỏi quiz!");
    }
  } else if (activeGames.has(message.channelId)) {
    const game = activeGames.get(message.channelId);
    const answer = message.content.trim().toUpperCase();

    if (["A", "B", "C", "D"].includes(answer)) {
      if (!game.answers.has(message.author.id) && Date.now() < game.endTime) {
        game.answers.set(message.author.id, answer);
        await message.react("👍");
      }
    }
  }

  // Handle test command
  if (message.content === "/test") {
    console.log("Test command received from:", message.author.username);
    await message.reply("✅ Bot đang hoạt động bình thường!");
    return;
  }

  // Handle food ordering commands
  if (message.content.includes("eat:")) {
    // Check if the message is from the correct channel
    if (
      !config.datcomChannelId ||
      message.channelId !== config.datcomChannelId
    ) {
      console.log(
        `Food order command ignored - Expected channel: ${config.datcomChannelId}, Actual channel: ${message.channelId}`
      );
      return; // Silently ignore if not in the correct channel
    }

    const timeEatMatch = message.content.match(/^time:(\d+),eat:([^,\s]+)$/);
    const eatOnlyMatch = message.content.match(/^eat:([^,\s]+)$/);

    let merchantId;
    let pollDurationMinutes = 60;

    if (timeEatMatch) {
      pollDurationMinutes = parseInt(timeEatMatch[1]);
      merchantId = timeEatMatch[2];
    } else if (eatOnlyMatch) {
      merchantId = eatOnlyMatch[1];
    } else {
      await message.reply(
        "❌ Format không đúng. Vui lòng sử dụng: `time:[phút],eat:[merchant-id]` hoặc `eat:[merchant-id]`"
      );
      return;
    }

    try {
      await message.reply("🔍 Đang tìm kiếm menu...");

      const menu = await fetchMenu(merchantId);
      const categories = menu.categories.filter((cat) => cat.items.length > 0);

      const today = new Date();
      const dateOptions = {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      };
      const vietnameseDate = today.toLocaleDateString("vi-VN", dateOptions);

      let menuNumber = 1;
      const menuItems = new Map();

      await message.channel.send(
        `**🍽️ Hôm nay ăn gì? - ${vietnameseDate}**\nThời gian còn lại: ${pollDurationMinutes} phút\n`
      );

      let currentSection = "";
      let currentItems = [];

      async function sendItemChunk(sectionName, items) {
        if (items.length === 0) return;

        let chunkText = sectionName ? `**${sectionName}**\n\n` : "";
        for (const item of items) {
          chunkText += item;
        }
        await message.channel.send(chunkText);
      }

      for (const category of categories) {
        if (currentItems.length > 0 && category.name.includes("**")) {
          await sendItemChunk(currentSection, currentItems);
          currentItems = [];
        }

        if (category.name.includes("**")) {
          currentSection = category.name;
        }

        for (const item of category.items) {
          const price = item.priceInMinorUnit
            ? `${item.priceInMinorUnit.toLocaleString()} VNĐ`
            : "N/A";
          const itemText = `\`${menuNumber}\` ${item.name} - ${price}\n`;

          menuItems.set(menuNumber, {
            name: item.name,
            price: price,
            category: category.name,
          });
          menuNumber++;

          currentItems.push(itemText);

          if (currentItems.length >= 10) {
            await sendItemChunk(currentSection, currentItems);
            currentItems = [];
            currentSection = "";
          }
        }
      }

      if (currentItems.length > 0) {
        await sendItemChunk(currentSection, currentItems);
      }

      const instructionsText =
        "**Cách đặt món:**\n" +
        "• Gõ số món ăn bạn muốn chọn (VD: `1` hoặc `1 2 3`)\n" +
        "• Có thể chọn nhiều món cùng lúc\n" +
        `• Khảo sát sẽ kết thúc sau ${pollDurationMinutes} phút\n`;

      const pollMessage = await message.channel.send(instructionsText);

      activePolls.set(pollMessage.id, {
        items: menuItems,
        selections: new Map(),
        endTime: Date.now() + pollDurationMinutes * 60000,
        userMessages: new Map(),
      });

      setTimeout(async () => {
        const poll = activePolls.get(pollMessage.id);
        if (!poll) return;

        await message.channel.send(
          `**🔔 Khảo sát đã kết thúc sau ${pollDurationMinutes} phút!**`
        );

        // Get order summary
        const summary = await showListAll(message, true);

        // Extract data for sheets
        if (summary && summary.totalItems > 0) {
          for (const [userId, selections] of poll.selections.entries()) {
            try {
              const user = await message.guild.members.fetch(userId);
              const userName = user.nickname || user.user.username;

              for (const [itemNumber, quantity] of selections.entries()) {
                const item = poll.items.get(itemNumber);
                const orderData = {
                  name: userName,
                  price: item.price,
                  quantity: quantity,
                  itemName: item.name,
                  status: "Đã đặt",
                  date: new Date().toLocaleDateString("vi-VN"),
                };

                await appendToSheet(orderData);
              }
            } catch (error) {
              console.error("Error updating sheets:", error);
            }
          }
        }

        activePolls.delete(pollMessage.id);
      }, pollDurationMinutes * 60000);
    } catch (error) {
      await message.reply(
        "❌ Không thể lấy được menu. Vui lòng kiểm tra lại ID merchant!"
      );
    }
  }

  // Handle listAll command
  if (message.content.toLowerCase() === "listall") {
    if (message.channelId !== process.env.DATCOM) {
      return; // Không phản hồi nếu sai channel
    }
    await showListAll(message, false);
    return;
  }

  // Handle number-only messages for food selection
  const numberPattern = /^[\d\s]+$/;
  if (numberPattern.test(message.content.trim())) {
    if (message.channelId !== process.env.DATCOM) {
      return; // Không phản hồi nếu sai channel
    }
    const activePoll = Array.from(activePolls.entries()).find(
      ([_, poll]) => Date.now() < poll.endTime
    );

    if (!activePoll) {
      await message.reply("❌ Không có khảo sát nào đang diễn ra!");
      return;
    }

    const [pollId, poll] = activePoll;
    const numbers = message.content.trim().split(/\s+/).map(Number);
    const validSelections = numbers.filter(
      (n) => !isNaN(n) && poll.items.has(n)
    );

    if (validSelections.length > 0) {
      const userSelections =
        poll.selections.get(message.author.id) || new Map();
      validSelections.forEach((n) => {
        userSelections.set(n, (userSelections.get(n) || 0) + 1);
      });
      poll.selections.set(message.author.id, userSelections);

      try {
        const fetchedMessage = await message.fetch();
        await fetchedMessage.react("👍");
      } catch (error) {
        // Ignore reaction errors
      }

      const selectedItems = validSelections
        .map((n) => `• ${poll.items.get(n).name} - ${poll.items.get(n).price}`)
        .join("\n");

      const replyMsg = await message.reply({
        content: `✅ Đã ghi nhận lựa chọn của bạn:\n${selectedItems}`,
        allowedMentions: { repliedUser: false },
      });

      if (!poll.userMessages) poll.userMessages = new Map();
      if (!poll.userMessages.get(message.author.id)) {
        poll.userMessages.set(message.author.id, new Map());
      }
      poll.userMessages.get(message.author.id).set(message.id, {
        selections: validSelections,
        replyId: replyMsg.id,
      });

      const filter = (m) => m.id === message.id;
      const collector = message.channel.createMessageCollector({
        filter,
        time: 3600000,
      });

      collector.on("end", async (collected, reason) => {
        if (reason === "messageDelete") {
          try {
            const replyMessage = await message.channel.messages.fetch(
              replyMsg.id
            );
            await replyMessage.delete();
          } catch (error) {
            // Ignore deletion errors
          }

          if (userSelections) {
            validSelections.forEach((num) => {
              const currentCount = userSelections.get(num);
              if (currentCount === 1) {
                userSelections.delete(num);
              } else {
                userSelections.set(num, currentCount - 1);
              }
            });
            if (userSelections.size === 0) {
              poll.selections.delete(message.author.id);
            }
          }

          if (poll.userMessages?.get(message.author.id)) {
            poll.userMessages.get(message.author.id).delete(message.id);
          }
        }
      });
    }
    return;
  }

  // Handle weather command
  if (message.content.startsWith("!tt")) {
    console.log(`[MAIN BOT] Weather command received: "${message.content}"`);
    const args = message.content.split(" ");
    const location = args.slice(1).join(" ");
    console.log(`[MAIN BOT] Extracted location: "${location}"`);
    try {
      await handleWeatherCommand(message, location);
    } catch (error) {
      console.error(`[MAIN BOT] Error in weather command handler:`, error);
      console.error(`[MAIN BOT] Error stack:`, error.stack);
    }
  }
});

// Add message deletion handler
client.on("messageDelete", async (message) => {
  if (message.author.bot) return;

  const activePoll = Array.from(activePolls.entries()).find(
    ([_, poll]) => Date.now() < poll.endTime
  );

  if (!activePoll) return;
  const [pollId, poll] = activePoll;

  if (poll.userMessages?.get(message.author.id)?.has(message.id)) {
    const messageData = poll.userMessages
      .get(message.author.id)
      .get(message.id);

    const userSelections = poll.selections.get(message.author.id);
    if (userSelections) {
      messageData.selections.forEach((num) => userSelections.delete(num));

      if (userSelections.size === 0) {
        poll.selections.delete(message.author.id);
      }
    }

    try {
      const channel = message.channel;
      const replyMessage = await channel.messages.fetch(messageData.replyId);
      await replyMessage.delete();
    } catch (error) {
      console.error("Failed to delete reply message:", error);
    }

    poll.userMessages.get(message.author.id).delete(message.id);
  }
});

// Handle errors
client.on("error", (error) => {
  console.error("Main bot error:", error);
});

// Add functions from node.js
async function fetchMenu(merchantId) {
  const url = `https://portal.grab.com/foodweb/v2/merchants/${merchantId}`;
  const res = await axios.get(url);
  return res.data.merchant.menu;
}

// Add missing showListAll function
async function showListAll(message, isEnding = false) {
  let summary = "📋 Danh sách đặt món:\n\n";
  let totalUsers = 0;
  let totalItems = 0;
  let totalPrice = 0;
  const itemCounts = new Map();
  const userOrders = new Map();

  for (const [messageId, poll] of activePolls) {
    for (const [userId, selections] of poll.selections.entries()) {
      totalUsers++;
      const user = await message.guild.members.fetch(userId);
      const userName = user.nickname || user.user.username;

      summary += `${userName} đã chọn:\n`;
      let userTotal = 0;

      for (const [itemNumber, quantity] of selections.entries()) {
        totalItems += quantity;
        const item = poll.items.get(itemNumber);

        // Update item counts
        const currentCount = itemCounts.get(item.name) || 0;
        itemCounts.set(item.name, currentCount + quantity);

        const itemPrice = parseInt(item.price.replace(/[^\d]/g, ""));
        const itemTotal = itemPrice * quantity;
        userTotal += itemTotal;
        totalPrice += itemTotal;

        summary += `• ${item.name} - ${item.price}\n`;
      }

      userOrders.set(userName, userTotal);
      summary += "\n";
    }
  }

  summary += `\nTổng cộng:\n• ${totalUsers} người đã chọn\n• ${totalItems} suất được đặt\n\n`;

  if (itemCounts.size > 0) {
    summary += "Chi tiết theo món:\n";
    for (const [itemName, count] of itemCounts) {
      summary += `• ${itemName}: ${count} suất\n`;
    }
  }

  summary += `\nTổng tiền: ${totalPrice.toLocaleString("vi-VN")} VNĐ\n\n`;

  if (userOrders.size > 0) {
    summary += "Chi tiết chia tiền:\n";
    for (const [userName, total] of userOrders) {
      summary += `• ${userName}: ${total.toLocaleString("vi-VN")} VNĐ\n`;
    }
  }

  try {
    await message.channel.send(summary);
  } catch (error) {
    if (error.code === 50035) {
      const chunks = summary.match(/.{1,1900}/g) || [];
      for (const chunk of chunks) {
        await message.channel.send(chunk);
      }
    }
  }

  return {
    totalUsers,
    totalItems,
    totalPrice,
    items: Object.fromEntries(itemCounts),
    userOrders: Object.fromEntries(userOrders),
  };
}

// Export functions for external use
module.exports = {
  fetchMenu,
  showListAll,
};

// Login the main bot
console.log("Attempting to login main bot...");
console.log("DISCORD_TOKEN exists:", !!process.env.DISCORD_TOKEN);
console.log(
  "DISCORD_TOKEN length:",
  process.env.DISCORD_TOKEN ? process.env.DISCORD_TOKEN.length : 0
);
client.login(process.env.DISCORD_TOKEN).catch((error) => {
  console.error("Failed to login main bot:", error);
});
