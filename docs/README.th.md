# Claude Status Touch Bar

แสดงสถานะการใช้งาน Claude Code บน Touch Bar ของ MacBook Pro —
ได้แรงบันดาลใจจาก
[codex-status-touch-bar](https://github.com/binlabongbom/codex-status-touch-bar)
แต่สร้างบน [MTMR](https://github.com/Toxblh/MTMR) แทนการใช้ private API ของ
macOS จึงไม่พังเมื่ออัปเดต macOS และไม่ต้อง build ด้วย Xcode

[English](../README.md)

## Widget บนหน้าจอ

มีปุ่ม 2 ปุ่มทางขวาของ Touch Bar:

| Widget | ตัวอย่าง | ความหมาย |
|---|---|---|
| Block 5 ชั่วโมง | `✳ fable · $20.52 · 23.5M ⏳2h20` | โมเดลปัจจุบัน, ค่าใช้จ่ายและจำนวน token ใน block 5 ชั่วโมงที่กำลังใช้งาน, เวลาที่เหลือก่อน reset |
| หน้าต่าง 7 วัน | `7D $337 · 639.4M` | ค่าใช้จ่ายและ token รวมย้อนหลัง 7 วัน |

แตะปุ่มใดก็ได้เพื่อเปิด dashboard แบบสดใน Terminal —
แสดง block 5 ชั่วโมงล่าสุดพร้อม burn rate และค่าคาดการณ์ refresh ทุก 5 วินาที

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
