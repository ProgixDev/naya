jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
jest.mock('expo-haptics', () => ({ impactAsync: jest.fn(async () => {}), selectionAsync: jest.fn(async () => {}), notificationAsync: jest.fn(async () => {}), ImpactFeedbackStyle: {}, NotificationFeedbackType: {} }));
// Icons are decorative in these tests; any Lucide icon renders as an empty View.
jest.mock('lucide-react-native', () => {
  const { View } = require('react-native');
  return new Proxy({}, { get: (_t, name) => (name === '__esModule' ? true : () => require('react').createElement(View, { testID: `icon-${String(name)}` })) });
});
