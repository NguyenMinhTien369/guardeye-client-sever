# Thống kê danh sách API Backend (guardeye-sever)

## 1. Auth (`/auth`)
- `POST /auth/register` : Đăng ký tài khoản mới.
- `POST /auth/login` : Đăng nhập.
- `POST /auth/verify-email` : Xác minh email (gửi token trong body).
- `POST /auth/forgot-password` : Yêu cầu quên mật khẩu (gửi email reset).
- `POST /auth/reset-password` : Đặt lại mật khẩu mới.
- `POST /auth/refresh-token` : Cấp lại cặp token mới từ refresh token.
- `POST /auth/logout` : Đăng xuất (Yêu cầu header `Authorization: Bearer <token>`).

## 2. Children (`/children`)
*Yêu cầu Header: `Authorization: Bearer <token>` cho tất cả các endpoint.*
- `POST /children/` : Tạo hồ sơ trẻ em mới.
- `GET /children/` : Lấy danh sách hồ sơ trẻ em của user hiện tại.
- `GET /children/:id` : Lấy thông tin chi tiết một trẻ em theo ID.
- `PUT /children/:id` : Cập nhật thông tin hồ sơ trẻ em.
- `DELETE /children/:id` : Xóa hồ sơ trẻ em.

## 3. Devices (`/devices` & `/children/:childId/devices`)
*Yêu cầu Header: `Authorization: Bearer <token>` cho tất cả các endpoint.*
- `POST /children/:childId/devices` : Khởi tạo một thiết bị giám sát mới, gắn với ID của trẻ.
- `GET /devices` : Lấy danh sách tất cả các thiết bị.
- `PATCH /devices/:id/pause` : Tạm dừng giám sát thiết bị.
- `PATCH /devices/:id/resume` : Tiếp tục quá trình giám sát thiết bị.
- `DELETE /devices/:id` : Xóa thiết bị khỏi hệ thống.

## 4. Agent (`/agent`)
*Dành riêng cho Desktop Client. Yêu cầu Header: `X-Device-Token: <token>` cho tất cả các endpoint.*
- `POST /agent/sync` : Agent gửi batch events (nhật ký hoạt động) định kỳ lên server.
- `GET /agent/status` : Agent gọi API này định kỳ để kiểm tra trạng thái pause (có bị phụ huynh tạm ngưng hay không).
- `POST /agent/screenshot` : Agent upload ảnh chụp màn hình bằng `multipart/form-data`.

## 5. Screenshots Dashboard (`/screenshots`)
*Yêu cầu Header: `Authorization: Bearer <token>`.*
- `GET /screenshots/device/:deviceId` : Phụ huynh lấy danh sách ảnh chụp màn hình của 1 thiết bị (hỗ trợ query `?dateKey=YYYY-MM-DD&page=1&limit=20`).

## 6. AI (`/ai`)
*Yêu cầu Header: `Authorization: Bearer <token>`.*
- `POST /ai/analyze-url` : Gửi yêu cầu phân tích một đường dẫn (URL) xem có an toàn không.
- `POST /ai/chat` : Tính năng chat/giao tiếp tự nhiên với AI.
