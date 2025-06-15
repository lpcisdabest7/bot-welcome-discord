const { google } = require("googleapis");
const path = require("path");

const CREDENTIALS_PATH = path.join(process.cwd(), "service-account.json");
const SPREADSHEET_ID = "1pnVfUQ3Sll42Cap4Du507fVqxJad9n3-AmN60Gu-g6c";

async function getAuthClient() {
  try {
    const auth = new google.auth.GoogleAuth({
      keyFile: CREDENTIALS_PATH,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    return auth;
  } catch (error) {
    console.error("Error creating auth client:", error);
    throw error;
  }
}

// ✅ Ghi dòng tiêu đề (chạy 1 lần)
async function writeHeader() {
  try {
    const auth = await getAuthClient();
    const sheets = google.sheets({ version: "v4", auth });

    const headerValues = [["Tên", "Giá", "Trạng thái", "Ngày"]];

    const request = {
      spreadsheetId: SPREADSHEET_ID,
      range: "Sheet1!A1:D1",
      valueInputOption: "USER_ENTERED",
      resource: {
        values: headerValues,
      },
    };

    const response = await sheets.spreadsheets.values.update(request);
    console.log("✅ Header written successfully:", response.data);
  } catch (error) {
    console.error("❌ Error writing header:", error);
    throw error;
  }
}

async function ensureSheetAndHeaderExists(sheetName) {
  try {
    const auth = await getAuthClient();
    const sheets = google.sheets({ version: "v4", auth });

    // Lấy danh sách các sheet hiện có
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
    });
    const sheetExists = spreadsheet.data.sheets.some(
      (s) => s.properties.title === sheetName
    );

    // Nếu chưa có sheet thì tạo mới
    if (!sheetExists) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        resource: {
          requests: [
            {
              addSheet: {
                properties: {
                  title: sheetName,
                },
              },
            },
          ],
        },
      });
      console.log(`✅ Created new sheet: ${sheetName}`);
    }

    // Kiểm tra header
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A1:F1`,
    });
    const headerExists =
      response.data.values &&
      response.data.values.length > 0 &&
      response.data.values[0][0] === "Tên";
    if (!headerExists) {
      // Add header if it doesn't exist
      const headerRequest = {
        spreadsheetId: SPREADSHEET_ID,
        range: `${sheetName}!A1:F1`,
        valueInputOption: "USER_ENTERED",
        resource: {
          values: [["Tên", "Giá", "Số lượng", "Tên món", "Trạng thái", "Ngày"]],
        },
      };
      await sheets.spreadsheets.values.update(headerRequest);
      console.log(`✅ Header row added to sheet: ${sheetName}`);
    }
  } catch (error) {
    console.error("❌ Error ensuring sheet/header exists:", error);
    throw error;
  }
}

// ✅ Thêm dòng dữ liệu (orderData)
async function appendToSheet(orderData) {
  try {
    const auth = await getAuthClient();
    const sheets = google.sheets({ version: "v4", auth });

    // Sheet name theo ngày (VD: 15/6)
    const sheetName = orderData.date;
    await ensureSheetAndHeaderExists(sheetName);

    // Lấy số dòng hiện có để xác định vị trí ghi tiếp
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A:F`,
    });
    const rows = response.data.values || [];
    const nextRow = rows.length + 1;

    const values = [
      [
        orderData.name,
        orderData.price,
        orderData.quantity,
        orderData.itemName,
        orderData.status,
        orderData.date,
      ],
    ];

    const request = {
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A${nextRow}:F${nextRow}`,
      valueInputOption: "USER_ENTERED",
      resource: {
        values,
      },
    };

    const updateResponse = await sheets.spreadsheets.values.update(request);
    console.log(
      `✅ Data inserted successfully at row ${nextRow} in sheet ${sheetName}:`,
      updateResponse.data
    );
    return updateResponse.data;
  } catch (error) {
    console.error("❌ Error inserting to sheet:", error);
    throw error;
  }
}

module.exports = {
  appendToSheet,
  writeHeader,
};
