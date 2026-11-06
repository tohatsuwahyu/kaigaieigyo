# TSH Export Desk · 海外営業デスク

Aplikasi satu-file (HTML) untuk **kaigai eigyou** Tokyo Seimitsu Hatsujo: Commercial Invoice, Packing List, Shipping Instruction, Case Mark, Quotation, Proforma Invoice, Order Confirmation — dari satu data, bilingual (EN / 日本語), siap print.
Single-file HTML app for overseas sales documents, bilingual EN/JA, print-ready.
海外営業向けの書類作成ツール（単一HTML・英日バイリンガル・印刷対応）。

## Pakai / Use / 使い方
- **Lokal:** buka `index.html` dengan Chrome/Edge (tanpa instalasi, tanpa server).
- **GitHub Pages:** Settings → Pages → Deploy from branch → `main` / root. 
- **Logo:** taruh `tsh.png` di folder yang sama dengan `index.html` (otomatis dimuat), atau unggah di *Settings → Company logo* (tersimpan di browser dan ikut ke file cetak).
- **Print:** Documents → *Print this document* (Ctrl+P). *Print studio*: A4/Letter, skala, margin, watermark, "Fit to one page", logo, footer, tema warna.
- **Data** tersimpan di browser (localStorage). Backup rutin: tombol *Backup* (Ctrl+S) → file JSON; pulihkan di *Settings → Restore*.

## Fitur
Dashboard (grafik penjualan per tahun fiskal Jun–Mei, jadwal ETD / jatuh tempo, ekspor kalender .ics) · master customer / produk / **HS code** (per-item HS, ringkasan HS di dokumen) · tempel dari Excel · pemeriksa konsistensi dokumen · pelacak pembayaran · checklist 18 langkah · margin & laba (internal) · riwayat harga per customer · kalkulator harga / CBM / Incoterms 2020 · template email · pencarian cepat **Ctrl+K** · 4 tema warna.


## ☁ Backend & Reminder (opsional) / バックエンド
Sinkron multi-perangkat lewat **Google Sheets + Apps Script**, plus reminder harian (email 日本語/English + Google Calendar) untuk ETD, jatuh tempo pembayaran, L/C, quotation, ETA, dan dokumen yang belum lengkap.
→ Panduan: [`docs/SETUP.md`](docs/SETUP.md) · Kode server: [`apps-script/Code.gs`](apps-script/Code.gs)

```
index.html            aplikasi (single file)
apps-script/Code.gs   backend Google Apps Script
apps-script/appsscript.json
docs/SETUP.md         langkah setup
```

## ⚠ Keamanan data
`index.html` berisi data contoh (rekening bank & customer TSH-30099). **Gunakan repo *Private*** atau kosongkan data lewat *Settings → Start clean* lalu isi ulang di browser sebelum membuat repo publik.

## Catatan HS code
Daftar HS di aplikasi hanya referensi. Konfirmasi klasifikasi dengan customs broker / 輸出許可書 (mis. 8207.20 vs 8207.30 untuk press-brake tooling).


## Added later
- Edit documents in place (Documents → Edit) with live preview
- PO intake (Dashboard → PO received), incl. reading pasted PO text
- Next-step guidance per shipment stage
- Sales report (print / file / CSV) with year-over-year and margin
- Certificate of Origin, price history and price-change checks
- Mobile layout; languages: EN/日本語, EN, 日本語, Indonesian
