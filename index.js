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

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
  ],
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const config = {
  welcomeChannelIds: process.env.CHANNEL_ID
    ? process.env.CHANNEL_ID.split(",").map((id) => id.trim())
    : [],
  serverRules: [
    "1. Tôn trọng mọi thành viên",
    "2. Không spam và quảng cáo",
    "3. Tuân thủ quy tắc của Discord",
    "4. Giữ gìn môi trường lành mạnh",
  ],
};

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

  if (message.content.startsWith("!1")) {
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
});

// Xử lý lỗi không mong muốn
process.on("unhandledRejection", (error) => {
  console.error("Lỗi không xử lý được:", error);
});

const prefix = "!";

// Map các địa điểm đặc biệt với tọa độ
const specialLocations = {
  "ba vi": { lat: 21.0811, lon: 105.3665, name: "Ba Vì" },
  "tam dao": { lat: 21.4593, lon: 105.6469, name: "Tam Đảo" },
  sapa: { lat: 22.3364, lon: 103.8438, name: "Sa Pa" },
  // Thêm các địa điểm khác nếu cần
};

const weatherEmojis = {
  Clear: "☀️",
  Clouds: "☁️",
  Rain: "🌧️",
  Drizzle: "🌦️",
  Thunderstorm: "⛈️",
  Snow: "❄️",
  Mist: "🌫️",
  Fog: "🌫️",
  Haze: "🌫️",
};

// Hàm chuyển đổi UV Index thành mức độ
function getUVLevel(uvi) {
  if (uvi <= 2) return "Thấp";
  if (uvi <= 5) return "Trung bình";
  if (uvi <= 7) return "Cao";
  if (uvi <= 10) return "Rất cao";
  return "Nguy hiểm";
}

client.on("ready", () => {
  console.log(`Bot đã sẵn sàng với tên ${client.user.tag}!`);
});

client.on("messageCreate", async (message) => {
  if (!message.content.startsWith(prefix) || message.author.bot) return;

  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  if (command === "thoitiet") {
    const locationInput = args.join(" ").toLowerCase();
    if (!locationInput)
      return message.reply(
        "Vui lòng nhập tên địa điểm. Ví dụ: !thoitiet Ba Vi"
      );

    try {
      let weatherData;
      if (specialLocations[locationInput]) {
        // Sử dụng tọa độ cho các địa điểm đặc biệt
        const location = specialLocations[locationInput];
        const response = await axios.get(
          `https://api.openweathermap.org/data/2.5/weather?lat=${location.lat}&lon=${location.lon}&appid=${process.env.WEATHER_API_KEY}&units=metric&lang=vi`
        );
        weatherData = response.data;
        weatherData.name = location.name; // Ghi đè tên địa điểm
      } else {
        // Tìm kiếm thông thường theo tên
        const response = await axios.get(
          `http://api.openweathermap.org/data/2.5/weather?q=${locationInput},vietnam&appid=${process.env.WEATHER_API_KEY}&units=metric&lang=vi`
        );
        weatherData = response.data;
      }

      const weatherEmoji = weatherEmojis[weatherData.weather[0].main] || "🌡️";

      // Định dạng hướng gió
      const windDirection = () => {
        const deg = weatherData.wind.deg;
        if (deg >= 337.5 || deg < 22.5) return "Bắc";
        if (deg >= 22.5 && deg < 67.5) return "Đông Bắc";
        if (deg >= 67.5 && deg < 112.5) return "Đông";
        if (deg >= 112.5 && deg < 157.5) return "Đông Nam";
        if (deg >= 157.5 && deg < 202.5) return "Nam";
        if (deg >= 202.5 && deg < 247.5) return "Tây Nam";
        if (deg >= 247.5 && deg < 292.5) return "Tây";
        return "Tây Bắc";
      };

      // Khuyến nghị thời tiết
      const getWeatherAdvice = (temp, humidity, windSpeed, description) => {
        let advice = [];
        if (temp >= 35) {
          advice.push("🌡️ Nhiệt độ cao, hạn chế hoạt động ngoài trời");
        } else if (temp <= 15) {
          advice.push("🧥 Thời tiết lạnh, nên mặc ấm");
        }
        if (humidity >= 80) {
          advice.push("💧 Độ ẩm cao, cẩn thận các thiết bị điện tử");
        }
        if (windSpeed >= 10) {
          advice.push("🌪️ Gió mạnh, cẩn thận khi di chuyển");
        }
        if (description.includes("mưa")) {
          advice.push("☔ Có mưa, nhớ mang theo ô/áo mưa");
        }
        return advice.join("\n");
      };

      const advice = getWeatherAdvice(
        weatherData.main.temp,
        weatherData.main.humidity,
        weatherData.wind.speed,
        weatherData.weather[0].description
      );

      const weatherEmbed = new EmbedBuilder()
        .setColor("#0099ff")
        .setTitle(`${weatherEmoji} Thời tiết tại ${weatherData.name}, Việt Nam`)
        .setDescription(`Cập nhật lúc: ${new Date().toLocaleString("vi-VN")}`)
        .addFields(
          {
            name: "Nhiệt độ",
            value: `🌡️ ${weatherData.main.temp.toFixed(1)}°C`,
            inline: true,
          },
          {
            name: "Cảm giác như",
            value: `🌡️ ${weatherData.main.feels_like.toFixed(1)}°C`,
            inline: true,
          },
          {
            name: "Nhiệt độ cao/thấp",
            value: `↑ ${weatherData.main.temp_max.toFixed(
              1
            )}°C / ↓ ${weatherData.main.temp_min.toFixed(1)}°C`,
            inline: true,
          },
          {
            name: "Độ ẩm",
            value: `💧 ${weatherData.main.humidity}%`,
            inline: true,
          },
          {
            name: "Gió",
            value: `🌬️ ${weatherData.wind.speed.toFixed(
              1
            )} m/s\n${windDirection()}`,
            inline: true,
          },
          {
            name: "Mây che phủ",
            value: `☁️ ${weatherData.clouds.all}%`,
            inline: true,
          },
          {
            name: "Thời tiết",
            value: `${weatherEmoji} ${weatherData.weather[0].description}`,
            inline: true,
          },
          {
            name: "Áp suất",
            value: `${weatherData.main.pressure} hPa`,
            inline: true,
          },
          {
            name: "Khuyến nghị",
            value: advice || "Thời tiết thuận lợi cho các hoạt động ngoài trời",
          }
        )
        .setTimestamp()
        .setFooter({
          text: "Dữ liệu được cập nhật mỗi 10 phút | Powered by OpenWeather API",
        });

      message.reply({ embeds: [weatherEmbed] });
    } catch (error) {
      console.error(error);
      message.reply(
        "❌ Không tìm thấy thông tin thời tiết cho địa điểm này. Vui lòng kiểm tra lại tên địa điểm."
      );
    }
  }
});

// Đăng nhập bot
client.login(process.env.DISCORD_TOKEN);
