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
const { appendToSheet } = require("./sheets");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
  ],
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});
const WEATHER_API_KEY = process.env.WEATHER_API_KEY;

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

// Sự kiện khi có thành viên mới tham gia
client.on("guildMemberAdd", async (member) => {
  try {
    const welcomeChannel = config.welcomeChannelIds
      .map((id) => member.guild.channels.cache.get(id))
      .find((channel) => channel);

    if (welcomeChannel) {
      const welcomeEmbed = createWelcomeEmbed(member);
      await welcomeChannel.send({
        content: `${member} vừa tham gia server! 🎉`,
        embeds: [welcomeEmbed],
      });
    }
  } catch (error) {
    console.error("Lỗi trong quá trình xử lý thành viên mới:", error);
  }
});

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
  if (message.author.bot) return;

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
    const args = message.content.split(" ");
    const location = args.slice(1).join(" ");

    if (!location) {
      message.reply("Hãy nhập vị trí! Ví dụ: `!weather Hà Đông`");
      return;
    }

    try {
      const { lat, lon, display_name } = await getCoordinates(location);
      const formattedName = formatDisplayName(display_name);

      const response = await axios.get(
        "https://api.openweathermap.org/data/2.5/weather",
        {
          params: {
            lat,
            lon,
            appid: WEATHER_API_KEY,
            lang: "vi",
          },
        }
      );

      const data = response.data;
      const temp = kelvinToCelsius(data.main.temp);
      const feelsLike = kelvinToCelsius(data.main.feels_like);
      const tempMin = kelvinToCelsius(data.main.temp_min);
      const tempMax = kelvinToCelsius(data.main.temp_max);
      const weather = data.weather[0].description;
      const weatherMain = data.weather[0].main;
      const humidity = data.main.humidity;
      const windSpeed = data.wind.speed.toFixed(1);
      const windDeg = data.wind.deg;
      const clouds = data.clouds.all;
      const pressure = data.main.pressure;

      const currentTime = new Date();
      const weatherEmoji = weatherEmojis[weatherMain] || "❓";
      const recommendation = getWeatherRecommendation(
        parseFloat(temp),
        humidity,
        parseFloat(windSpeed),
        weatherMain
      );

      const embed = new EmbedBuilder()
        .setColor(getTemperatureColor(parseFloat(temp)))
        .setTitle(`${weatherEmoji} Thời tiết tại ${formattedName}`)
        .setThumbnail(
          `https://openweathermap.org/img/wn/${data.weather[0].icon}@2x.png`
        ) // Hiển thị biểu tượng thời tiết
        // + 7 để chuẩn múi giờ việt nam

        .setDescription(
          `**Cập nhật lúc:** ${formatDateTime(currentTime) + 7} (GMT+7)`
        )

        .addFields(
          {
            name: "🌡️ Nhiệt độ",
            value:
              `> **Hiện tại:** ${temp}°C\n` +
              `> **Cảm giác như:** ${feelsLike}°C\n` +
              `> **Cao/Thấp:** ${tempMax}°C / ${tempMin}°C`,
            inline: true,
          },
          {
            name: "💧 Độ ẩm",
            value: `> **Độ ẩm:** ${humidity}%`,
            inline: true,
          },
          {
            name: "💨 Gió",
            value:
              `> **Tốc độ:** ${windSpeed} m/s\n` +
              `> **Hướng:** ${getWindDirection(windDeg)}`,
            inline: true,
          },
          {
            name: "☁️ Mây che phủ",
            value: `> **Mây:** ${clouds}%`,
            inline: true,
          },
          {
            name: "🌪️ Áp suất",
            value: `> **Áp suất:** ${pressure} hPa`,
            inline: true,
          },
          {
            name: "🌥️ Thời tiết",
            value: `> **Mô tả:** ${weather}`,
            inline: true,
          },
          {
            name: "📌 Khuyến nghị",
            value: `${recommendation}`,
            inline: false,
          }
        )

        .setFooter({
          text: `Dữ liệu cập nhật từ OpenWeather API`,
          iconURL:
            "https://openweathermap.org/themes/openweathermap/assets/vendor/owm/img/widgets/logo_60x60.png",
        })
        .setTimestamp();

      message.reply({ embeds: [embed] });
    } catch (error) {
      console.error("Error:", error);
      message.reply(
        "Không tìm thấy thông tin thời tiết cho vị trí bạn yêu cầu. Vui lòng kiểm tra lại."
      );
    }
  }
});

// Handle errors
client.on("error", (error) => {
  // Critical errors should still be logged
  console.error("Discord client error:", error);
});

//WEATHER

const kelvinToCelsius = (kelvin) => (kelvin - 273.15).toFixed(1);

const weatherEmojis = {
  Clear: "☀️",
  Clouds: "☁️",
  Rain: "🌧️",
  Drizzle: "🌦️",
  Thunderstorm: "⛈️",
  Snow: "🌨️",
  Mist: "🌫️",
  Smoke: "🌫️",
  Haze: "🌫️",
  Dust: "🌫️",
  Fog: "🌫️",
  Sand: "🌫️",
  Ash: "🌫️",
  Squall: "💨",
  Tornado: "🌪️",
};

const windDirections = {
  0: "Bắc",
  45: "Đông Bắc",
  90: "Đông",
  135: "Đông Nam",
  180: "Nam",
  225: "Tây Nam",
  270: "Tây",
  315: "Tây Bắc",
  360: "Bắc",
};

function getWindDirection(degrees) {
  const directions = Object.keys(windDirections).map(Number);
  const closest = directions.reduce((prev, curr) => {
    return Math.abs(curr - degrees) < Math.abs(prev - degrees) ? curr : prev;
  });
  return windDirections[closest];
}

function getWeatherRecommendation(temp, humidity, windSpeed, weatherMain) {
  if (weatherMain === "Rain" || weatherMain === "Thunderstorm") {
    return "🌂 Nên mang theo ô/áo mưa khi ra ngoài";
  } else if (temp > 35) {
    return "🌞 Nên tránh hoạt động ngoài trời, uống nhiều nước";
  } else if (temp < 15) {
    return "🧥 Nên mặc ấm khi ra ngoài";
  } else if (windSpeed > 10) {
    return "🌪️ Gió mạnh, cẩn thận khi di chuyển";
  } else if (temp >= 20 && temp <= 30 && humidity < 80) {
    return "✨ Thời tiết thuận lợi cho các hoạt động ngoài trời";
  }
  return "👌 Thời tiết bình thường, có thể sinh hoạt bình thường";
}

function getTemperatureColor(temp) {
  if (temp <= 0) return "#1E90FF"; // Rất lạnh - xanh dương
  if (temp <= 15) return "#87CEEB"; // Lạnh - xanh nhạt
  if (temp <= 25) return "#98FB98"; // Mát mẻ - xanh lá nhạt
  if (temp <= 30) return "#FFD700"; // Ấm áp - vàng
  if (temp <= 35) return "#FFA500"; // Nóng - cam
  return "#FF4500"; // Rất nóng - đỏ cam
}

async function getCoordinates(location) {
  try {
    const query = `${location}`;
    const response = await axios.get(
      "https://nominatim.openstreetmap.org/search",
      {
        headers: {
          "User-Agent": "MyDiscordWeatherBot/1.0 (contact: cuonglp@apero.vn)",
        },
        params: {
          q: query,
          format: "json",
          limit: 1,
        },
      }
    );

    if (response.data.length === 0) {
      throw new Error("Không tìm thấy vị trí.");
    }

    const { lat, lon, display_name } = response.data[0];
    return { lat, lon, display_name };
  } catch (error) {
    console.error("Nominatim API Error:", error.message || error);
    throw new Error("Không thể lấy thông tin từ Nominatim.");
  }
}

function formatDisplayName(displayName) {
  return displayName
    .replace("District", "Quận")
    .replace("Hanoi", "Hà Nội")
    .replace("Vietnam", "Việt Nam");
}

function formatDateTime(date) {
  const formatter = new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  return formatter.format(date);
}

// Add functions from node.js
async function fetchMenu(merchantId) {
  const url = `https://portal.grab.com/foodweb/v2/merchants/${merchantId}`;
  const res = await axios.get(url);
  return res.data.merchant.menu;
}

function sumItems(menu, idx) {
  let sum = 0;
  for (let i = 0; i < idx; i++) {
    sum += menu.categories[i].items.length;
  }
  return sum;
}

function generateColumnLetters() {
  const letters = [];
  const A = "A".charCodeAt(0);
  for (let i = 0; i < 26; i++) {
    letters.push(String.fromCharCode(A + i));
  }
  for (let i = 0; i < 26; i++) {
    for (let j = 0; j < 26; j++) {
      letters.push(String.fromCharCode(A + i) + String.fromCharCode(A + j));
    }
  }
  return letters;
}

const clc = generateColumnLetters();

const colors = [
  "FFFF00",
  "CCFF33",
  "66FF99",
  "00CCCC",
  "3366FF",
  "9933FF",
  "FF3399",
  "FF3366",
];

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

// Export functions for external use
module.exports = {
  fetchMenu,
};

// Login the bot
client.login(process.env.DISCORD_TOKEN).catch((error) => {
  // Critical login errors should still be logged
  console.error("Failed to login:", error);
});
