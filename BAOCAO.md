# BÁO CÁO ĐỒ ÁN: HỆ THỐNG ĐẶT XE UIT-GO

---

## 📋 MỤC LỤC

1. [Giới thiệu đồ án](#1-giới-thiệu-đồ-án)
2. [Mục tiêu và phạm vi](#2-mục-tiêu-và-phạm-vi)
3. [Công nghệ sử dụng](#3-công-nghệ-sử-dụng)
4. [Kiến trúc hệ thống](#4-kiến-trúc-hệ-thống)
5. [Các thành phần chi tiết](#5-các-thành-phần-chi-tiết)
6. [Cơ sở dữ liệu](#6-cơ-sở-dữ-liệu)
7. [Luồng hoạt động chính](#7-luồng-hoạt-động-chính)
8. [API Endpoints](#8-api-endpoints)
9. [Hướng dẫn cài đặt và chạy](#9-hướng-dẫn-cài-đặt-và-chạy)
10. [Kịch bản test](#10-kịch-bản-test)
11. [Kết luận](#11-kết-luận)

---

## 1. Giới thiệu đồ án

### 1.1. Tên đồ án
**UIT-GO** - Hệ thống đặt xe công nghệ (Ride-hailing System)

### 1.2. Bối cảnh
Trong bối cảnh các ứng dụng đặt xe (như Grab, Be, Gojek) ngày càng phổ biến, đồ án này nhằm xây dựng một hệ thống đặt xe hoàn chỉnh sử dụng kiến trúc microservices hiện đại, giúp sinh viên hiểu rõ cách thiết kế và triển khai các hệ thống phân tán.

### 1.3. Tổng quan
UIT-GO là một ứng dụng đặt xe được xây dựng theo kiến trúc **Microservices**, cho phép:
- **Hành khách**: Đăng ký tài khoản, đặt xe, theo dõi chuyến đi theo thời gian thực, hủy chuyến và đánh giá tài xế.
- **Tài xế**: Đăng ký làm tài xế, cập nhật vị trí GPS, nhận và xử lý yêu cầu đặt xe từ hành khách.

---

## 2. Mục tiêu và phạm vi

### 2.1. Mục tiêu
- Xây dựng hệ thống microservices hoàn chỉnh với khả năng mở rộng (scalable).
- Áp dụng các công nghệ hiện đại: Node.js, TypeScript, PostgreSQL, Redis, Docker.
- Triển khai real-time communication qua WebSocket.
- Xử lý vị trí địa lý (geospatial data) với Redis GeoSearch.

### 2.2. Phạm vi
| Chức năng | Mô tả |
|-----------|-------|
| Quản lý người dùng | Đăng ký, đăng nhập, xác thực OTP qua email |
| Quản lý tài xế | Cập nhật vị trí GPS, trạng thái online/offline |
| Đặt xe | Tìm tài xế gần nhất, xử lý chấp nhận/từ chối |
| Real-time | Thông báo trạng thái chuyến đi qua WebSocket |
| Đánh giá | Hành khách đánh giá tài xế sau chuyến đi |

---

## 3. Công nghệ sử dụng

### 3.1. Backend
| Công nghệ | Mục đích sử dụng |
|-----------|------------------|
| **Node.js** | Runtime environment cho JavaScript |
| **Express.js** | Web framework cho API RESTful |
| **TypeScript** | Type-safe JavaScript cho driver-service và trip-service |
| **Prisma** | ORM cho PostgreSQL |
| **Socket.io** | Real-time bidirectional communication |
| **JWT** | Xác thực và phân quyền người dùng |

### 3.2. Database
| Công nghệ | Mục đích sử dụng |
|-----------|------------------|
| **PostgreSQL** | Lưu trữ dữ liệu chính (users, trips, ratings) |
| **Redis** | Cache, OTP, lưu vị trí tài xế (GeoSpatial) |

### 3.3. DevOps
| Công nghệ | Mục đích sử dụng |
|-----------|------------------|
| **Docker** | Container hóa các services |
| **Docker Compose** | Orchestration và quản lý multi-container |
| **Terraform** | Infrastructure as Code (IaC) |

### 3.4. Thư viện hỗ trợ
| Thư viện | Mục đích |
|----------|----------|
| `bcrypt` | Hash password |
| `nodemailer` | Gửi email OTP |
| `ioredis` | Redis client |
| `axios` | HTTP client cho service-to-service communication |

---

## 4. Kiến trúc hệ thống

### 4.1. Tổng quan kiến trúc

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           CLIENT (Mobile App)                           │
│                      (Hành khách / Tài xế)                              │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │
                    ┌──────────┴──────────┐
                    │   HTTP API          │   WebSocket
                    │                     │
┌───────────────────▼─────────────────────▼───────────────────────────────┐
│                         HỆ THỐNG UIT-GO                                 │
│                    (Docker Compose Network)                             │
│                                                                         │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐         │
│  │  USER SERVICE   │  │  TRIP SERVICE   │  │ DRIVER SERVICE  │         │
│  │   (Port 3000)   │  │   (Port 3002)   │  │   (Port 3001)   │         │
│  │                 │  │                 │  │                 │         │
│  │  • Đăng ký      │  │  • Đặt xe       │  │  • Cập nhật     │         │
│  │  • Đăng nhập    │  │  • Quản lý trip │  │    vị trí GPS   │         │
│  │  • Xác thực OTP │  │  • Real-time    │  │  • Tìm tài xế   │         │
│  │  • JWT Token    │  │    WebSocket    │  │    gần nhất     │         │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘         │
│           │                    │                    │                   │
│  ┌────────▼────────┐  ┌────────▼────────┐  ┌────────▼────────┐         │
│  │    PostgreSQL   │  │   PostgreSQL    │  │      Redis      │         │
│  │    (pg_user)    │  │   (pg_trip)     │  │   (GeoSearch)   │         │
│  │                 │  │                 │  │                 │         │
│  │  • Users        │  │  • Trips        │  │  • Vị trí tài xế│         │
│  │  • Vehicles     │  │  • Ratings      │  │  • Trạng thái   │         │
│  │  • Tokens       │  │  • Rejections   │  │    online       │         │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘         │
│                                                                         │
│  ┌─────────────────┐                                                    │
│  │      Redis      │  (Shared for OTP cache)                           │
│  └─────────────────┘                                                    │
└─────────────────────────────────────────────────────────────────────────┘
```

### 4.2. Nguyên tắc thiết kế
- **Database-per-Service**: Mỗi service có database riêng để đảm bảo tính độc lập.
- **Single Responsibility**: Mỗi service chỉ đảm nhận một miền nghiệp vụ cụ thể.
- **Loose Coupling**: Các service giao tiếp qua HTTP API, giảm sự phụ thuộc trực tiếp.

---

## 5. Các thành phần chi tiết

### 5.1. User Service (Port 3000)

**Mô tả**: Quản lý danh tính và xác thực người dùng.

**Chức năng chính**:
- Đăng ký tài khoản (Hành khách / Tài xế)
- Gửi OTP qua email để xác thực
- Đăng nhập và cấp JWT token
- Quản lý thông tin cá nhân và phương tiện (cho tài xế)

**Công nghệ**: Node.js, Express, Prisma, JWT, Nodemailer, Bcrypt

**Database**: PostgreSQL (`pg_user`) + Redis (cache OTP)

**Cấu trúc thư mục**:
```
user-service/
├── src/
│   ├── controllers/    # Xử lý request/response
│   ├── routes/         # Định tuyến API
│   ├── middlewares/    # Middleware xác thực
│   ├── lib/            # Thư viện (mailer, redis)
│   ├── utils/          # Tiện ích (OTP)
│   └── index.js        # Entry point
├── prisma/
│   └── schema.prisma   # Định nghĩa database schema
└── Dockerfile
```

### 5.2. Driver Service (Port 3001)

**Mô tả**: Quản lý vị trí và trạng thái tài xế trong thời gian thực.

**Chức năng chính**:
- Nhận cập nhật vị trí GPS từ tài xế
- Lưu trữ vị trí vào Redis GeoSet
- Tìm kiếm tài xế gần nhất dựa trên tọa độ
- Quản lý trạng thái online/offline với TTL

**Công nghệ**: Node.js, TypeScript, Express, ioredis

**Database**: Redis (GeoSpatial data)

**Cấu trúc thư mục**:
```
driver-service/
├── src/
│   ├── api/            # Định tuyến
│   ├── controller/     # Xử lý request
│   ├── service/        # Logic nghiệp vụ
│   ├── redis.ts        # Redis client
│   └── index.ts        # Entry point
└── Dockerfile
```

### 5.3. Trip Service (Port 3002)

**Mô tả**: Điều phối trung tâm (orchestrator) quản lý toàn bộ vòng đời chuyến đi.

**Chức năng chính**:
- Xử lý yêu cầu đặt xe từ hành khách
- Gọi Driver Service để tìm tài xế gần nhất
- Quản lý state machine của chuyến đi
- Xử lý chấp nhận, từ chối, timeout
- Gửi thông báo real-time qua WebSocket
- Quản lý đánh giá sau chuyến đi

**Công nghệ**: Node.js, TypeScript, Express, Prisma, Socket.io, Axios

**Database**: PostgreSQL (`pg_trip`)

**Cấu trúc thư mục**:
```
trip-service/
├── src/
│   ├── controllers/    # Xử lý request
│   ├── services/       # Logic nghiệp vụ
│   ├── middlewares/    # Auth middleware
│   ├── lib/            # Thư viện (axios, emitter)
│   └── app.ts          # Entry point + Socket.io
├── prisma/
│   └── schema.prisma   # Định nghĩa schema
└── Dockerfile
```

---

## 6. Cơ sở dữ liệu

### 6.1. PostgreSQL - pg_user (User Service)

```
┌─────────────────────────────────────────────────────────────┐
│                         USERS                               │
├─────────────────────────────────────────────────────────────┤
│ id          │ INT (PK, Auto)                                │
│ email       │ VARCHAR (Unique)                              │
│ password    │ VARCHAR (Hashed)                              │
│ name        │ VARCHAR                                        │
│ phone       │ VARCHAR                                        │
│ role        │ ENUM (PASSENGER, DRIVER, ADMIN)               │
│ isVerified  │ BOOLEAN                                        │
│ isActive    │ BOOLEAN                                        │
│ createdAt   │ TIMESTAMP                                      │
│ updatedAt   │ TIMESTAMP                                      │
│ lastLoginAt │ TIMESTAMP                                      │
└─────────────────────────────────────────────────────────────┘
        │
        │ 1:1
        ▼
┌─────────────────────────────────────────────────────────────┐
│                        VEHICLES                             │
├─────────────────────────────────────────────────────────────┤
│ id           │ INT (PK, Auto)                               │
│ userId       │ INT (FK -> Users, Unique)                    │
│ model        │ VARCHAR                                       │
│ licensePlate │ VARCHAR (Unique)                              │
│ color        │ VARCHAR                                       │
└─────────────────────────────────────────────────────────────┘
```

### 6.2. PostgreSQL - pg_trip (Trip Service)

```
┌─────────────────────────────────────────────────────────────┐
│                          TRIPS                              │
├─────────────────────────────────────────────────────────────┤
│ id              │ CUID (PK)                                 │
│ status          │ ENUM (SEARCHING, DRIVER_FOUND, ACCEPTED,  │
│                 │       IN_PROGRESS, COMPLETED, CANCELLED)  │
│ passengerId     │ INT                                       │
│ driverId        │ INT (nullable)                            │
│ fromLocationLat │ FLOAT                                     │
│ fromLocationLng │ FLOAT                                     │
│ fromAddress     │ VARCHAR                                   │
│ toLocationLat   │ FLOAT                                     │
│ toLocationLng   │ FLOAT                                     │
│ toAddress       │ VARCHAR                                   │
│ priceEstimate   │ DECIMAL(10,2)                             │
│ createdAt       │ TIMESTAMP                                 │
│ updatedAt       │ TIMESTAMP                                 │
└─────────────────────────────────────────────────────────────┘
        │
        │ 1:N
        ▼
┌─────────────────────────────────────────────────────────────┐
│                  TRIP_REJECTED_DRIVERS                      │
├─────────────────────────────────────────────────────────────┤
│ id        │ INT (PK, Auto)                                  │
│ tripId    │ CUID (FK -> Trips)                              │
│ driverId  │ INT                                             │
│ createdAt │ TIMESTAMP                                       │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                         RATINGS                             │
├─────────────────────────────────────────────────────────────┤
│ id          │ CUID (PK)                                     │
│ tripId      │ CUID (FK -> Trips, Unique)                    │
│ passengerId │ INT                                           │
│ driverId    │ INT                                           │
│ rating      │ INT (1-5)                                     │
│ comment     │ TEXT                                          │
│ createdAt   │ TIMESTAMP                                     │
└─────────────────────────────────────────────────────────────┘
```

### 6.3. Redis Data Structures

| Key Pattern | Type | Mục đích |
|-------------|------|----------|
| `drivers:locations` | GeoSet | Lưu tọa độ GPS của tài xế |
| `driver:status:{id}` | String | Trạng thái online (với TTL) |
| `otp:{email}` | String | Mã OTP xác thực email |

---

## 7. Luồng hoạt động chính

### 7.1. Luồng đăng ký và xác thực

```
┌─────────┐     ┌──────────────┐     ┌──────────────┐     ┌───────┐
│  User   │     │ User Service │     │    Redis     │     │ Email │
└────┬────┘     └──────┬───────┘     └──────┬───────┘     └───┬───┘
     │                 │                    │                 │
     │ 1. POST /auth/register              │                 │
     │─────────────────►│                   │                 │
     │                 │ 2. Save user       │                 │
     │                 │    (unverified)    │                 │
     │                 │                    │                 │
     │                 │ 3. Generate OTP    │                 │
     │                 │───────────────────►│                 │
     │                 │                    │                 │
     │                 │ 4. Send OTP email  │                 │
     │                 │────────────────────┼────────────────►│
     │                 │                    │                 │
     │◄────────────────│ 5. Return success  │                 │
     │                 │                    │                 │
     │ 6. POST /auth/verify-email          │                 │
     │─────────────────►│                   │                 │
     │                 │ 7. Verify OTP      │                 │
     │                 │───────────────────►│                 │
     │                 │                    │                 │
     │                 │ 8. Mark verified   │                 │
     │                 │    Return JWT      │                 │
     │◄────────────────│                    │                 │
```

### 7.2. Luồng đặt xe (Happy Path)

```
┌───────────┐  ┌──────────────┐  ┌───────────────┐  ┌────────────┐  ┌──────────┐
│ Passenger │  │ Trip Service │  │Driver Service │  │   Redis    │  │  Driver  │
└─────┬─────┘  └──────┬───────┘  └───────┬───────┘  └─────┬──────┘  └────┬─────┘
      │               │                  │                │              │
      │ 1. POST /trips│                  │                │              │
      │──────────────►│                  │                │              │
      │               │ 2. Create trip   │                │              │
      │               │    (SEARCHING)   │                │              │
      │               │                  │                │              │
      │               │ 3. GET /drivers/search           │              │
      │               │─────────────────►│                │              │
      │               │                  │ 4. GEOSEARCH   │              │
      │               │                  │───────────────►│              │
      │               │                  │◄───────────────│              │
      │               │◄─────────────────│ 5. Return nearest driver     │
      │               │                  │                │              │
      │               │ 6. Update trip (DRIVER_FOUND)    │              │
      │               │                  │                │              │
      │               │ 7. WebSocket: trip:request       │              │
      │               │─────────────────────────────────────────────────►│
      │               │                  │                │              │
      │◄──────────────│ 8. Return trip   │                │              │
      │               │                  │                │              │
      │               │                  │                │ 9. POST /trips/{id}/accept
      │               │◄───────────────────────────────────────────────────│
      │               │                  │                │              │
      │               │ 10. Update (ACCEPTED)            │              │
      │               │                  │                │              │
      │ 11. WebSocket:│trip:update       │                │              │
      │◄──────────────│                  │                │              │
```

### 7.3. State Machine - Trạng thái chuyến đi

```
                              ┌──────────────┐
                              │  SEARCHING   │
                              └──────┬───────┘
                                     │
                              Found driver
                                     │
                                     ▼
                              ┌──────────────┐
              ┌───────────────│ DRIVER_FOUND │───────────────┐
              │               └──────┬───────┘               │
         Reject/Timeout              │                   Passenger
              │                  Accept                   Cancel
              │                      │                       │
              │                      ▼                       │
              │               ┌──────────────┐               │
              │    ┌──────────│   ACCEPTED   │──────────┐    │
              │    │          └──────┬───────┘          │    │
              │ Passenger            │               Driver  │
              │  Cancel           Start               Cancel │
              │    │                 │                   │   │
              │    │                 ▼                   │   │
              │    │          ┌──────────────┐          │   │
              │    │          │ IN_PROGRESS  │          │   │
              │    │          └──────┬───────┘          │   │
              │    │                 │                  │   │
              │    │             Complete               │   │
              │    │                 │                  │   │
              │    │                 ▼                  │   │
              │    │          ┌──────────────┐          │   │
              │    │          │  COMPLETED   │          │   │
              │    │          └──────────────┘          │   │
              │    │                                    │   │
              │    └────────────────┬───────────────────┘   │
              │                     │                       │
              │                     ▼                       │
              │               ┌──────────────┐              │
              └──────────────►│  CANCELLED   │◄─────────────┘
                              └──────────────┘
              
              (Nếu Reject/Timeout: Tìm tài xế tiếp theo)
```

---

## 8. API Endpoints

### 8.1. User Service (Port 3000)

| Method | Endpoint | Mô tả | Auth |
|--------|----------|-------|------|
| POST | `/auth/register` | Đăng ký tài khoản mới | ❌ |
| POST | `/auth/verify-email` | Xác thực OTP | ❌ |
| POST | `/auth/login` | Đăng nhập | ❌ |
| GET | `/users/me` | Lấy thông tin người dùng | ✅ |

### 8.2. Driver Service (Port 3001)

| Method | Endpoint | Mô tả | Auth |
|--------|----------|-------|------|
| PUT | `/drivers/{id}/location` | Cập nhật vị trí và trạng thái | ❌ |
| GET | `/drivers/search` | Tìm tài xế gần nhất | ❌ |

### 8.3. Trip Service (Port 3002)

| Method | Endpoint | Mô tả | Auth |
|--------|----------|-------|------|
| POST | `/trips` | Tạo yêu cầu đặt xe | ✅ (Passenger) |
| GET | `/trips/{id}` | Lấy thông tin chuyến đi | ✅ |
| POST | `/trips/{id}/accept` | Tài xế chấp nhận | ✅ (Driver) |
| POST | `/trips/{id}/reject` | Tài xế từ chối | ✅ (Driver) |
| POST | `/trips/{id}/start` | Bắt đầu chuyến đi | ✅ (Driver) |
| POST | `/trips/{id}/complete` | Hoàn thành chuyến đi | ✅ (Driver) |
| POST | `/trips/{id}/cancel` | Hủy chuyến | ✅ (Passenger) |
| POST | `/trips/{id}/rating` | Đánh giá chuyến đi | ✅ (Passenger) |

### 8.4. WebSocket Events

| Event | Direction | Mô tả |
|-------|-----------|-------|
| `trip:request` | Server → Driver | Thông báo yêu cầu chuyến mới |
| `trip:update` | Server → Passenger | Cập nhật trạng thái chuyến |

---

## 9. Hướng dẫn cài đặt và chạy

### 9.1. Yêu cầu hệ thống
- Docker Desktop
- Git
- Postman (để test API)

### 9.2. Cài đặt và khởi động

**Bước 1**: Clone repository
```bash
git clone https://github.com/Yuhel187/uit-go.git
cd uit-go
```

**Bước 2**: Xóa dữ liệu cũ (nếu cần)
```bash
docker-compose down -v
```

**Bước 3**: Build và khởi động
```bash
docker-compose up -d --build
```

**Bước 4**: Chờ khoảng 30 giây để các service sẵn sàng

### 9.3. Kiểm tra hệ thống

Truy cập các endpoint sau để kiểm tra:
- User Service: `http://localhost:3000`
- Driver Service: `http://localhost:3001`
- Trip Service: `http://localhost:3002`

---

## 10. Kịch bản test

### 10.1. Kịch bản A: Happy Path (Đặt xe thành công)

1. **Tạo tài khoản** (1 Passenger, 2 Drivers)
2. **Xác thực OTP** cho cả 3 tài khoản
3. **Tài xế online** - Cập nhật vị trí GPS
4. **Hành khách đặt xe** - Tạo trip
5. **Tài xế chấp nhận** - Accept trip
6. **Tài xế bắt đầu** - Start trip
7. **Tài xế hoàn thành** - Complete trip
8. **Hành khách đánh giá** - Rate trip

### 10.2. Kịch bản B: Tài xế từ chối

1-4. Như kịch bản A
5. **Tài xế 1 từ chối** → Hệ thống tự động tìm Tài xế 2
6. **Tài xế 2 chấp nhận** và tiếp tục flow

### 10.3. Kịch bản C: Timeout

1-4. Như kịch bản A
5. **Không làm gì trong 60 giây** → Hệ thống tự động timeout và tìm tài xế mới

### 10.4. Kịch bản D: Hành khách hủy

1-4. Như kịch bản A
5. **Hành khách hủy chuyến** → Trip chuyển sang CANCELLED

---

## 11. Kết luận

### 11.1. Kết quả đạt được
- ✅ Xây dựng thành công hệ thống microservices với 3 services độc lập
- ✅ Triển khai xác thực OTP qua email
- ✅ Tích hợp real-time communication với WebSocket
- ✅ Sử dụng Redis GeoSearch cho tìm kiếm vị trí
- ✅ Containerize toàn bộ hệ thống với Docker

### 11.2. Điểm mạnh
- **Scalable**: Mỗi service có thể scale độc lập
- **Maintainable**: Code được tổ chức theo domain
- **Modern Stack**: Sử dụng công nghệ hiện đại, phổ biến trong industry

### 11.3. Hướng phát triển
- Thêm API Gateway cho load balancing và rate limiting
- Triển khai message queue (RabbitMQ/Kafka) cho async communication
- Thêm monitoring và logging (ELK Stack)
- Phát triển mobile app (React Native/Flutter)
- Tích hợp thanh toán online

---

## 📚 Tài liệu tham khảo

- [README.md](./README.md) - Hướng dẫn cài đặt và test chi tiết
- [ARCHITECTURE.md](./ARCHITECTURE.md) - Kiến trúc hệ thống chi tiết
- [Trip Service Contract](./services/trip-service/Contract.txt) - API Contract

---

*Đồ án được thực hiện bởi sinh viên UIT*
