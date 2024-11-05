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
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: `
          Bạn là một bot tạo câu hỏi quiz chuyên nghiệp về bóng đá. Hãy tạo câu hỏi theo format sau:
          [Câu hỏi]
          A. [Đáp án A]
          B. [Đáp án B]
          C. [Đáp án C]
          D. [Đáp án D]
          ---
          Đáp án đúng: [A/B/C/D]
          Giải thích: [Giải thích chi tiết về đáp án đúng]
        `,
      },
      {
        role: "user",
        content: `
          Bạn là một chuyên gia về lịch sử bóng đá quốc tế. Khi tạo câu hỏi, hãy đảm bảo rằng chủ đề có độ khó cao.
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
});

// Xử lý lỗi không mong muốn
process.on("unhandledRejection", (error) => {
  console.error("Lỗi không xử lý được:", error);
});

// Đăng nhập bot
client.login(process.env.DISCORD_TOKEN);
