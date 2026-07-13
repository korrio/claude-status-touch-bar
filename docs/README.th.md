# Claude Status Touch Bar

แสดงสถานะการใช้งาน Claude Code บน Touch Bar ของ MacBook Pro —
ได้แรงบันดาลใจจาก
[codex-status-touch-bar](https://github.com/binlabongbom/codex-status-touch-bar)
แต่สร้างบน [MTMR](https://github.com/Toxblh/MTMR) แทนการใช้ private API ของ
macOS จึงไม่พังเมื่ออัปเดต macOS และไม่ต้อง build ด้วย Xcode

[English](../README.md)

## Widget บน Touch Bar

มี 3 ส่วนทางขวาของ Touch Bar (ออกแบบตามโปรเจกต์ Codex: 5H / 7D / SESSION / MODEL):

| Widget | ตัวอย่าง | ความหมาย |
|---|---|---|
| Block 5 ชั่วโมง | `5H ████░░░░ 52% $72.89 ⏳1h33` | **% โควตาจริงของแพลน** (จาก OAuth usage API เดียวกับหน้า `/usage`), ค่าใช้จ่าย, เวลาก่อน reset |
| หน้าต่าง 7 วัน | `7D █░░░░ 11% $394` | **% โควตารายสัปดาห์จริง** และค่าใช้จ่ายรวม 7 วัน |
| Session / โมเดล | `✳ fable-5 ███░ 161K/200K` | โมเดลปัจจุบัน และ context ที่ใช้ไปเทียบกับขนาดหน้าต่าง (ตั้ง `CLAUDE_CONTEXT_WINDOW` ได้ถ้าไม่ใช่ 200k) |

แตะปุ่มใดก็ได้เพื่อเปิด dashboard แบบสดใน Terminal —
แสดง block 5 ชั่วโมงล่าสุดพร้อม burn rate และค่าคาดการณ์ refresh ทุก 5 วินาที

## Widget บน Menu Bar (SwiftBar)

สถานะเดียวกันแสดงบน menu bar ด้วย (ใช้ได้แม้ Mac ไม่มี Touch Bar):
`✳ $27.31 ⏳2h02` พร้อม dropdown แสดงรายละเอียดเต็ม — block 5 ชั่วโมง,
burn rate, ค่าคาดการณ์, โมเดลที่ใช้, ยอด 7 วัน และปุ่มเปิด dashboard
ตัวติดตั้งจะติดตั้งและตั้งค่า [SwiftBar](https://github.com/swiftbar/SwiftBar)
ให้อัตโนมัติ

## Widget บนหน้าจอ (Übersicht)

การ์ดลอยบน desktop — เทียบเท่า widget แบบ WidgetKit ของโปรเจกต์ Codex
แต่สร้างด้วย [Übersicht](https://tracesof.net/uebersicht/) แทน Swift:
แสดงค่าใช้จ่าย block ปัจจุบันพร้อมแถบความคืบหน้า 5 ชั่วโมง,
**กราฟกิจกรรม 24 ชั่วโมง** (48 แท่ง แท่งละ 30 นาที ซ้อนสีตามโมเดล —
fable น้ำเงิน, opus เขียวอมฟ้า, sonnet เหลือง, haiku แดง
ชุดสีผ่านการตรวจสอบสำหรับผู้มีภาวะตาบอดสี), เครื่องหมายเวลา 00/06/12/18,
legend ชื่อโมเดล และยอดรวม 7 วันด้านล่าง refresh ทุก 1 นาที

## เปอร์เซ็นต์โควตามาจากไหน

เปอร์เซ็นต์ 5H/7D ดึงจาก **OAuth usage API ของ Anthropic**
(endpoint เดียวกับที่หน้า `/usage` ในแอปเรียก) โดยใช้ token ล็อกอินของ
Claude Code จาก macOS Keychain — token ถูกส่งไปที่ `api.anthropic.com`
เท่านั้น ไม่ถูกเขียนลงดิสก์ และไฟล์ cache เก็บแค่ตัวเลขเปอร์เซ็นต์
ถ้าเรียก API ไม่ได้ widget จะถอยไปใช้ค่าประมาณจาก log ในเครื่อง
(มีเครื่องหมาย `~` กำกับ) ผลลัพธ์ cache ไว้ 60 วินาที

## หลักการทำงาน

- ข้อมูลทั้งหมดอ่านจาก session log ในเครื่องที่
  `~/.claude/projects/**/*.jsonl` — เทคนิคเดียวกับโปรเจกต์ Codex
  โดยอ่านเฉพาะจำนวน token ไม่มีข้อมูลใดออกจากเครื่อง
- ใช้ [`ccusage`](https://github.com/ryoppippi/ccusage) รวมข้อมูลเป็น
  block 5 ชั่วโมงและยอดรายวัน
- `scripts/status.js` จัดรูปแบบเป็นข้อความสั้น ๆ หนึ่งบรรทัด และ
  `scripts/claude-status.sh` cache ผลไว้ (30 วินาทีสำหรับ block,
  5 นาทีสำหรับรายสัปดาห์) เพื่อไม่ให้ Touch Bar ค้าง
- MTMR แสดงผลผ่าน `shellScriptTitledButton` ใน
  `~/Library/Application Support/MTMR/items.json`

## การติดตั้ง

```bash
git clone https://github.com/korrio/claude-status-touch-bar.git
cd claude-status-touch-bar
bash scripts/install.sh
```

ตัวติดตั้งจะ: ติดตั้ง `ccusage`, ติดตั้ง MTMR ผ่าน Homebrew (ถ้ายังไม่มี),
merge widget เข้า `items.json` ของ MTMR (สำรองไฟล์เดิมเป็น
`items.json.bak`) แล้ว restart MTMR

**เปิดครั้งแรก:** ต้องอนุญาต Accessibility ให้ MTMR ที่
*System Settings → Privacy & Security → Accessibility*
บน Apple Silicon ต้องมี Rosetta 2
(`softwareupdate --install-rosetta --agree-to-license`)

## ข้อจำกัด

- ตัวเลขค่าใช้จ่าย/token คำนวณจาก log ในเครื่องด้วยราคา public
  จึงใกล้เคียงแต่ไม่ตรงกับตัวเลข `/usage` อย่างเป็นทางการ 100%
  และไม่สามารถแสดงเปอร์เซ็นต์โควตาของแพลนได้
- ชื่อโมเดลตรวจจับจากท้าย session log ล่าสุด
  จึงเป็นโมเดลที่ใช้ล่าสุด ไม่ใช่รายโปรเจกต์
