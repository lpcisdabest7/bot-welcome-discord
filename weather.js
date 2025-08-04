const { OpenAI } = require("openai");
const axios = require("axios");
require("dotenv").config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});
const WEATHER_API_KEY = process.env.WEATHER_API_KEY;

// Chuyển đổi Kelvin sang Celsius
const kelvinToCelsius = (kelvin) => (kelvin - 273.15).toFixed(1);

// Emoji cho các loại thời tiết
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
  Smoke: "🌫️",
  Dust: "🌫️",
  Sand: "🌫️",
  Ash: "🌫️",
  Squall: "💨",
  Tornado: "🌪️",
};

// Hàm tạo thông tin chi tiết thời tiết bằng AI
async function getWeatherRecommendation(
  temp,
  humidity,
  windSpeed,
  weatherMain,
  feelsLike,
  tempMin,
  tempMax,
  pressure,
  clouds,
  formattedName,
  windDeg,
  weather
) {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `Bạn là chuyên gia thời tiết Việt Nam. Dựa trên thông tin thời tiết, đưa ra khuyến nghị hành động ngắn gọn:

**ĐỊNH DẠNG TRẢ VỀ (tối đa 500 ký tự):**

💡 **Khuyến nghị hành động:**
- 👕 **Trang phục:** [Gợi ý trang phục phù hợp]
- 🏃 **Hoạt động:** [Nên làm gì/tránh gì]
- 💊 **Sức khỏe:** [Lưu ý sức khỏe quan trọng]
- 🚗 **Giao thông:** [Cảnh báo khi di chuyển]
- 🎒 **Chuẩn bị:** [Đồ cần mang theo]

Sử dụng ngôn ngữ thân thiện, ngắn gọn và phù hợp văn hóa Việt Nam. Chỉ tập trung vào khuyến nghị hành động, không cần thông tin tổng quát hay chỉ số chi tiết.`,
        },
        {
          role: "user",
          content: `Thông tin thời tiết chi tiết cho ${formattedName}:

**Dữ liệu thời tiết:**
- Nhiệt độ hiện tại: ${temp}°C
- Nhiệt độ cảm giác: ${feelsLike}°C
- Nhiệt độ cao nhất: ${tempMax}°C
- Nhiệt độ thấp nhất: ${tempMin}°C
- Độ ẩm: ${humidity}%
- Tốc độ gió: ${windSpeed} m/s
- Hướng gió: ${getWindDirection(windDeg)}
- Thời tiết: ${weatherMain} (${weather})
- Áp suất không khí: ${pressure} hPa
- Mây che phủ: ${clouds}%

**Chỉ số bổ sung:**
- UV Index: ${getUVIndex(temp, clouds)}/10
- Mức độ gió: ${getWindLevel(windSpeed)}
- Mức độ độ ẩm: ${getHumidityLevel(humidity)}

Hãy phân tích toàn diện và đưa ra khuyến nghị chi tiết theo format yêu cầu.`,
        },
      ],
      max_tokens: 250,
      temperature: 0.7,
    });

    return response.choices[0].message.content.trim();
  } catch (error) {
    console.error("Lỗi khi tạo khuyến nghị thời tiết:", error);
    // Nếu AI gặp lỗi, thử tạo khuyến nghị đơn giản dựa trên thông tin thời tiết
    let recommendation = "💡 **Khuyến nghị hành động:**\n";

    // Phân tích nhiệt độ
    if (temp > 35) {
      recommendation += "- 👕 **Trang phục:** Quần áo thoáng mát, mũ nón\n";
      recommendation +=
        "- 🏃 **Hoạt động:** Tránh nắng gắt, hoạt động trong nhà\n";
      recommendation += "- 💊 **Sức khỏe:** Uống nhiều nước, tránh say nắng\n";
      recommendation += "- 🚗 **Giao thông:** Mang nước uống khi di chuyển\n";
      recommendation += "- 🎒 **Chuẩn bị:** Kem chống nắng, nước uống\n";
    } else if (temp < 15) {
      recommendation += "- 👕 **Trang phục:** Mặc ấm, nhiều lớp áo\n";
      recommendation += "- 🏃 **Hoạt động:** Hoạt động vừa phải\n";
      recommendation += "- 💊 **Sức khỏe:** Giữ ấm cơ thể\n";
      recommendation += "- 🚗 **Giao thông:** Bình thường\n";
      recommendation += "- 🎒 **Chuẩn bị:** Áo ấm, khăn\n";
    } else {
      recommendation += "- 👕 **Trang phục:** Quần áo phù hợp thời tiết\n";
      recommendation += "- 🏃 **Hoạt động:** Sinh hoạt bình thường\n";
      recommendation += "- 💊 **Sức khỏe:** Không có vấn đề đặc biệt\n";
      recommendation += "- 🚗 **Giao thông:** Bình thường\n";
      recommendation += "- 🎒 **Chuẩn bị:** Theo nhu cầu\n";
    }

    // Thêm khuyến nghị dựa trên thời tiết
    if (weatherMain === "Rain" || weatherMain === "Thunderstorm") {
      recommendation = recommendation.replace(
        "- 🏃 **Hoạt động:**",
        "- 🏃 **Hoạt động:** Hạn chế ra ngoài, "
      );
      recommendation = recommendation.replace(
        "- 🚗 **Giao thông:**",
        "- 🚗 **Giao thông:** Đường trơn, cẩn thận, "
      );
      recommendation = recommendation.replace(
        "- 🎒 **Chuẩn bị:**",
        "- 🎒 **Chuẩn bị:** Ô, áo mưa, "
      );
    }

    if (windSpeed > 10) {
      recommendation = recommendation.replace(
        "- 🏃 **Hoạt động:**",
        "- 🏃 **Hoạt động:** Cẩn thận ngoài trời, "
      );
      recommendation = recommendation.replace(
        "- 🚗 **Giao thông:**",
        "- 🚗 **Giao thông:** Cẩn thận khi lái xe, "
      );
    }

    return recommendation;
  }
}

// Hàm lấy hướng gió
function getWindDirection(degrees) {
  const directions = [
    "Bắc",
    "Đông Bắc",
    "Đông",
    "Đông Nam",
    "Nam",
    "Tây Nam",
    "Tây",
    "Tây Bắc",
  ];
  const index = Math.round(degrees / 45) % 8;
  return directions[index];
}

// Hàm lấy màu sắc dựa trên nhiệt độ
function getTemperatureColor(temp) {
  if (temp < 0) return "#87CEEB"; // Xanh nhạt cho lạnh
  if (temp < 15) return "#00BFFF"; // Xanh dương cho mát
  if (temp < 25) return "#32CD32"; // Xanh lá cho ấm
  if (temp < 35) return "#FFA500"; // Cam cho nóng
  return "#FF4500"; // Đỏ cho rất nóng
}

// Hàm đánh giá mức độ độ ẩm
function getHumidityLevel(humidity) {
  if (humidity < 30) return "Khô (Cần dưỡng ẩm)";
  if (humidity < 50) return "Thấp (Tương đối khô)";
  if (humidity < 70) return "Trung bình (Dễ chịu)";
  if (humidity < 90) return "Cao (Hơi ẩm)";
  return "Rất cao (Rất ẩm)";
}

// Hàm đánh giá mức độ gió
function getWindLevel(windSpeed) {
  if (windSpeed < 2) return "Nhẹ (Yên tĩnh)";
  if (windSpeed < 5) return "Trung bình (Dễ chịu)";
  if (windSpeed < 10) return "Mạnh (Cần chú ý)";
  if (windSpeed < 15) return "Rất mạnh (Nguy hiểm)";
  return "Bão (Rất nguy hiểm)";
}

// Hàm phân loại thời tiết
function getWeatherType(weatherMain) {
  const types = {
    Clear: "Quang đãng",
    Clouds: "Có mây",
    Rain: "Mưa",
    Drizzle: "Mưa phùn",
    Thunderstorm: "Giông bão",
    Snow: "Tuyết",
    Mist: "Sương mù",
    Fog: "Sương mù dày",
    Haze: "Sương mù nhẹ",
    Smoke: "Khói",
    Dust: "Bụi",
    Sand: "Cát",
    Ash: "Tro",
    Squall: "Gió mạnh",
    Tornado: "Lốc xoáy",
  };
  return types[weatherMain] || "Không xác định";
}

// Hàm ước tính chỉ số UV
function getUVIndex(temp, clouds) {
  // Ước tính UV dựa trên nhiệt độ và mây che phủ
  let uvBase = 0;
  if (temp > 30) uvBase = 8;
  else if (temp > 25) uvBase = 6;
  else if (temp > 20) uvBase = 4;
  else if (temp > 15) uvBase = 3;
  else uvBase = 2;

  // Giảm UV khi có mây
  const cloudReduction = (clouds / 100) * 0.5;
  const uvIndex = Math.max(1, Math.round(uvBase * (1 - cloudReduction)));

  return uvIndex;
}

// Hàm khuyến nghị bảo vệ UV
function getUVProtection(temp, clouds) {
  const uvIndex = getUVIndex(temp, clouds);
  if (uvIndex <= 2) return "Thấp - Không cần bảo vệ";
  if (uvIndex <= 5) return "Trung bình - Cần kem chống nắng";
  if (uvIndex <= 7) return "Cao - Cần bảo vệ kỹ";
  if (uvIndex <= 10) return "Rất cao - Tránh nắng";
  return "Cực cao - Không nên ra ngoài";
}

// Hàm lấy tọa độ từ địa điểm
async function getCoordinates(location) {
  try {
    const response = await axios.get(
      "https://nominatim.openstreetmap.org/search",
      {
        params: {
          q: location,
          format: "json",
          limit: 1,
          // Bỏ countrycodes để có thể tìm kiếm toàn cầu
        },
        headers: {
          "User-Agent": "MyDiscordWeatherBot/1.0 (contact: cuonglp@apero.vn)",
        },
      }
    );

    if (response.data && response.data.length > 0) {
      const result = response.data[0];
      return {
        lat: parseFloat(result.lat),
        lon: parseFloat(result.lon),
        display_name: result.display_name,
      };
    } else {
      throw new Error("Không tìm thấy địa điểm");
    }
  } catch (error) {
    console.error("Lỗi khi lấy tọa độ:", error);
    throw error;
  }
}

// Hàm format tên hiển thị
function formatDisplayName(displayName) {
  // Hiển thị địa chỉ đầy đủ nhưng có format đẹp hơn
  return (
    displayName
      .replace("District", "Quận")
      .replace("Hanoi", "Hà Nội")
      .replace("Vietnam", "Việt Nam")
      .replace("Province", "Tỉnh")
      .replace("City", "Thành phố")
      .replace("Ward", "Phường")
      .replace("Commune", "Xã")
      // Thêm các từ tiếng Anh phổ biến cho địa điểm nước ngoài
      .replace("Street", "Đường")
      .replace("Avenue", "Đại lộ")
      .replace("Road", "Đường")
      .replace("Boulevard", "Đại lộ")
      .replace("Lane", "Ngõ")
      .replace("Drive", "Đường")
      .replace("Place", "Quảng trường")
      .replace("Square", "Quảng trường")
      .replace("Park", "Công viên")
      .replace("Bridge", "Cầu")
      .replace("Station", "Ga")
      .replace("Airport", "Sân bay")
      .replace("University", "Đại học")
      .replace("Hospital", "Bệnh viện")
      .replace("Mall", "Trung tâm thương mại")
      .replace("Center", "Trung tâm")
      .replace("Building", "Tòa nhà")
      .replace("Tower", "Tháp")
      .replace("Hotel", "Khách sạn")
      .replace("Restaurant", "Nhà hàng")
  );
}

// Hàm format thời gian
function formatDateTime(date) {
  return date.toLocaleString("vi-VN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
  });
}

// Hàm chính xử lý lệnh thời tiết
async function handleWeatherCommand(message, location) {
  if (!location) {
    await message.reply("Hãy nhập vị trí! Ví dụ: `!tt Hà Đông`");
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
    console.log(response.data);
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
    // Get Vietnam time directly using timezone
    const vietnamTime = new Date(
      currentTime.toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" })
    );
    const weatherEmoji = weatherEmojis[weatherMain] || "❓";
    const recommendation = await getWeatherRecommendation(
      parseFloat(temp),
      humidity,
      parseFloat(windSpeed),
      weatherMain,
      parseFloat(feelsLike),
      parseFloat(tempMin),
      parseFloat(tempMax),
      pressure,
      clouds,
      formattedName,
      windDeg,
      weather
    );

    const { EmbedBuilder } = require("discord.js");
    const embed = new EmbedBuilder()
      .setColor(getTemperatureColor(parseFloat(temp)))
      .setTitle(`${weatherEmoji} Thời tiết tại ${formattedName}`)
      .setThumbnail(
        `https://openweathermap.org/img/wn/${data.weather[0].icon}@2x.png`
      )
      .setDescription(
        `**Cập nhật lúc:** ${formatDateTime(
          vietnamTime
        )} (GMT+7) Múi giờ Việt Nam`
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
          value: `> **Độ ẩm:** ${humidity}%\n> **Mức độ:** ${getHumidityLevel(
            humidity
          )}`,
          inline: true,
        },
        {
          name: "💨 Gió",
          value:
            `> **Tốc độ:** ${windSpeed} m/s\n` +
            `> **Hướng:** ${getWindDirection(windDeg)}\n` +
            `> **Mức độ:** ${getWindLevel(windSpeed)}`,
          inline: true,
        },
        {
          name: "☁️ Mây & Áp suất",
          value: `> **Mây:** ${clouds}%\n> **Áp suất:** ${pressure} hPa`,
          inline: true,
        },
        {
          name: "🌥️ Thời tiết",
          value: `> **Mô tả:** ${weather}\n> **Loại:** ${getWeatherType(
            weatherMain
          )}`,
          inline: true,
        },
        {
          name: "🌍 Chỉ số UV",
          value: `> **UV Index:** ${getUVIndex(
            temp,
            clouds
          )}\n> **Bảo vệ:** ${getUVProtection(temp, clouds)}`,
          inline: true,
        },
        {
          name: "💡 Khuyến nghị",
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

    await message.reply({ embeds: [embed] });
  } catch (error) {
    console.error("Error:", error);
    await message.reply(
      "Không tìm thấy thông tin thời tiết cho vị trí bạn yêu cầu. Vui lòng kiểm tra lại."
    );
  }
}

module.exports = {
  handleWeatherCommand,
  getWeatherRecommendation,
  getCoordinates,
  formatDisplayName,
  formatDateTime,
  kelvinToCelsius,
  getWindDirection,
  getTemperatureColor,
  getHumidityLevel,
  getWindLevel,
  getWeatherType,
  getUVIndex,
  getUVProtection,
  weatherEmojis,
};
