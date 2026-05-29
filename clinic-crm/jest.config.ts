import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",

  // ✅ New way — replaces deprecated globals block
  transform: {
    "^.+\\.tsx?$": ["ts-jest", {
      tsconfig: "tsconfig.test.json"
    }]
  },

  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },

  testMatch: ["**/__tests__/**/*.test.ts"],

  collectCoverageFrom: [
    "src/lib/**/*.ts",
    "src/app/api/**/*.ts",
    "!src/**/*.d.ts",
  ],

  transformIgnorePatterns: ["/node_modules/(?!(@prisma)/)"],

  testTimeout: 10_000,
};

export default config;