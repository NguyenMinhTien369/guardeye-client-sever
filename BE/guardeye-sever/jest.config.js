const { createDefaultPreset } = require("ts-jest");

const tsJestTransformCfg = createDefaultPreset().transform;

/** @type {import("jest").Config} **/
module.exports = {
  testEnvironment: "node",
  transform: {
    ...tsJestTransformCfg,
  },

  // Bổ sung: Chỉ quét file test trong thư mục test/
  roots: ["<rootDir>/test"],

  // Bổ sung: Tự động xóa lịch sử của các Mock function sau mỗi bài test
  clearMocks: true,
};
