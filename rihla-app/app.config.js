import 'dotenv/config';

export default ({ config }) => ({
  ...config,
  extra: {
    router: {},
    eas: {
      projectId: 'f998b35d-5781-43cf-8591-fee070fbd5bb',
    },
    EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL,
    EXPO_PUBLIC_MOYASAR_PUBLISHABLE_KEY: process.env.EXPO_PUBLIC_MOYASAR_PUBLISHABLE_KEY,
  },
});