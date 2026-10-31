module.exports = {
  preset: "jest-expo",
  moduleNameMapper: {
    "^@/features/(.*)$": "<rootDir>/src/features/$1",
    "^@/(.*)$": "<rootDir>/$1",
  },
  testPathIgnorePatterns: ["/node_modules/", "/.claude/", "/android/"],
};
