# Setup backend: Google Sheets + Apps Script  /  バックエンド設定  /  Backend setup

Backend ini membuat data **tersinkron antar PC/HP** (disimpan di Google Spreadsheet Anda) dan mengirim **reminder harian** via **email** dan **Google Calendar** — walau aplikasi sedang ditutup.
データはあなたのGoogleスプレッドシートに保存され、毎日メールとGoogleカレンダーでリマインドします。

## 1. Buat spreadsheet + script (±5 menit)
1. Buka <https://sheets.new> → beri nama **TSH Export Desk DB**.
2. Menu **Extensions ▸ Apps Script**.
3. Hapus isi `Code.gs`, tempel seluruh isi [`apps-script/Code.gs`](../apps-script/Code.gs).
4. (Disarankan) *Project Settings ▸ Show "appsscript.json"* lalu ganti isinya dengan [`apps-script/appsscript.json`](../apps-script/appsscript.json) (zona waktu Asia/Tokyo).
5. Pilih fungsi **`setup`** ▸ **Run**. Setujui izin (Spreadsheet, Calendar, Mail). Jika muncul "Google hasn't verified this app" → *Advanced ▸ Go to … (unsafe)* — ini script milik Anda sendiri.
6. Buka sheet **`_setup`** → salin **TOKEN** (kolom B1).

## 2. Deploy sebagai Web app
1. **Deploy ▸ New deployment ▸ Web app**
2. *Execute as*: **Me** · *Who has access*: **Anyone**
3. **Deploy** → salin **Web app URL** (berakhiran `/exec`).

> Akses dilindungi **TOKEN rahasia**; tanpa token server menolak semua permintaan. Jangan membagikan URL+TOKEN.

## 3. Sambungkan aplikasi
Aplikasi ▸ **Settings ▸ Cloud sync**: tempel **URL** dan **TOKEN** → **Connect & sync now**.
- Perangkat pertama: data lokal diunggah ke Sheets.
- Perangkat lain: jika server sudah berisi data, aplikasi menawarkan *Replace local data* (pilih OK).
- Setelah itu sinkron otomatis (3 detik setelah edit, dan saat jendela kembali aktif). Status tampil di pojok kanan atas: ☁ Synced hh:mm.

## 4. Atur reminder
Aplikasi ▸ **Settings ▸ Reminder rules**: email tujuan, hari-sebelum untuk ETD / jatuh tempo bayar / L/C / masa berlaku quotation / ETA, jam harian (JST), lalu **Save & install daily trigger**.
Tombol **Send test e-mail** mengirim contoh sekarang; **Sync calendar now** membuat kalender **“TSH Export”** (event all-day + notifikasi pop-up/email pukul 9:00 hari sebelumnya).

Aturan yang dikirim server tiap hari:
| Kejadian | Kapan dikirim |
|---|---|
| ETD mendekati | tepat N hari sebelum (default 7, 3, 1, 0) |
| ETD lewat tapi status belum *Shipped* | setiap hari |
| Dokumen belum lengkap (booking, invoice, PL, SI, export declaration) | ≤ N hari sebelum ETD (default 3) |
| Jatuh tempo pembayaran | tepat N hari sebelum (7, 3, 0) |
| Pembayaran **terlambat** (saldo > 0) | setiap hari sampai lunas |
| L/C expiry · Quotation expiry · ETA | tepat N hari sebelum |
Email berisi **日本語 + English**; hanya terkirim jika ada item.

## Struktur sheet
`shipments` (kolom ringkas terbaca + JSON tersembunyi) · `customers` · `products` · `hs` · `settings` · `_setup`. Setiap baris punya `u` (timestamp edit) — **versi terbaru menang**; baris yang dihapus ditandai `del=TRUE` (tombstone) agar penghapusan ikut tersinkron. Kolom ringkas boleh dipakai untuk pivot/laporan; **jangan edit kolom JSON/`u` manual**.

## Catatan
- Mengubah `Code.gs` → **Deploy ▸ Manage deployments ▸ ✎ ▸ New version** (URL tetap).
- Gambar logo/tanda tangan **tidak** ikut sinkron (terlalu besar untuk sel). Taruh `tsh.png` di repo atau unggah di tiap perangkat.
- Kuota gratis Gmail ±100 email/hari — cukup untuk digest harian.
- Backup tetap disarankan (tombol Backup). Spreadsheet juga punya *Version history*.
- Versi artifact di claude.ai tidak bisa sync (CSP memblokir koneksi keluar); gunakan file `index.html` / GitHub Pages.
