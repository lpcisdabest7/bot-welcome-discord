const { Client, GatewayIntentBits, EmbedBuilder } = require("discord.js");
require("dotenv").config();
const { gunzipSync } = require("zlib");

const decodeClient = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    // MessageContent intent removed - needs to be enabled in Discord Developer Portal
  ],
});

// Sự kiện khi decode bot sẵn sàng
decodeClient.on("ready", () => {
  decodeClient.user.setActivity("Decode Commands", { type: "WATCHING" });
  console.log(`Decode bot ${decodeClient.user.tag} is ready!`);
});

// URL Decoding Functions
function decodeGzipMax(base64urlStr) {
  try {
    // Try URL-safe base64 first
    let buffer = Buffer.from(base64urlStr, "base64url");
    let decompressed = gunzipSync(buffer);
    return decompressed.toString("utf8");
  } catch (error) {
    // Fallback to standard base64
    try {
      const buffer = Buffer.from(base64urlStr, "base64");
      const decompressed = gunzipSync(buffer);
      return decompressed.toString("utf8");
    } catch (e2) {
      throw new Error(`Lỗi giải mã URL: ${error.message}`);
    }
  }
}

// Decode client message handler
decodeClient.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  console.log(
    `[DECODE BOT] Received message: "${message.content}" from ${
      message.author.username
    } in ${message.guild ? message.guild.name : "DM"}`
  );

  // Without MessageContent intent, only handle messages that mention the bot or are in DMs
  if (!message.mentions.has(decodeClient.user) && message.guild) {
    console.log(
      `[DECODE BOT] Ignoring message - doesn't mention bot and not in DM`
    );
    return;
  }

  // Handle decode command on replied message containing JSON with "curl"
  if (message.content.trim() === "!decode") {
    console.log(`[DECODE BOT] Decode command received: "${message.content}"`);
    try {
      if (!message.reference?.messageId) {
        await message.reply(
          "❌ Vui lòng reply vào tin nhắn chứa JSON với trường 'curl' và gõ !decode"
        );
        return;
      }

      const repliedMessage = await message.channel.messages.fetch(
        message.reference.messageId
      );

      // Aggregate content from message text and any embeds (description + fields)
      const embedParts = (repliedMessage.embeds || [])
        .map((e) => {
          const desc = e?.description ? String(e.description) : "";
          const fieldsText = (e?.fields || [])
            .map((f) => `${f.name ?? ""}\n${f.value ?? ""}`)
            .join("\n");
          return [desc, fieldsText].filter(Boolean).join("\n");
        })
        .filter((t) => t && t.trim().length > 0);
      const aggregated = [repliedMessage.content || "", ...embedParts]
        .filter(Boolean)
        .join("\n");
      const rawContent = aggregated.trim();
      if (!rawContent) {
        await message.reply(
          "❌ Tin nhắn được reply không có nội dung văn bản."
        );
        return;
      }

      // Remove code block fences if present
      const contentWithoutFences = rawContent
        // Replace fenced code blocks with their inner content
        .replace(/```[a-zA-Z]*\n([\s\S]*?)```/g, "$1")
        .trim();

      let curlEncoded;
      // Try to parse as JSON first
      try {
        const startIdx = contentWithoutFences.indexOf("{");
        const endIdx = contentWithoutFences.lastIndexOf("}");
        const jsonSlice =
          startIdx !== -1 && endIdx !== -1
            ? contentWithoutFences.slice(startIdx, endIdx + 1)
            : contentWithoutFences;
        const parsed = JSON.parse(jsonSlice);
        if (typeof parsed.curl === "string") {
          curlEncoded = parsed.curl;
        }
      } catch (_) {
        // Fallback to regex extraction
      }

      if (!curlEncoded) {
        const match = contentWithoutFences.match(/"curl"\s*:\s*"([^"]+)"/s);
        if (match && match[1]) {
          curlEncoded = match[1];
        }
      }

      if (!curlEncoded) {
        await message.reply(
          "❌ Không tìm thấy trường 'curl' trong tin nhắn được reply."
        );
        return;
      }

      const decoded = decodeGzipMax(curlEncoded);

      // If content is long, send as a single file attachment to avoid multi-message splitting
      if (decoded.length > 1800) {
        await message.reply({
          content:
            "📄 Nội dung đã giải mã quá dài, gửi kèm file `decoded.txt`.",
          files: [
            {
              attachment: Buffer.from(decoded, "utf8"),
              name: "decoded.txt",
            },
          ],
          allowedMentions: { repliedUser: false },
        });
      } else {
        await message.reply({
          content: "```" + decoded + "```",
          allowedMentions: { repliedUser: false },
        });
      }
    } catch (error) {
      console.error("Error in !decode:", error);
      await message.reply(`❌ Lỗi giải mã: ${error.message}`);
    }
  }
});

// Handle decode client errors
decodeClient.on("error", (error) => {
  console.error("Decode client error:", error);
});

// Export functions for external use
module.exports = {
  decodeGzipMax,
};

// Login the decode bot
if (process.env.DECODE_BOT_TOKEN) {
  console.log("Attempting to login decode bot...");
  decodeClient.login(process.env.DECODE_BOT_TOKEN).catch((error) => {
    console.error("Failed to login decode bot:", error);
  });
} else {
  console.warn(
    "DECODE_BOT_TOKEN not found. Decode functionality will not be available."
  );
}
