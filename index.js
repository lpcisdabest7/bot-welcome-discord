const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
  ],
});
require("dotenv").config(); // Đảm bảo nạp biến môi trường

// Kiểm tra giá trị của CHANNEL_ID
console.log("CHANNEL_ID:", process.env.CHANNEL_ID);

// Cấu hình
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

// Sự kiện khi bot sẵn sàng
client.on("ready", () => {
  console.log(`Đã đăng nhập với tên ${client.user.tag}`);
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
    // Tìm kiếm kênh chào mừng đầu tiên từ danh sách ID
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

// Xử lý lỗi không mong muốn
process.on("unhandledRejection", (error) => {
  console.error("Lỗi không xử lý được:", error);
});

// Đăng nhập bot
client.login(process.env.DISCORD_TOKEN);
