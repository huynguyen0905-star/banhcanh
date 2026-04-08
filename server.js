const express = require('express');
const cors = require('cors');
const ThermalPrinter = require("node-thermal-printer").printer;
const PrinterTypes = require("node-thermal-printer").types;

const app = express();
// Bật CORS để cho phép file HTML gọi API đến tool này
app.use(cors());
app.use(express.json());

// Hàm phụ trợ: Xóa dấu Tiếng Việt để bếp đọc chữ không bị lỗi font
function removeAccents(str) {
    if (!str) return '';
    return str.normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '')
              .replace(/đ/g, 'd').replace(/Đ/g, 'D');
}

app.post('/api/print', async (req, res) => {
    const { printerIP, type, paperSize, data } = req.body;

    if (!printerIP) {
        return res.status(400).json({ error: 'Chưa cung cấp IP máy in' });
    }

    try {
        // Khởi tạo máy in nhiệt (Kết nối qua TCP Cổng 9100)
        let printer = new ThermalPrinter({
            type: PrinterTypes.EPSON, // Đa số máy in LAN dùng chuẩn EPSON (ESC/POS)
            interface: `tcp://${printerIP}:9100`,
            characterSet: 'PC858_WEU',
            removeSpecialCharacters: false,
            lineCharacter: "-"
        });

        let isConnected = await printer.isPrinterConnected();
        if (!isConnected) {
            return res.status(503).json({ error: 'Không thể kết nối đến máy in mạng LAN' });
        }

        printer.alignCenter();
        
        if (type === 'KITCHEN') {
            // --- IN PHIẾU BÁO BẾP ---
            printer.setTextDoubleHeight();
            printer.setTextDoubleWidth();
            printer.println("PHIEU BAO BEP");
            printer.setTextNormal();
            printer.println(`Ban: ${data.table}`);
            printer.println(`Thoi gian: ${new Date().toLocaleTimeString('vi-VN')}`);
            printer.drawLine();
            
            let foodItems = []; let drinkItems = [];
            let totalFood = 0; let totalDrink = 0;
            
            for (let key in data.items) {
                let item = data.items[key];
                let name = removeAccents(item.baseName || key);
                // Nhận diện thức uống bằng tiền tố "NC "
                if (name.startsWith('NC ')) {
                    drinkItems.push({ item, name });
                    totalDrink += item.qty;
                } else {
                    foodItems.push({ item, name });
                    totalFood += item.qty;
                }
            }

            if (foodItems.length > 0) {
                printer.alignCenter();
                printer.setTextNormal();
                printer.println("--- PHAN THUC AN ---");
                printer.drawLine();
                printer.alignLeft();
                for (let f of foodItems) {
                    printer.setTextDoubleHeight();
                    printer.println(`${f.item.qty} x ${f.name}`);
                    printer.setTextNormal();
                    
                    if (f.item.extras && f.item.extras.length > 0) {
                        f.item.extras.forEach(e => {
                            printer.print(`    + ${removeAccents(e.name)} `);
                            printer.bold(true);
                            printer.println(`x${e.qty || 1}`);
                            printer.bold(false);
                        });
                    }
                    if (f.item.note) {
                        printer.print(`    * GC: `);
                        let parts = f.item.note.split(/(tỏi|tiêu|hành lá|toi|tieu|hanh la|hủ tiếu|nui|mì gói|hu tieu|mi goi)/i);
                        parts.forEach(p => {
                            if (/^(tỏi|tiêu|hành lá|toi|tieu|hanh la|hủ tiếu|nui|mì gói|hu tieu|mi goi)$/i.test(p)) {
                                printer.bold(true); printer.print(removeAccents(p).toUpperCase()); printer.bold(false);
                            } else {
                                printer.print(removeAccents(p));
                            }
                        });
                        printer.println("");
                    }
                    printer.drawLine();
                }
            }

            if (drinkItems.length > 0) {
                printer.alignCenter();
                printer.setTextNormal();
                printer.println("--- PHAN THUC UONG ---");
                printer.drawLine();
                printer.alignLeft();
                for (let d of drinkItems) {
                    printer.setTextDoubleHeight();
                    printer.println(`${d.item.qty} x ${d.name}`);
                    printer.setTextNormal();
                    
                    if (d.item.extras && d.item.extras.length > 0) {
                        d.item.extras.forEach(e => {
                            printer.print(`    + ${removeAccents(e.name)} `);
                            printer.bold(true);
                            printer.println(`x${e.qty || 1}`);
                            printer.bold(false);
                        });
                    }
                    if (d.item.note) {
                        printer.print(`    * GC: `);
                        let parts = d.item.note.split(/(tỏi|tiêu|hành lá|toi|tieu|hanh la|hủ tiếu|nui|mì gói|hu tieu|mi goi)/i);
                        parts.forEach(p => {
                            if (/^(tỏi|tiêu|hành lá|toi|tieu|hanh la|hủ tiếu|nui|mì gói|hu tieu|mi goi)$/i.test(p)) {
                                printer.bold(true); printer.print(removeAccents(p).toUpperCase()); printer.bold(false);
                            } else {
                                printer.print(removeAccents(p));
                            }
                        });
                        printer.println("");
                    }
                    printer.drawLine();
                }
            }

            printer.alignCenter();
            printer.setTextNormal();
            let summary = [];
            if (totalFood > 0) summary.push(`Tong mon: ${totalFood}`);
            if (totalDrink > 0) summary.push(`Tong nuoc: ${totalDrink}`);
            printer.println(summary.join(" | "));
            printer.drawLine();
        } else if (type === 'BILL') {
            // --- IN HÓA ĐƠN THANH TOÁN / BẢN SAO ---
            printer.alignCenter();
            printer.setTextDoubleHeight();
            printer.setTextDoubleWidth();
            printer.println("BANH CANH THANH QUYEN");
            printer.setTextNormal();
            printer.println("DC: 428 Nguyen Tri Phuong, TP.HCM");
            printer.println("Hotline: 0907.622.772");
            printer.drawLine();

            printer.setTextDoubleHeight();
            if (data.isProvisional) {
                printer.println("PHIEU TAM TINH");
            } else {
                printer.println(data.isCopy ? "HOA DON THANH TOAN (BAN SAO)" : "HOA DON THANH TOAN");
            }
            printer.setTextNormal();
            printer.alignLeft();
            printer.println(`So Bill: ${data.billNo}`);
            printer.println(`Ban: ${data.table}`);
            printer.println(`Gio vao: ${data.timeIn}`);
            printer.println(`Gio ra: ${data.timeOut}`);
            if (data.staff) printer.println(`Nhan vien: ${removeAccents(data.staff)}`);
            printer.println(`PTTT: ${removeAccents(data.method)}`);
            printer.drawLine();

            printer.tableCustom([
                { text: "Mon", align: "LEFT", width: 0.4 },
                { text: "SL", align: "CENTER", width: 0.15 },
                { text: "Gia", align: "RIGHT", width: 0.2 },
                { text: "T.Tien", align: "RIGHT", width: 0.25 }
            ]);
            printer.drawLine();

            for (let key in data.items) {
                let item = data.items[key];
                let name = removeAccents(item.baseName || key);
                let tTien = item.price * item.qty;
                
                printer.tableCustom([
                    { text: name, align: "LEFT", width: 0.4 },
                    { text: item.qty.toString(), align: "CENTER", width: 0.15 },
                    { text: (item.price/1000) + "k", align: "RIGHT", width: 0.2 },
                    { text: tTien.toLocaleString(), align: "RIGHT", width: 0.25 }
                ]);
                
                if (item.extras && item.extras.length > 0) {
                    let extTotal = item.extras.reduce((sum, e) => sum + e.price * (e.qty || 1), 0);
                    let extStr = `+ ` + item.extras.map(e=>`${removeAccents(e.name)} x${e.qty||1}`).join(', ') + ` [+${extTotal/1000}k]`;
                    printer.println(`  ${extStr}`);
                }
            }
            printer.drawLine();

            printer.tableCustom([ { text: "Tong tien mon:", align: "LEFT", width: 0.5 }, { text: data.subTotal.toLocaleString() + "d", align: "RIGHT", width: 0.5 } ]);
            if (data.discount > 0) printer.tableCustom([ { text: "Chiet khau:", align: "LEFT", width: 0.5 }, { text: "-" + data.discount.toLocaleString() + "d", align: "RIGHT", width: 0.5 } ]);
            
            printer.setTextDoubleHeight();
            printer.tableCustom([ { text: "KHACH CAN TRA:", align: "LEFT", width: 0.5 }, { text: data.finalTotal.toLocaleString() + "d", align: "RIGHT", width: 0.5 } ]);
            printer.setTextNormal();

            if (data.qrString) {
                printer.drawLine();
                printer.alignCenter();
                printer.println("--- QUET MA QR DE THANH TOAN ---");
                printer.printQR(data.qrString, {
                    cellSize: paperSize === 'K58' ? 4 : 6, // Điều chỉnh size QR theo khổ giấy
                    errorCorrection: 'M',
                    model: 2
                });
                printer.println("So tien: " + data.finalTotal.toLocaleString() + "d");
            }

            printer.drawLine();
            printer.alignCenter();
            printer.println("Xin danh gia 5 sao tren Google de quan phuc vu tot hon!");
            printer.println("Cam on quy khach & Hen gap lai!");
        }

        // Cắt giấy và thực thi lệnh
        printer.cut();
        await printer.execute();
        printer.clear();

        res.status(200).json({ success: true, message: 'In thành công!' });
    } catch (error) {
        console.error("Lỗi in:", error);
        res.status(500).json({ error: 'Lỗi trong quá trình in' });
    }
});

// ==========================================
// WEBHOOK NHẬN ĐƠN HÀNG TỪ GRABFOOD
// ==========================================
app.post('/webhook/grabfood', async (req, res) => {
    try {
        const grabData = req.body;
        console.log("📥 Nhận dữ liệu webhook từ GrabFood...");

        // LƯU Ý: Cấu trúc req.body thực tế sẽ phụ thuộc vào tài liệu API của Grab. 
        // Dưới đây là mô phỏng cách trích xuất và biến đổi dữ liệu thành chuẩn của POS:
        const orderID = grabData.shortOrderNumber || ("GF-" + Math.floor(Math.random() * 90000));
        const driverName = grabData.driver ? grabData.driver.name : "Đang tìm tài xế...";
        
        // Giả lập map danh sách món ăn từ Grab sang chuẩn của POS
        const items = (grabData.items || []).map(item => ({
            name: item.name,
            price: item.priceInMinors / 100 || item.price || 0, // Tùy định dạng Grab trả về
            qty: item.quantity || 1
        }));
        const total = items.reduce((sum, item) => sum + (item.price * item.qty), 0);

        const posOrder = {
            platform: "Grab",
            driver: driverName,
            items: items,
            total: total
        };

        // Đẩy đơn hàng lên Firebase bằng REST API để POS Web tự động nhận được
        const firebaseUrl = `https://pos-thanh-quyen-default-rtdb.firebaseio.com/pos_thanhquyen/app_orders/${orderID}.json`;
        await fetch(firebaseUrl, {
            method: 'PUT', // Dùng PUT để lưu với ID cụ thể (Không bị trùng lặp)
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(posOrder)
        });

        console.log(`✅ Đã đẩy đơn Grab [${orderID}] lên POS thành công!`);
        res.status(200).json({ success: true, message: "Received order successfully" }); // Phản hồi cho Grab biết đã nhận
    } catch (error) {
        console.error("❌ Lỗi xử lý webhook Grab:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// ==========================================
// WEBHOOK XỬ LÝ HỦY ĐƠN TỪ GRABFOOD
// ==========================================
app.post('/webhook/grabfood/cancel', async (req, res) => {
    try {
        const grabData = req.body;
        console.log("📥 Nhận thông báo HỦY đơn từ GrabFood...");
        
        // Lấy mã đơn hàng bị hủy từ payload của Grab
        const orderID = grabData.shortOrderNumber || grabData.orderID;

        if (orderID) {
            const firebaseUrl = `https://pos-thanh-quyen-default-rtdb.firebaseio.com/pos_thanhquyen/app_orders/${orderID}.json`;
            await fetch(firebaseUrl, { method: 'DELETE' }); // Xóa khỏi danh sách chờ trên Firebase
            console.log(`🚫 Đã xóa đơn Grab [${orderID}] khỏi danh sách chờ trên POS!`);
        }
        res.status(200).json({ success: true, message: "Canceled order successfully" });
    } catch (error) {
        console.error("❌ Lỗi xử lý hủy đơn Grab:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// ==========================================
// WEBHOOK NHẬN ĐƠN HÀNG TỪ SHOPEEFOOD
// ==========================================
app.post('/webhook/shopeefood', async (req, res) => {
    try {
        const shopeeData = req.body;
        console.log("📥 Nhận dữ liệu webhook từ ShopeeFood...");

        // LƯU Ý: Cấu trúc req.body thực tế sẽ phụ thuộc vào tài liệu API của ShopeeFood. 
        // Dưới đây là mô phỏng cách trích xuất và biến đổi dữ liệu thành chuẩn của POS:
        const orderID = shopeeData.order_sn || ("SP-" + Math.floor(Math.random() * 90000));
        const driverName = shopeeData.driver_name || "Đang tìm tài xế...";
        
        // Giả lập map danh sách món ăn từ Shopee sang chuẩn của POS
        const items = (shopeeData.detail_list || []).map(item => ({
            name: item.food_name,
            price: item.price || 0, // Tùy định dạng Shopee trả về
            qty: item.quantity || 1
        }));
        const total = items.reduce((sum, item) => sum + (item.price * item.qty), 0);

        const posOrder = {
            platform: "Shopee",
            driver: driverName,
            items: items,
            total: total
        };

        // Đẩy đơn hàng lên Firebase bằng REST API
        const firebaseUrl = `https://pos-thanh-quyen-default-rtdb.firebaseio.com/pos_thanhquyen/app_orders/${orderID}.json`;
        await fetch(firebaseUrl, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(posOrder)
        });

        console.log(`✅ Đã đẩy đơn Shopee [${orderID}] lên POS thành công!`);
        res.status(200).json({ result: "success" }); // Phản hồi cho Shopee biết đã nhận
    } catch (error) {
        console.error("❌ Lỗi xử lý webhook Shopee:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// ==========================================
// WEBHOOK XỬ LÝ HỦY ĐƠN TỪ SHOPEEFOOD
// ==========================================
app.post('/webhook/shopeefood/cancel', async (req, res) => {
    try {
        const shopeeData = req.body;
        console.log("📥 Nhận thông báo HỦY đơn từ ShopeeFood...");
        
        const orderID = shopeeData.order_sn;

        if (orderID) {
            const firebaseUrl = `https://pos-thanh-quyen-default-rtdb.firebaseio.com/pos_thanhquyen/app_orders/${orderID}.json`;
            await fetch(firebaseUrl, { method: 'DELETE' }); // Xóa khỏi danh sách chờ trên Firebase
            console.log(`🚫 Đã xóa đơn Shopee [${orderID}] khỏi danh sách chờ trên POS!`);
        }
        res.status(200).json({ result: "success" });
    } catch (error) {
        console.error("❌ Lỗi xử lý hủy đơn Shopee:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

const PORT = 8080;
app.listen(PORT, () => {
    console.log(`🖨️ Print Server đang chạy tại: http://localhost:${PORT}`);
    console.log(`Sẵn sàng nhận lệnh in từ POS...`);
});