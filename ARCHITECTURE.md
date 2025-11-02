# Kiến trúc hệ thống UIT-GO
---

## 1. Tổng quan

UIT-GO là một hệ thống đặt xe (ride-hailing) được xây dựng theo kiến trúc Microservices. Hệ thống được chia thành ba dịch vụ (services) cốt lõi, mỗi dịch vụ đảm nhận một miền nghiệp vụ (domain) cụ thể.

Các thành phần được đóng gói bằng Docker và quản lý chung qua `docker-compose.yml`. Kiến trúc này tuân theo nguyên tắc **Database-per-service**, nơi mỗi dịch vụ quản lý cơ sở dữ liệu riêng của mình để đảm bảo tính độc lập và tách biệt.

---

## 2. Các thành phần hệ thống

Hệ thống bao gồm **3 dịch vụ chính** và **2 loại cơ sở dữ liệu**.

### 2.1. User Service (Cổng `3000`)

**Tên container:** `user-service`  
**Mô tả:** Dịch vụ này quản lý tất cả các thông tin liên quan đến định danh, xác thực và hồ sơ người dùng (cả hành khách và tài xế).

#### Trách nhiệm chính

- Đăng ký tài khoản (Hành khách, Tài xế).
- Xác thực email qua OTP (One-Time Password) gửi qua email.
- Đăng nhập và cấp phát JWT (Access Token & Refresh Token).
- Quản lý thông tin hồ sơ (`GET /users/me`).
- Quản lý phương tiện (Vehicle) cho tài xế.

#### Công nghệ

- Node.js (JavaScript - ES Module)
- Express
- Prisma
- JWT
- Nodemailer
- Bcrypt

#### Lưu trữ

- **PostgreSQL (`pg_user`)**  
  Lưu trữ dữ liệu chính (`Users`, `Vehicles`, `RefreshTokens`).

- **Redis**  
  Dùng để lưu trữ và quản lý OTP (thời gian sống, số lần gửi).

---

### 2.2. Driver Service (Cổng `3001`)

**Tên container:** `driver-service`  
**Mô tả:** Dịch vụ này chuyên quản lý trạng thái và vị trí của tài xế trong thời gian thực.

#### Trách nhiệm chính

- Nhận cập nhật vị trí (`latitude`, `longitude`) và trạng thái (`ONLINE`, `OFFLINE`) từ tài xế.
- Lưu trữ vị trí của tài xế (đang ONLINE) vào cấu trúc dữ liệu Geospatial của Redis.
- Cung cấp API (`GET /drivers/search`) để tìm kiếm các tài xế ONLINE gần một vị trí nhất định, hỗ trợ loại trừ các tài xế đã từ chối.
- Quản lý "hiện diện" (presence) của tài xế bằng key có thời gian sống (TTL) trong Redis.

#### Công nghệ

- Node.js (TypeScript)
- Express
- ioredis

#### Lưu trữ

- **Redis**  
  Là kho dữ liệu duy nhất của dịch vụ này.  
  - `GEOADD`, `GEOSEARCH` cho tìm kiếm vị trí.  
  - `SETEX` cho trạng thái online và TTL.

---

### 2.3. Trip Service (Cổng `3002`)

**Tên container:** `trip-service`  
**Mô tả:** Đây là dịch vụ điều phối trung tâm (orchestrator), quản lý toàn bộ vòng đời của một chuyến đi.

#### Trách nhiệm chính

- Xử lý yêu cầu đặt xe từ hành khách (`POST /api/trips`).
- Gọi `driver-service` để tìm tài xế gần nhất.
- Quản lý máy trạng thái (state machine) của chuyến đi:
  - `SEARCHING`
  - `DRIVER_FOUND`
  - `ACCEPTED`
  - `IN_PROGRESS`
  - `COMPLETED`
  - `CANCELLED`
- Xử lý logic khi tài xế chấp nhận (`/accept`), từ chối (`/reject`), bắt đầu (`/start`), hoặc hoàn thành (`/complete`) chuyến đi.
- Xử lý logic "rematch" (tìm tài xế mới) khi tài xế từ chối hoặc hết thời gian chờ (timeout).
- Gửi thông báo thời gian thực (real-time) đến tài xế (`trip:request`) và hành khách (`trip:update`) qua WebSocket.
- Xử lý việc hành khách hủy chuyến (`/cancel`) hoặc đánh giá (`/rating`).

#### Công nghệ

- Node.js (TypeScript)
- Express
- Prisma
- Socket.io
- Axios (để gọi `driver-service`)

#### Lưu trữ

- **PostgreSQL (`pg_trip`)**  
  Lưu trữ dữ liệu chính (`Trips`, `Ratings`, `TripRejectedDrivers`).

---

## 3. Lưu trữ dữ liệu (Data Storage)

Kiến trúc này sử dụng **3 kho dữ liệu riêng biệt**:

### 3.1. `pg_user` (PostgreSQL)

- **Chủ sở hữu:** `user-service`  
- **Mục đích:** Lưu trữ dữ liệu người dùng, phương tiện, và token  
- **Schema:** `User`, `Vehicle`, `RefreshToken`, `EmailVerification`

### 3.2. `pg_trip` (PostgreSQL)

- **Chủ sở hữu:** `trip-service`  
- **Mục đích:** Lưu trữ dữ liệu về các chuyến đi, đánh giá và lịch sử  
- **Schema:** `Trip`, `Rating`, `TripRejectedDriver`

### 3.3. `redis` (Redis)

- **Đa mục đích:** Được sử dụng bởi nhiều dịch vụ cho các mục đích khác nhau (cache / ephemeral data).
  - `driver-service` sử dụng: Làm kho dữ liệu chính cho vị trí địa lý (GeoSearch) và trạng thái online của tài xế.
  - `user-service` sử dụng: Làm cache cho mã OTP, quản lý cooldown và giới hạn số lần gửi.

---

## 4. Luồng giao tiếp (Communication Flows)

### 4.1. Client ↔ Services (API)

- **Phương thức:** HTTP REST API  
- **Mô tả:** Người dùng (Hành khách/Tài xế) tương tác với các dịch vụ qua các API chuẩn (`POST`, `GET`, `PUT`).  
- **Xác thực:**  
  - Tất cả các API nghiệp vụ đều yêu cầu JWT (Bearer Token).  
  - Token này được cấp bởi `user-service` và được xác thực bởi các dịch vụ khác (ví dụ: `trip-service`).

---

### 4.2. Service → Client (Real-time)

- **Phương thức:** WebSocket (Socket.io)  
- **Mô tả:** `trip-service` sử dụng WebSocket để đẩy thông báo trạng thái ngay lập tức cho người dùng.

#### Luồng

1. Khi một tài xế hoặc hành khách kết nối WebSocket, họ sẽ được xác thực bằng JWT và tham gia một "phòng" (room) riêng tư (`user_{id}`).
2. Khi có yêu cầu chuyến đi mới, `trip-service` phát sự kiện `trip:request` vào phòng của tài xế được chỉ định.
3. Khi tài xế chấp nhận / bắt đầu / hoàn thành chuyến, `trip-service` phát sự kiện `trip:update` vào phòng của hành khách.

#### Internal Decoupling

`trip-service` sử dụng `EventEmitter` (Node.js) để tách biệt:

- Logic nghiệp vụ (trong `trip.service.ts`)
- Logic gửi WebSocket (trong `websocket.gateway.ts`)

---

### 4.3. Service ↔ Service

- **Phương thức:** HTTP REST API (Synchronous)  
- **Mô tả:** `trip-service` là dịch vụ duy nhất chủ động gọi một dịch vụ khác.  
- **Luồng:** Khi cần tìm tài xế, `trip-service` (sử dụng Axios) thực hiện một lệnh `GET` đến `driver-service` (`http://driver-service:3001/drivers/search`).

---

## 5. Luồng nghiệp vụ chính (Vòng đời chuyến đi)

### 5.1. Tài xế Online

1. Tài xế (Client) gửi `PUT /drivers/{id}/location` với `status: "ONLINE"` đến `driver-service`.  
2. `driver-service` lưu vị trí vào Redis GeoSet và đặt key "presence" (với TTL).

### 5.2. Hành khách Đặt xe

1. Hành khách (Client) gửi `POST /trips` đến `trip-service`.  
2. `trip-service` tạo một Trip mới trong `pg_trip` với `status: "SEARCHING"`.

### 5.3. Tìm kiếm tài xế

1. `trip-service` gọi `GET /drivers/search` (kèm vị trí đón) đến `driver-service`.  
2. `driver-service` dùng `GEOSEARCH` của Redis để tìm tài xế gần nhất và trả về danh sách.  
3. `trip-service` chọn tài xế đầu tiên, cập nhật Trip trong `pg_trip` (gán `driverId` và `status: "DRIVER_FOUND"`).  
4. `trip-service` phát sự kiện `trip:request` qua WebSocket đến tài xế được chọn.  
5. `trip-service` đặt một bộ đếm thời gian (timeout), ví dụ: 60 giây.

### 5.4. Tài xế Phản hồi

#### Flow A: Chấp nhận

1. Tài xế gửi `POST /trips/{id}/accept` đến `trip-service`.  
2. `trip-service` xác thực (đúng tài xế, đúng trạng thái), cập nhật Trip thành `status: "ACCEPTED"`.  
3. `trip-service` phát sự kiện `trip:update` qua WebSocket cho hành khách (báo tin tài xế đã chấp nhận).

#### Flow B: Từ chối / Timeout

1. Tài xế gửi `POST /trips/{id}/reject` **hoặc** bộ đếm thời gian hết hạn.  
2. `trip-service` ghi nhận tài xế này vào bảng `TripRejectedDriver`.  
3. `trip-service` lặp lại bước Tìm kiếm tài xế, nhưng lần này gửi kèm danh sách `excludeDriverIds` để `driver-service` loại trừ.

### 5.5. Hoàn thành chuyến đi

1. Tài xế lần lượt gửi `POST /start` và `POST /complete` đến `trip-service`.  
2. `trip-service` cập nhật trạng thái (`IN_PROGRESS -> COMPLETED`) và thông báo cho hành khách qua WebSocket.

### 5.6. Đánh giá

1. Hành khách gửi `POST /trips/{id}/rating` đến `trip-service`.  
2. `trip-service` kiểm tra (chỉ được đánh giá chuyến đã `COMPLETED`) và lưu `Rating` vào `pg_trip`.

---

## 6. Sơ đồ Kiến trúc Hệ thống (System Architecture)

Sơ đồ dưới đây minh họa kiến trúc microservices của UIT-GO, bao gồm các luồng giao tiếp chính:

```text
+--------------------------------+
|       CLIENT (Mobile App)      |
| (Hành khách / Tài xế)          |
+--------------------------------+
     |                 ^
     | (HTTP API)      | (WebSocket)
     |                 |
+----v-----------------v----------------------------------------------------------------+
|                                  HỆ THỐNG UIT-GO                                      |
|                                (Docker Compose Network)                               |
|                                                                                       |
|  +-----------------------+     +------------------------+     +---------------------+ |
|  |     USER SERVICE      |     |      TRIP SERVICE      |     |   DRIVER SERVICE    | |
|  |     (Port 3000)       |     |      (Port 3002)       |     |     (Port 3001)     | |
|  +-----------------------+     +------------------------+     +---------------------+ |
|     |             |                  |          |         |           |               |
|     |             |       (HTTP)     |          |         |           |               |
|     |             | <----------------+ (1)      |         |           | (3)           |
|     |             |                  |          | (2)     |           |               |
|     | (4)         | (5)              |          +-------->|           |               |
|     |             |                  |                    |           |               |
|  +--v------+   +--v--+           +----v-----+        +---v---+   +---v------+         |
|  | pg_user |   |redis|           |pg_trip   |        | redis |   | redis    |         |
|  |(Postgres)|  |(OTP)|           |(Postgres)|        | (Geo) |   |(Presence)|         |
|  +---------+   +-----+           +----------+        +-------+   +----------+         |
|                                                                                       |
+---------------------------------------------------------------------------------------+
```

### Chú thích luồng giao tiếp

1. `Trip Service` gọi `User Service` (ví dụ: để xác thực token – mặc dù trong code hiện tại là tự xác thực JWT).  
2. `Trip Service` gọi `Driver Service` (qua HTTP) để tìm tài xế (`/drivers/search`).  
3. `Driver Service` đọc/ghi trạng thái (Geo, Presence) vào Redis.  
4. `User Service` đọc/ghi dữ liệu người dùng vào Postgres (`pg_user`).  
5. `User Service` đọc/ghi cache OTP vào Redis.  
6. `Trip Service` đọc/ghi dữ liệu chuyến đi vào Postgres (`pg_trip`).

---

## 7. Cấu trúc Thư mục (Project Structure)

Dự án được tổ chức theo cấu trúc **monorepo**, với mỗi dịch vụ là một thư mục con độc lập trong `services/`.

```text
uit-go/
├── docker-compose.yml     # Định nghĩa và liên kết tất cả các services và DB
├── README.md              # Hướng dẫn chung
├── docs/
│   └── images/            # Hình ảnh minh họa cho README
├── infra/                 # (Dành cho cấu hình hạ tầng, ví dụ Terraform)
│   └── text.txt
└── services/
    ├── driver-service/    # (Service 3001: Quản lý vị trí tài xế)
    │   ├── src/
    │   │   ├── api/         # Định tuyến (routes)
    │   │   ├── controller/  # Xử lý request/response
    │   │   ├── service/     # Logic nghiệp vụ (repo, driver, search)
    │   │   ├── app.ts       # Khởi tạo Express app
    │   │   ├── index.ts     # Entry point, khởi động server
    │   │   └── redis.ts     # Khởi tạo Redis client
    │   ├── Dockerfile
    │   ├── package.json
    │   └── tsconfig.json
    │
    ├── trip-service/      # (Service 3002: Điều phối chuyến đi)
    │   ├── prisma/
    │   │   ├── migrations/   # Lịch sử thay đổi CSDL
    │   │   └── schema.prisma # Định nghĩa schema CSDL (Trip, Rating)
    │   ├── src/
    │   │   ├── controllers/  # Xử lý request/response (trip, health)
    │   │   ├── lib/          # Thư viện dùng chung (axios, emitter)
    │   │   ├── middlewares/  # (auth, error handling)
    │   │   ├── services/     # Logic nghiệp vụ (trip, driver, websocket)
    │   │   ├── app.ts        # Entry point, khởi tạo Express + Socket.io
    │   │   ├── index.ts      # Định tuyến (routes) chính
    │   │   └── ...
    │   ├── Contract.txt      # Hợp đồng API của service
    │   ├── Dockerfile
    │   ├── package.json
    │   └── tsconfig.json
    │
    └── user-service/      # (Service 3000: Quản lý người dùng)
        ├── prisma/
        │   ├── migrations/
        │   └── schema.prisma # Định nghĩa schema CSDL (User, Vehicle)
        ├── src/
        │   ├── controllers/  # (auth, user)
        │   ├── lib/          # (mailer, redis)
        │   ├── middlewares/  # (auth)
        │   ├── routes/       # (auth, users)
        │   ├── utils/        # (otp helpers)
        │   ├── index.js      # Entry point, khởi động server
        │   └── prismaClient.js
        ├── Dockerfile
        └── package.json
```

---
