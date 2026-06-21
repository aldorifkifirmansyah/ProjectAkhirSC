# Sistem Reservasi Kendaraan Terdistribusi Berbasis Arsitektur Microservices

Proyek akhir mata kuliah Software Construction (Semester 6). Aplikasi ini merupakan sistem reservasi dan penyewaan kendaraan terdistribusi yang dibangun dengan mengimplementasikan arsitektur microservices murni menggunakan kombinasi Laravel dan Express.js. Sistem ini menerapkan prinsip database-per-service dengan 4 database MariaDB terisolasi, mekanisme autentikasi aman berbasis JWT (JSON Web Token), komunikasi inter-service sinkron/asinkron, serta sinkronisasi data dashboard admin secara real-time menggunakan teknik short polling terpadu.

---

## Struktur Direktori

Penyusunan file di dalam repositori ini adalah sebagai berikut:

- auth-service/ : Service berbasis Laravel (Port 8000) untuk manajemen pengguna, registrasi, login, dan penerbitan token JWT.
- booking-service/ : Service berbasis Laravel (Port 8001) untuk mengelola reservasi, transaksi, kalkulasi durasi sewa, dan validasi armada.
- catalog-service/ : Service berbasis Express.js (Port 3000) untuk manajemen armada kendaraan, status ketersediaan, dan pengolahan gambar Base64.
- notification-service/ : Service berbasis Express.js (Port 3002) untuk pencatatan riwayat aktivitas (event logging) dan log notifikasi admin.
- web-frontend/ : Aplikasi klien single-page (SPA) berbasis HTML, Tailwind CSS, dan Alpine.js yang mengintegrasikan seluruh service.

---

## Panduan Instalasi dan Penggunaan

### 1. Kloning Repositori

```
git clone https://github.com/aldorifkifirmansyah/ProjectAkhirSC.git
cd ProjectAkhirSC
```

### 2. Inisialisasi Database

Sebelum menjalankan backend, buatlah 4 database kosong pada DBMS MariaDB lokal Anda:

1. db_auth
2. db_booking
3. db_catalog
4. db_notification

### 3. Setup Backend Services

#### A. Setup Auth Service & Booking Service (Laravel)

##### Masuk ke folder service (lakukan hal yang sama secara terpisah untuk booking-service)

```
cd auth-service
```

##### Instalasi dependensi PHP, setup env, dan migrasi database

```
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate
```

##### Jalankan server development Laravel (gunakan port 8001 untuk booking-service)

```
php artisan serve --port=8000
```

#### B. Setup Catalog Service & Notification Service (Express.js)

##### Masuk ke folder service (lakukan hal yang sama secara terpisah untuk notification-service)

```
cd catalog-service
```

##### Instalasi library pendukung dan jalankan server Express

```
npm install
cp .env.example .env
npm start
```

### 4. Konfigurasi Environment (.env)

Buka file .env di masing-masing folder service dan sesuaikan kredensial database MariaDB Anda. Pastikan setiap service mengarah ke databasenya masing-masing:

- Pada auth-service/.env pastikan DB_DATABASE=db_auth
- Pada booking-service/.env pastikan DB_DATABASE=db_booking
- Pada catalog-service/.env pastikan konfigurasi database mengarah ke db_catalog
- Pada notification-service/.env pastikan konfigurasi database mengarah ke db_notification

### 5. Menjalankan Aplikasi Frontend

Buka folder web-frontend/ menggunakan aplikasi editor Anda (misalnya VS Code). Jalankan file login.html atau index.html menggunakan ekstensi Live Server di browser Anda untuk menghindari kendala keamanan kebijakan CORS (Cross-Origin Resource Sharing) saat browser melakukan request API lintas port.

---

## Alur Komunikasi dan Sinkronisasi Data Real-Time

Sistem ini dirancang untuk mendemonstrasikan integrasi loose coupling antar service secara mandiri dengan alur kerja sebagai berikut:

- Isolasi Autentikasi (JWT Auth): Klien mendapatkan token JWT dari auth-service (Port 8000). Token ini disimpan secara lokal di browser dan dilampirkan sebagai header Authorization: Bearer pada setiap request ke service lainnya.
- Validasi Transaksi (Booking -> Catalog): Saat customer melakukan reservasi, booking-service (Port 8001) secara sinkron mengirimkan request HTTP REST API ke catalog-service (Port 3000) untuk memvalidasi detail kendaraan dan memastikan status armada valid sebelum menyimpan transaksi.
- Pemicu Log Aktivitas (Booking -> Notification): Sesaat setelah data sewa berhasil tersimpan di db_booking, booking-service secara otomatis mengirimkan request HTTP POST ke notification-service (Port 3002) untuk mencatat log aktivitas pada database terpisah.
- Sinkronisasi Real-Time Tanpa Refresh (Short Polling): Klien admin melakukan short polling berkala setiap 5 detik ke notification-service. Ketika sistem mendeteksi adanya data notifikasi baru, frontend secara otomatis memicu pembaruan tabel transaksi pada booking-service secara paralel di latar belakang. Rantai pemicu ini memungkinkan dashboard admin memperbarui antrean transaksi secara instan tanpa perlu memuat ulang (hard-refresh) halaman web secara manual.
