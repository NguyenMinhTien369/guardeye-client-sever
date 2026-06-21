import * as fs from "fs";
import * as path from "path";
import {
  ConfigReader,
  ConfigError,
  AgentConfig,
} from "../../src/config/ConfigReader";

// ════════════════════════════════════════════════════════════════════════════════
// MOCK SETUP
//
// Tại sao mock `fs` thay vì đọc file thật?
//  1. Tốc độ — không có I/O thật, test chạy trong microseconds.
//  2. Độc lập — test không phụ thuộc vào file hệ thống của máy CI/CD.
//  3. Kiểm soát — ta tự quy định fs trả về gì, kể cả lỗi permission.
//  4. Deterministic — kết quả luôn nhất quán dù chạy ở đâu.
//
// jest.mock() phải đặt ở TOP-LEVEL (ngoài describe/beforeEach).
// Jest hoists lệnh này lên đầu file trước khi bất kỳ import nào chạy.
// ════════════════════════════════════════════════════════════════════════════════
jest.mock("fs");

// Lấy phiên bản đã được mock của `fs` — mọi method đều là jest.fn()
const mockedFs = jest.mocked(fs);

// ── Fixtures: các config hợp lệ / không hợp lệ dùng chung ──────────────────────

/** Config đầy đủ, hợp lệ — dùng làm "happy path" baseline */
const VALID_CONFIG: AgentConfig = {
  deviceToken: "test-device-token-abc123",
  serverUrl: "https://api.example.com",
  monitoredUsers: ["alice", "bob"],
  syncIntervalMs: 180_000,
  mainLoopIntervalMs: 5_000,
  pausePollIntervalMs: 30_000,
};

/**
 * Helper: tạo JSON string từ một partial object.
 * Dùng để nhanh chóng tạo config thiếu field mà không cần viết lại toàn bộ.
 */
function makeConfigJson(
  overrides: Partial<Record<string, unknown>> = {},
): string {
  return JSON.stringify({ ...VALID_CONFIG, ...overrides });
}

/**
 * Helper: setup mock fs.existsSync + fs.readFileSync trả về content hợp lệ.
 * Gọi trong beforeEach của các nhóm test "happy path".
 */
function mockValidFile(content: string = makeConfigJson()): void {
  mockedFs.existsSync.mockReturnValue(true);
  mockedFs.readFileSync.mockReturnValue(content as unknown as Buffer);
}

// ════════════════════════════════════════════════════════════════════════════════
// TEST SUITE
// ════════════════════════════════════════════════════════════════════════════════

describe("ConfigReader", () => {
  // ── Khai báo instance dùng chung trong suite ──────────────────────────────────
  let reader: ConfigReader;

  // ── beforeEach: chạy TRƯỚC mỗi test trong toàn suite ────────────────────────
  //
  // Mục đích:
  //  - Tạo instance ConfigReader mới → tránh state cũ (cachedConfig) rò rỉ
  //    sang test kế tiếp.
  //  - Không setup mock ở đây vì mỗi describe block có nhu cầu mock khác nhau.
  //
  beforeEach(() => {
    reader = new ConfigReader("/fake/path/config.json");
  });

  // ── afterEach: chạy SAU mỗi test ─────────────────────────────────────────────
  //
  // jest.config.js đã có clearMocks/resetMocks/restoreMocks: true nên
  // Jest tự reset mock sau mỗi test. afterEach ở đây chỉ để minh họa
  // pattern và thêm assert phòng thủ nếu cần.
  //
  afterEach(() => {
    // Không cần gọi thủ công — Jest tự clear nhờ resetMocks: true trong config.
    // Giữ lại block này làm nơi mở rộng sau này (vd: assert side-effect cleanup).
  });

  // ════════════════════════════════════════════════════════════════════════════
  // NHÓM 1: Happy Path — đọc file thành công
  // ════════════════════════════════════════════════════════════════════════════

  describe("load() — Happy Path", () => {
    // beforeEach cục bộ: chỉ chạy cho các test trong nhóm này
    beforeEach(() => {
      mockValidFile();
    });

    it("nên trả về config hợp lệ khi file đúng format", () => {
      const config = reader.load();

      expect(config.deviceToken).toBe(VALID_CONFIG.deviceToken);
      expect(config.serverUrl).toBe(VALID_CONFIG.serverUrl);
      expect(config.monitoredUsers).toEqual(VALID_CONFIG.monitoredUsers);
    });

    it("nên merge default values cho các field optional còn thiếu", () => {
      // Config chỉ có 3 trường bắt buộc, không có interval
      const minimalConfig = JSON.stringify({
        deviceToken: "tok-123",
        serverUrl: "https://example.com",
        monitoredUsers: ["user1"],
      });
      mockValidFile(minimalConfig);

      const config = reader.load();

      // Các giá trị mặc định phải được điền vào
      expect(config.syncIntervalMs).toBe(180_000);
      expect(config.mainLoopIntervalMs).toBe(5_000);
      expect(config.pausePollIntervalMs).toBe(30_000);
    });

    it("nên ghi đè default values khi config có khai báo interval riêng", () => {
      mockValidFile(
        makeConfigJson({
          syncIntervalMs: 60_000,
          mainLoopIntervalMs: 10_000,
        }),
      );

      const config = reader.load();

      expect(config.syncIntervalMs).toBe(60_000);
      expect(config.mainLoopIntervalMs).toBe(10_000);
      // pausePollIntervalMs không override → dùng default
      expect(config.pausePollIntervalMs).toBe(30_000);
    });

    it("nên gọi fs.existsSync đúng 1 lần với path đã truyền vào constructor", () => {
      reader.load();

      expect(mockedFs.existsSync).toHaveBeenCalledTimes(1);
      expect(mockedFs.existsSync).toHaveBeenCalledWith(
        "/fake/path/config.json",
      );
    });

    it("nên gọi fs.readFileSync đúng 1 lần với encoding utf-8", () => {
      reader.load();

      expect(mockedFs.readFileSync).toHaveBeenCalledTimes(1);
      expect(mockedFs.readFileSync).toHaveBeenCalledWith(
        "/fake/path/config.json",
        "utf-8",
      );
    });

    it("nên cho phép đọc config nhiều lần (không cache cứng)", () => {
      // Lần 1
      const config1 = reader.load();
      // Lần 2 — mock vẫn còn hiệu lực
      const config2 = reader.load();

      expect(config1).toEqual(config2);
      // readFileSync phải được gọi 2 lần (mỗi load() gọi 1 lần)
      expect(mockedFs.readFileSync).toHaveBeenCalledTimes(2);
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // NHÓM 2: get() — lấy config sau khi load
  // ════════════════════════════════════════════════════════════════════════════

  describe("get()", () => {
    it("nên throw ConfigError nếu gọi get() trước load()", () => {
      // Không gọi load() → get() phải báo lỗi
      expect(() => reader.get()).toThrow(ConfigError);
      expect(() => reader.get()).toThrow("chưa được load");
    });

    it("nên trả về đúng config sau khi load() thành công", () => {
      mockValidFile();
      reader.load();

      const config = reader.get();

      expect(config.deviceToken).toBe(VALID_CONFIG.deviceToken);
    });

    it("nên trả về cùng một object reference sau nhiều lần get()", () => {
      mockValidFile();
      reader.load();

      // Cùng reference → không tạo object mới mỗi lần get()
      expect(reader.get()).toBe(reader.get());
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // NHÓM 3: File không tồn tại
  // ════════════════════════════════════════════════════════════════════════════

  describe("load() — File không tồn tại", () => {
    // beforeEach: mock existsSync trả về false (file không có trên đĩa)
    beforeEach(() => {
      mockedFs.existsSync.mockReturnValue(false);
    });

    it("nên throw ConfigError với message chứa đường dẫn file", () => {
      expect(() => reader.load()).toThrow(ConfigError);
      expect(() => reader.load()).toThrow("/fake/path/config.json");
    });

    it("nên throw ConfigError với message chứa 'Không tìm thấy'", () => {
      expect(() => reader.load()).toThrow("Không tìm thấy");
    });

    it("nên throw error có name là 'ConfigError' (không phải Error thông thường)", () => {
      let thrownError: unknown;
      try {
        reader.load();
      } catch (err) {
        thrownError = err;
      }

      expect(thrownError).toBeInstanceOf(ConfigError);
      expect((thrownError as ConfigError).name).toBe("ConfigError");
    });

    it("không nên gọi fs.readFileSync khi file không tồn tại", () => {
      try {
        reader.load();
      } catch {
        /* ignore */
      }

      // existsSync đã trả về false → không được tiếp tục đọc file
      expect(mockedFs.readFileSync).not.toHaveBeenCalled();
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // NHÓM 4: fs.readFileSync throw lỗi (permission denied, locked...)
  // ════════════════════════════════════════════════════════════════════════════

  describe("load() — Không thể đọc file (permission denied...)", () => {
    beforeEach(() => {
      mockedFs.existsSync.mockReturnValue(true);
      // Giả lập lỗi OS khi đọc file — vd: EPERM, EACCES
      mockedFs.readFileSync.mockImplementation(() => {
        throw new Error("EACCES: permission denied");
      });
    });

    it("nên throw ConfigError (không phải Error gốc từ fs)", () => {
      expect(() => reader.load()).toThrow(ConfigError);
    });

    it("nên wrap thông điệp lỗi gốc vào ConfigError message", () => {
      expect(() => reader.load()).toThrow("permission denied");
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // NHÓM 5: JSON không hợp lệ (syntax error)
  // ════════════════════════════════════════════════════════════════════════════

  describe("load() — JSON bị lỗi cú pháp", () => {
    beforeEach(() => {
      mockedFs.existsSync.mockReturnValue(true);
    });

    it("nên throw ConfigError khi JSON bị broken (thiếu dấu })", () => {
      mockedFs.readFileSync.mockReturnValue(
        `{ "deviceToken": "abc", "serverUrl": "https://x.com"` as unknown as Buffer,
      );

      expect(() => reader.load()).toThrow(ConfigError);
      expect(() => reader.load()).toThrow("cú pháp JSON");
    });

    it("nên throw ConfigError khi file rỗng", () => {
      mockedFs.readFileSync.mockReturnValue("" as unknown as Buffer);

      expect(() => reader.load()).toThrow(ConfigError);
    });

    it("nên throw ConfigError khi content là plain text (không phải JSON)", () => {
      mockedFs.readFileSync.mockReturnValue(
        "this is not json at all" as unknown as Buffer,
      );

      expect(() => reader.load()).toThrow(ConfigError);
    });

    it("nên throw ConfigError khi root JSON là array thay vì object", () => {
      mockedFs.readFileSync.mockReturnValue(
        `[{ "deviceToken": "abc" }]` as unknown as Buffer,
      );

      expect(() => reader.load()).toThrow(ConfigError);
      expect(() => reader.load()).toThrow("JSON object");
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // NHÓM 6: Thiếu field bắt buộc — deviceToken
  // ════════════════════════════════════════════════════════════════════════════

  describe("load() — Thiếu field bắt buộc: deviceToken", () => {
    beforeEach(() => {
      mockedFs.existsSync.mockReturnValue(true);
    });

    it("nên throw ConfigError khi thiếu deviceToken hoàn toàn", () => {
      mockedFs.readFileSync.mockReturnValue(
        makeConfigJson({ deviceToken: undefined }) as unknown as Buffer,
      );

      expect(() => reader.load()).toThrow(ConfigError);
      expect(() => reader.load()).toThrow("deviceToken");
    });

    it("nên throw ConfigError khi deviceToken là chuỗi rỗng", () => {
      mockedFs.readFileSync.mockReturnValue(
        makeConfigJson({ deviceToken: "" }) as unknown as Buffer,
      );

      expect(() => reader.load()).toThrow(ConfigError);
      expect(() => reader.load()).toThrow("deviceToken");
    });

    it("nên throw ConfigError khi deviceToken là null", () => {
      mockedFs.readFileSync.mockReturnValue(
        makeConfigJson({ deviceToken: null }) as unknown as Buffer,
      );

      expect(() => reader.load()).toThrow(ConfigError);
    });

    it("nên throw ConfigError khi deviceToken là số (sai kiểu)", () => {
      mockedFs.readFileSync.mockReturnValue(
        makeConfigJson({ deviceToken: 12345 }) as unknown as Buffer,
      );

      expect(() => reader.load()).toThrow(ConfigError);
    });

    it("nên throw ConfigError khi deviceToken chỉ có whitespace", () => {
      mockedFs.readFileSync.mockReturnValue(
        makeConfigJson({ deviceToken: "   " }) as unknown as Buffer,
      );

      expect(() => reader.load()).toThrow(ConfigError);
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // NHÓM 7: Thiếu field bắt buộc — serverUrl
  // ════════════════════════════════════════════════════════════════════════════

  describe("load() — Thiếu / sai field: serverUrl", () => {
    beforeEach(() => {
      mockedFs.existsSync.mockReturnValue(true);
    });

    it("nên throw ConfigError khi thiếu serverUrl", () => {
      mockedFs.readFileSync.mockReturnValue(
        makeConfigJson({ serverUrl: undefined }) as unknown as Buffer,
      );

      expect(() => reader.load()).toThrow(ConfigError);
      expect(() => reader.load()).toThrow("serverUrl");
    });

    it("nên throw ConfigError khi serverUrl không bắt đầu bằng http", () => {
      mockedFs.readFileSync.mockReturnValue(
        makeConfigJson({ serverUrl: "ftp://example.com" }) as unknown as Buffer,
      );

      expect(() => reader.load()).toThrow(ConfigError);
    });

    it("nên chấp nhận serverUrl bắt đầu bằng https://", () => {
      mockedFs.readFileSync.mockReturnValue(
        makeConfigJson({
          serverUrl: "https://secure.example.com",
        }) as unknown as Buffer,
      );

      expect(() => reader.load()).not.toThrow();
    });

    it("nên chấp nhận serverUrl bắt đầu bằng http:// (môi trường dev)", () => {
      mockedFs.readFileSync.mockReturnValue(
        makeConfigJson({
          serverUrl: "http://localhost:3000",
        }) as unknown as Buffer,
      );

      expect(() => reader.load()).not.toThrow();
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // NHÓM 8: Thiếu / sai field — monitoredUsers
  // ════════════════════════════════════════════════════════════════════════════

  describe("load() — Thiếu / sai field: monitoredUsers", () => {
    beforeEach(() => {
      mockedFs.existsSync.mockReturnValue(true);
    });

    it("nên throw ConfigError khi monitoredUsers là mảng rỗng", () => {
      mockedFs.readFileSync.mockReturnValue(
        makeConfigJson({ monitoredUsers: [] }) as unknown as Buffer,
      );

      expect(() => reader.load()).toThrow(ConfigError);
      expect(() => reader.load()).toThrow("monitoredUsers");
    });

    it("nên throw ConfigError khi monitoredUsers không phải mảng", () => {
      mockedFs.readFileSync.mockReturnValue(
        makeConfigJson({ monitoredUsers: "alice" }) as unknown as Buffer,
      );

      expect(() => reader.load()).toThrow(ConfigError);
    });

    it("nên throw ConfigError khi monitoredUsers chứa phần tử không phải string", () => {
      mockedFs.readFileSync.mockReturnValue(
        makeConfigJson({ monitoredUsers: ["alice", 123] }) as unknown as Buffer,
      );

      expect(() => reader.load()).toThrow(ConfigError);
    });

    it("nên chấp nhận monitoredUsers có nhiều user hợp lệ", () => {
      mockedFs.readFileSync.mockReturnValue(
        makeConfigJson({
          monitoredUsers: ["alice", "bob", "charlie"],
        }) as unknown as Buffer,
      );

      const config = reader.load();
      expect(config.monitoredUsers).toHaveLength(3);
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // NHÓM 9: Constructor — default config path
  // ════════════════════════════════════════════════════════════════════════════

  describe("Constructor — default config path", () => {
    it("nên dùng config.json ở cwd() khi không truyền path vào constructor", () => {
      mockedFs.existsSync.mockReturnValue(false);
      const defaultReader = new ConfigReader(); // Không truyền path

      try {
        defaultReader.load();
      } catch {
        /* ignore */
      }

      const expectedPath = path.resolve(process.cwd(), "config.json");
      expect(mockedFs.existsSync).toHaveBeenCalledWith(expectedPath);
    });
  });
});
