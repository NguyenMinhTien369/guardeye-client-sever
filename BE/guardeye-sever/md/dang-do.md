# Dang do

Ngay: 2026-06-02

## Viec con dang do (chi tiet)

1) Cau hinh bien moi truong chua khop
- .env dang dung ACCESS_TOKEN_SECRET/REFRESH_TOKEN_SECRET
- Code can JWT_ACCESS_SECRET/JWT_REFRESH_SECRET
- Can doi ten bien trong .env (hoac sua env.ts de doc ca hai kieu)

2) Email verify va reset password chua hoan thien
- Chua co dich vu gui email
- Dang phai lay token tu DB de test thu cong
- Can implement email service va flow gui token

3) Route refresh token va logout chua co
- Chua khai bao endpoint /auth/refresh-token va /auth/logout
- Can them route + controller + service method neu muon test day du

4) verify-email dang doc token tu body
- Comment noi token tu query string, nhung code dang doc body
- Can chuan hoa lai theo mot cach (body hoac query)

5) Postman test phu thuoc config
- Can dam bao baseUrl dung, server chay ok, DB ket noi
- Can cap nhat bien moi truong trong Postman neu thay doi
