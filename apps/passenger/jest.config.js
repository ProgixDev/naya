/** Component interaction tests for the shared mobile UI kit and passenger hooks. */
module.exports = {
  preset: 'jest-expo/ios',
  // Reanimated 4: Worklets' resolver picks its JS implementation instead of the native module.
  resolver: 'react-native-worklets/jest/resolver',
  roots: ['<rootDir>/src', '<rootDir>/../../packages/ui/src'],
  testMatch: ['**/__tests__/**/*.test.tsx'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|react-native-svg|lucide-react-native|nativewind|react-native-css-interop|@naya/.*|@tanstack/.*|zustand))',
  ],
};
