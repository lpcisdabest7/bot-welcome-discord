const axios = require("axios");
const ExcelJS = require("exceljs");
const readline = require("readline");
const fs = require("fs");

// Parse command line arguments
const args = process.argv.slice(2);
const AUTO_YES = args.includes("--auto-yes");
const FORMAT =
  args.find((arg) => arg.startsWith("--format="))?.split("=")[1] || "xlsx";

// Màu nền cho mỗi danh mục
const colors = [
  "FFFF00", // "#facc15"
  "CCFF33", // "#a3e635"
  "66FF99", // "#4ade80"
  "00CCCC", // "#0891b2"
  "3366FF", // "#2563eb"
  "9933FF", // "#7c3aed"
  "FF3399", // "#db2777"
  "FF3366", // "#f43f5e"
];

// Tạo tên cột Excel từ A -> Z, AA -> ZZ
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

// Tính tổng số món trước một danh mục
function sumItems(menu, idx) {
  let sum = 0;
  for (let i = 0; i < idx; i++) {
    sum += menu.categories[i].items.length;
  }
  return sum;
}

// Gọi API để lấy menu
async function fetchMenu(merchantId) {
  const url = `https://portal.grab.com/foodweb/v2/merchants/${merchantId}`;
  const res = await axios.get(url);
  return res.data.merchant.menu;
}

// Xuất danh mục ra Excel
async function exportCategories(categories, menu) {
  const workbook = new ExcelJS.Workbook();
  const worksheetName = new Date().toISOString().split("T")[0];
  const worksheet = workbook.addWorksheet(worksheetName);

  for (let i = 0; i < categories.length; i++) {
    const category = categories[i];
    const color = colors[i % colors.length];
    const sumI = sumItems(menu, i);
    const itemsLen = category.items.length;
    const x = clc[sumI];
    const y = clc[sumI + itemsLen - 1];

    // Cài độ rộng cột
    for (let k = 0; k < itemsLen; k++) {
      worksheet.getColumn(sumI + k + 1).width = 25;
    }

    // Format danh mục
    const categoryCell = worksheet.getCell(`${x}1`);
    categoryCell.value = category.name;
    categoryCell.alignment = {
      vertical: "middle",
      horizontal: "center",
      wrapText: true,
    };
    categoryCell.font = { bold: true, name: "Times New Roman" };
    categoryCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: color },
    };

    if (x !== y) {
      worksheet.mergeCells(`${x}1:${y}1`);
    }

    // Viết tên món
    for (let j = 0; j < itemsLen; j++) {
      const col = clc[sumI + j];
      const cell = worksheet.getCell(`${col}2`);
      cell.value = category.items[j].name;
      cell.alignment = {
        vertical: "middle",
        horizontal: "center",
        wrapText: true,
      };
      cell.font = { bold: true, size: 10, name: "Times New Roman" };
    }
  }

  await workbook.xlsx.writeFile("export.xlsx");
}

// Export to JSON format
async function exportToJSON(categories) {
  const data = categories.map((category) => ({
    name: category.name,
    items: category.items.map((item) => ({
      name: item.name,
      price: item.priceInMinorUnit
        ? `${item.priceInMinorUnit.toLocaleString()} VNĐ`
        : "",
      discountedPrice: item.discountedPriceV2?.value
        ? `${item.discountedPriceV2.value.toLocaleString()} VNĐ`
        : "",
      description: item.description || "",
    })),
  }));

  await fs.promises.writeFile("export.json", JSON.stringify(data, null, 2));
}

// Export to CSV format
async function exportToCSV(categories) {
  let csvContent = "Category,Item Name,Price,Discounted Price,Description\n";

  for (const category of categories) {
    for (const item of category.items) {
      const price = item.priceInMinorUnit
        ? `${item.priceInMinorUnit.toLocaleString()} VNĐ`
        : "";
      const discountedPrice = item.discountedPriceV2?.value
        ? `${item.discountedPriceV2.value.toLocaleString()} VNĐ`
        : "";
      const description = item.description || "";

      csvContent += `"${category.name}","${item.name}","${price}","${discountedPrice}","${description}"\n`;
    }
  }

  await fs.promises.writeFile("export.csv", csvContent);
}

// Hàm nhập dữ liệu dòng lệnh
function askQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) =>
    rl.question(query, (ans) => {
      rl.close();
      resolve(ans);
    })
  );
}

// Export functions for bot.js
module.exports = {
  fetchMenu,
};

// Only run the main function if this file is run directly
if (require.main === module) {
  (async function () {
    const merchantId = (
      await askQuestion("👉 Please input merchant ID: ")
    ).trim();

    const menu = await fetchMenu(merchantId);
    const categories = [];

    for (const category of menu.categories) {
      if (AUTO_YES) {
        if (category.items.length > 0) {
          categories.push(category);
        }
        continue;
      }

      const option = (
        await askQuestion(
          `🧾 Export category "${category.name}"? (yes/no) default no: `
        )
      )
        .trim()
        .toLowerCase();

      if ((option === "yes" || option === "y") && category.items.length > 0) {
        categories.push(category);
      } else if (option === "no" || option === "n" || option === "") {
        continue;
      } else {
        throw new Error(`Invalid option "${option}". Please enter yes/no.`);
      }
    }

    if (!AUTO_YES) {
      const format = (
        await askQuestion("📄 Export format (json/csv/xlsx) default xlsx: ")
      )
        .trim()
        .toLowerCase();

      if (format) FORMAT = format;
    }

    switch (FORMAT) {
      case "json":
        await exportToJSON(categories);
        break;
      case "csv":
        await exportToCSV(categories);
        break;
      case "xlsx":
      default:
        await exportCategories(categories, menu);
        break;
    }
  })();
}
