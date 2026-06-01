import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",

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

  // @auth/prisma-adapter and @prisma are pure ESM — must be transformed by ts-jest
  transformIgnorePatterns: ["/node_modules/(?!(@prisma|@auth)/)"],

  testTimeout: 10_000,
};

export default config;