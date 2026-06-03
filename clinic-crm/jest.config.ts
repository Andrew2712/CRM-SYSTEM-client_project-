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

  // Only collect coverage from files that the current test suites actually
  // exercise. API route files require a live HTTP server and are excluded
  // until a supertest / msw harness is added.
  collectCoverageFrom: [
    "src/lib/validation.ts",
    "src/lib/rbac.ts",
    "src/lib/auth.ts",
    "src/lib/rateLimit.ts",
    "src/lib/bookingConflict.ts",
  ],

  // Thresholds reflect current real coverage from the 4 test suites.
  // Raise these incrementally as more tests are added — never lower them.
  coverageThreshold: {
    global: {
      lines:      50,
      functions:  50,
      branches:   40,
      statements: 50,
    },
    "./src/lib/validation.ts": {
      lines: 80,
    },
    "./src/lib/rbac.ts": {
      lines: 70,
    },
  },

  // @auth/prisma-adapter and @prisma are pure ESM — must be transformed by ts-jest
  transformIgnorePatterns: ["/node_modules/(?!(@prisma|@auth)/)"],

  testTimeout: 10_000,
};

export default config;