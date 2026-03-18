require('dotenv').config();

module.exports = ({ config }) => ({
  ...config,
  extra: {
    ...config.extra,
    EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL,
    EXPO_PUBLIC_MOYASAR_PUBLISHABLE_KEY: process.env.EXPO_PUBLIC_MOYASAR_PUBLISHABLE_KEY,
  },
});