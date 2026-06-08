# Unit Test Guidelines — Tiêu Chuẩn & Nguyên Tắc Sống Còn

> **Phiên bản:** 1.0.0  
> **Áp dụng cho:** Node.js / TypeScript projects  
> **Đối tượng:** Toàn bộ lập trình viên trong team

---

## Mục lục

1. [Quy Tắc Vàng — Chỉ Test Public API](#1-quy-tắc-vàng--chỉ-test-public-api)
2. [Cấu Trúc Chuẩn — Mô Hình AAA](#2-cấu-trúc-chuẩn--mô-hình-aaa)
3. [Nguyên Tắc Cách Ly — Isolation & Mocking](#3-nguyên-tắc-cách-ly--isolation--mocking)
4. [Quy Ước Đặt Tên — Living Documentation](#4-quy-ước-đặt-tên--living-documentation)
5. [Anti-pattern Cần Tránh](#5-anti-pattern-cần-tránh)

---

## 1. Quy Tắc Vàng — Chỉ Test Public API

> **_Nguyên tắc cốt lõi: Unit test phải kiểm tra hành vi (behavior), không kiểm tra cách triển khai (implementation)._**

### Tại sao không test hàm `private` / `internal`?

Một hàm `private` là **chi tiết triển khai nội bộ** — nó tồn tại để phục vụ logic bên trong module, không phải một cam kết hành vi ra bên ngoài. Khi team refactor nội bộ (tách hàm, đổi thuật toán, gộp logic), các hàm `private` thay đổi liên tục. Nếu test bám vào chúng, mỗi lần refactor sẽ làm **vỡ hàng loạt test mà không có bug thật nào xảy ra** — đây là nhiễu nguy hiểm, làm mất niềm tin vào toàn bộ test suite.

```typescript
// ❌ SAI — Test vào hàm internal, phá vỡ tính đóng gói
// Không có cách trực tiếp test private trong TypeScript,
// nhưng nhiều dev làm theo hướng này bằng cách cast (as any)
import { UserService } from "./user.service";

it("should hash password correctly", () => {
  const service = new UserService() as any;
  // Bám vào chi tiết triển khai nội bộ
  const hash = service._hashPassword("secret123");
  expect(hash).toHaveLength(60);
});

// ✅ ĐÚNG — Test hành vi công khai, không quan tâm nội bộ làm gì
it("should allow login with correct password after registration", async () => {
  const service = new UserService();
  await service.register({ email: "user@test.com", password: "secret123" });
  const result = await service.login({
    email: "user@test.com",
    password: "secret123",
  });
  expect(result.success).toBe(true);
});
```

### Tư duy Hộp Đen (Black-box Thinking)

Hãy tưởng tượng module cần test là một **chiếc máy pha cà phê**: bạn chỉ quan tâm nút bấm nào cho ra cà phê gì — không cần biết bên trong có bao nhiêu bộ phận. Khi nhà sản xuất nâng cấp bộ lọc bên trong, cà phê đầu ra vẫn như cũ và test của bạn **không cần thay đổi**.

Tư duy này mang lại hai lợi ích trực tiếp:

- **Test bền vững (Resilient tests):** Refactor nội bộ không làm vỡ test.
- **Test có giá trị thật:** Nếu test vỡ, đó là dấu hiệu hành vi thật sự đã thay đổi — không phải nhiễu.

---

## 2. Cấu Trúc Chuẩn — Mô Hình AAA

Mỗi test case **bắt buộc** tuân theo ba pha rõ ràng, phân tách bằng dòng trống:

| Pha         | Trách nhiệm                                                                           |
| ----------- | ------------------------------------------------------------------------------------- |
| **Arrange** | Thiết lập toàn bộ điều kiện đầu vào, khởi tạo dependency, cấu hình mock               |
| **Act**     | Gọi đúng một hành động duy nhất cần kiểm tra                                          |
| **Assert**  | Xác nhận kết quả đầu ra, không kiểm tra nhiều hơn những gì liên quan đến hành động đó |

```typescript
import { OrderService } from "./order.service";
import { PaymentGateway } from "./payment.gateway";

describe("OrderService", () => {
  describe("placeOrder", () => {
    it("should return order ID when payment is successful", async () => {
      // --- Arrange ---
      const mockPaymentGateway = {
        charge: jest
          .fn()
          .mockResolvedValue({
            transactionId: "txn_abc123",
            status: "SUCCESS",
          }),
      } as jest.Mocked<Pick<PaymentGateway, "charge">>;

      const orderService = new OrderService(mockPaymentGateway as any);

      const orderPayload = {
        userId: "user_001",
        items: [{ productId: "prod_999", quantity: 2 }],
        totalAmount: 150_000,
      };

      // --- Act ---
      const result = await orderService.placeOrder(orderPayload);

      // --- Assert ---
      expect(result.orderId).toBeDefined();
      expect(result.status).toBe("CONFIRMED");
    });
  });
});
```

### Quy tắc bổ sung cho pha Assert

- **Một test case chỉ assert một kết quả logic duy nhất.** Nếu cần assert nhiều khía cạnh độc lập, hãy tách thành nhiều `it` block riêng.
- Không nhồi nhiều `expect()` không liên quan vào cùng một case chỉ để "tiết kiệm code".

---

## 3. Nguyên Tắc Cách Ly — Isolation & Mocking

> **_Unit test phải chạy được ở bất kỳ môi trường nào, bất kỳ lúc nào, không phụ thuộc vào hạ tầng bên ngoài._**

### Cấm tuyệt đối trong Unit Test

| Không được dùng                        | Lý do                                                                     |
| -------------------------------------- | ------------------------------------------------------------------------- |
| Database thật (MongoDB, PostgreSQL...) | Dữ liệu không ổn định, tốc độ chậm, gây race condition khi chạy song song |
| HTTP API thật (third-party services)   | Phụ thuộc network, quota, uptime của bên ngoài                            |
| File system thật                       | Để lại artifact, không deterministic trên các OS khác nhau                |
| `setTimeout` / `Date.now()` thật       | Làm test chậm, không tái hiện được các edge case về thời gian             |

Những trường hợp trên thuộc về **Integration Test** hoặc **E2E Test** — chúng có môi trường riêng và không được lẫn với Unit Test.

### Mock đúng cách với Jest

```typescript
import { UserRepository } from "./user.repository";
import { UserService } from "./user.service";

// Mock toàn bộ module phụ thuộc
jest.mock("./user.repository");

describe("UserService", () => {
  let userService: UserService;
  let mockUserRepo: jest.Mocked<UserRepository>;

  beforeEach(() => {
    // Reset sạch mock trước mỗi test, tránh state rò rỉ giữa các case
    jest.clearAllMocks();
    mockUserRepo = new UserRepository() as jest.Mocked<UserRepository>;
    userService = new UserService(mockUserRepo);
  });

  it("should throw NotFoundException when user does not exist", async () => {
    // Arrange
    mockUserRepo.findById.mockResolvedValue(null);

    // Act & Assert
    await expect(userService.getProfile("non_existent_id")).rejects.toThrow(
      "User not found",
    );
  });

  it("should return user profile when user exists", async () => {
    // Arrange
    const mockUser = {
      id: "user_001",
      name: "Nguyen Van A",
      email: "a@test.com",
    };
    mockUserRepo.findById.mockResolvedValue(mockUser);

    // Act
    const profile = await userService.getProfile("user_001");

    // Assert
    expect(profile.name).toBe("Nguyen Van A");
    expect(mockUserRepo.findById).toHaveBeenCalledWith("user_001");
  });
});
```

### Phân biệt Mock, Stub, Spy

| Kỹ thuật | Mục đích                                        | Khi nào dùng                                                           |
| -------- | ----------------------------------------------- | ---------------------------------------------------------------------- |
| **Mock** | Thay thế toàn bộ dependency, kiểm soát output   | Khi cần cô lập hoàn toàn module                                        |
| **Stub** | Trả về giá trị cố định, không quan tâm cách gọi | Khi chỉ cần control data flow                                          |
| **Spy**  | Bọc hàm thật, ghi lại cách nó được gọi          | Khi cần verify interaction (số lần gọi, tham số) mà vẫn giữ logic thật |

---

## 4. Quy Ước Đặt Tên — Living Documentation

Test file phải có thể đọc như một **tài liệu đặc tả nghiệp vụ**, không phải như code.

### Cấu trúc phân cấp `describe` / `it`

```
describe('[Tên Class / Module]')
  └── describe('[Tên phương thức / hành vi nhóm]')
        └── it('should [kết quả mong đợi] when [điều kiện / ngữ cảnh]')
```

### Ví dụ minh họa

```typescript
describe('AuthService', () => {
  describe('login', () => {
    it('should return access token when credentials are valid', ...);
    it('should throw UnauthorizedException when password is incorrect', ...);
    it('should throw UnauthorizedException when email does not exist', ...);
    it('should lock account after 5 consecutive failed login attempts', ...);
  });

  describe('refreshToken', () => {
    it('should issue new access token when refresh token is valid', ...);
    it('should throw ForbiddenException when refresh token is expired', ...);
    it('should throw ForbiddenException when refresh token has been revoked', ...);
  });
});
```

Khi chạy `jest --verbose`, output sẽ tự động thành một bản đặc tả có thể đọc được:

```
AuthService
  login
    ✓ should return access token when credentials are valid
    ✓ should throw UnauthorizedException when password is incorrect
    ✓ should lock account after 5 consecutive failed login attempts
  refreshToken
    ✓ should issue new access token when refresh token is valid
    ✓ should throw ForbiddenException when refresh token is expired
```

### Quy tắc đặt tên bắt buộc

- `describe` block: **danh từ** (tên class, module, nhóm hành vi)
- `it` block: **bắt đầu bằng `should`**, mô tả kết quả từ góc độ người dùng / caller
- Không dùng tên hàm kỹ thuật trong `it` (ví dụ: không viết `"should call hashPassword once"`)
- Không viết tắt, không để tên kiểu `"test case 1"`, `"happy path"` mà không giải thích rõ

---

## 5. Anti-pattern Cần Tránh

### Anti-pattern #1 — Test quá nhiều logic trong một case ("God Test")

**Biểu hiện:** Một `it` block có 10+ dòng Arrange, gọi nhiều actions, assert nhiều kết quả không liên quan.

```typescript
// ❌ SAI — Một test làm quá nhiều việc
it("should work correctly", async () => {
  const user = await userService.register({
    email: "a@test.com",
    password: "123",
  });
  expect(user.id).toBeDefined(); // Test register
  const token = await authService.login(user);
  expect(token).toBeTruthy(); // Test login
  const profile = await userService.getProfile(user.id);
  expect(profile.email).toBe("a@test.com"); // Test getProfile
  await userService.deleteAccount(user.id);
  expect(await userService.getProfile(user.id)).toBeNull(); // Test delete
});
```

**Hậu quả:** Khi test fail, không biết bước nào sai. Không tái sử dụng được setup.

```typescript
// ✅ ĐÚNG — Mỗi test chỉ xác nhận một hành vi
it('should return user ID after successful registration', async () => { ... });
it('should return JWT token after successful login', async () => { ... });
it('should return null profile after account deletion', async () => { ... });
```

---

### Anti-pattern #2 — Không reset Mock/State giữa các test ("Test Pollution")

**Biểu hiện:** Không gọi `jest.clearAllMocks()` hoặc `jest.resetAllMocks()` trong `beforeEach`, khiến mock call count và return value của test trước ảnh hưởng sang test sau.

```typescript
// ❌ SAI — Mock không được reset
describe("PaymentService", () => {
  const mockGateway = { charge: jest.fn() };
  const service = new PaymentService(mockGateway);

  it("should call charge once for single item order", async () => {
    mockGateway.charge.mockResolvedValue({ status: "SUCCESS" });
    await service.processOrder(singleItemOrder);
    expect(mockGateway.charge).toHaveBeenCalledTimes(1); // ✓ Pass
  });

  it("should call charge once for another order", async () => {
    mockGateway.charge.mockResolvedValue({ status: "SUCCESS" });
    await service.processOrder(anotherOrder);
    // ❌ FAIL — mock.calls vẫn tích lũy từ test trước, count = 2
    expect(mockGateway.charge).toHaveBeenCalledTimes(1);
  });
});

// ✅ ĐÚNG
beforeEach(() => {
  jest.clearAllMocks(); // Reset call count và instances
  // hoặc jest.resetAllMocks() nếu cần reset cả implementation
});
```

---

### Anti-pattern #3 — Assert vào chi tiết triển khai thay vì kết quả ("Implementation Testing")

**Biểu hiện:** Test kiểm tra hàm nội bộ nào được gọi, bao nhiêu lần, thay vì kiểm tra output thật sự.

```typescript
// ❌ SAI — Bám vào implementation detail
it("should process discount correctly", async () => {
  const spy = jest.spyOn(service as any, "_calculateDiscount");
  await service.checkout(cart);
  // Test chỉ biết _calculateDiscount được gọi, không biết kết quả có đúng không
  expect(spy).toHaveBeenCalledWith(cart.totalAmount, "VIP");
});

// ✅ ĐÚNG — Assert kết quả từ góc nhìn bên ngoài
it("should apply 20% discount for VIP customers", async () => {
  const cart = buildCart({ totalAmount: 100_000, customerTier: "VIP" });
  const result = await service.checkout(cart);
  expect(result.finalAmount).toBe(80_000);
});
```

**Lý do:** Nếu team sau này đổi tên `_calculateDiscount` thành `_applyPromotion`, test đầu tiên vỡ ngay dù không có bug thật. Test thứ hai vẫn xanh vì nó đo hành vi, không đo tên hàm.

---

## Tổng kết nhanh — Checklist trước khi commit

```
[ ] Test chỉ gọi các hàm/method được export (Public API)
[ ] Mỗi test case tuân theo cấu trúc Arrange → Act → Assert
[ ] Không có lời gọi tới DB, HTTP API, hoặc File System thật
[ ] Tất cả dependency bên ngoài đều được mock/stub
[ ] beforeEach có gọi jest.clearAllMocks() hoặc tương đương
[ ] Tên it block bắt đầu bằng "should", mô tả hành vi nghiệp vụ rõ ràng
[ ] Mỗi it block chỉ assert một kết quả logic duy nhất
[ ] Test pass khi chạy độc lập lẫn khi chạy toàn bộ suite
```

---

_Tài liệu này được duy trì bởi Tech Lead team. Mọi đề xuất thay đổi vui lòng mở Pull Request và gắn label `docs:testing`._
