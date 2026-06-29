/** @type {import('jest').Config} */
module.exports = {
  // ── Môi trường & Transform ──────────────────────────────────────────────────

  // ts-jest biên dịch TypeScript on-the-fly, không cần build trước khi test
  preset: "ts-jest",

  // Node environment — phù hợp cho backend service (không phải browser)
  testEnvironment: "node",

  // ── Đường dẫn ───────────────────────────────────────────────────────────────

  // Jest chỉ tìm test trong thư mục tests/ — tránh nhặt nhầm file trong dist/
  roots: ["<rootDir>/tests"],

  // Pattern nhận diện file test — bắt cả .test.ts và .spec.ts
  testMatch: ["**/*.test.ts", "**/*.spec.ts"],

  // Map alias "@/" → "src/" (nếu sau này dùng path alias trong tsconfig)
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },

  // ── ts-jest options ──────────────────────────────────────────────────────────

  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        // Dùng tsconfig riêng cho test — bao gồm cả thư mục tests/
        // và bật isolatedModules → tăng tốc compile đáng kể
        tsconfig: "tsconfig.test.json",
      },
    ],
  },

  // ── Coverage ─────────────────────────────────────────────────────────────────

  // Chỉ đo coverage trên source thật, loại bỏ install script & entry point
  collectCoverageFrom: [
    "src/**/*.ts",
    "!src/service/install.ts", // Script CLI, không phải logic nghiệp vụ
    "!src/index.ts", // Entry point chứa side-effect, test riêng
    "!src/**/*.d.ts",
  ],

  // Ngưỡng coverage tối thiểu — CI sẽ fail nếu không đạt
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },

  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov", "html"],

  // ── Miscellaneous ─────────────────────────────────────────────────────────────

  // Hiển thị tên từng test case khi chạy — dễ debug hơn
  verbose: true,

  // Tự động reset mock sau mỗi test — tránh state leak giữa các test
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
};
