# Dang do

Ngay: 2026-06-02

## Viec con dang do (chi tiet)

2. Email verify va reset password chua hoan thien

- Chua co dich vu gui email
- Dang phai lay token tu DB de test thu cong
- Can implement email service va flow gui token

3. Route refresh token va logout chua co

- Chua khai bao endpoint /auth/refresh-token va /auth/logout
- Can them route + controller + service method neu muon test day du

4. verify-email dang doc token tu body

- Comment noi token tu query string, nhung code dang doc body
- Can chuan hoa lai theo mot cach (body hoac query)
