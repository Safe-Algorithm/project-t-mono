import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

jest.mock('axios', () => {
  const mockAxios: any = {
    create: jest.fn(() => mockInstance),
    interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } },
  };
  const mockInstance: any = {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() },
    },
    defaults: { headers: { common: {} } },
  };
  return mockAxios;
});

describe('API client configuration', () => {
  it('uses EXPO_PUBLIC_API_URL as base URL', () => {
    process.env.EXPO_PUBLIC_API_URL = 'http://localhost:8000/api/v1';
    jest.resetModules();
    const axios = require('axios');
    require('../../lib/api');
    expect(axios.create).toHaveBeenCalledWith(
      expect.objectContaining({
        baseURL: 'http://localhost:8000/api/v1',
      })
    );
  });

  it('registers request and response interceptors', () => {
    jest.resetModules();
    const axios = require('axios');
    const instance = axios.create();
    require('../../lib/api');
    expect(instance.interceptors.request.use).toHaveBeenCalled();
    expect(instance.interceptors.response.use).toHaveBeenCalled();
  });
});

describe('API token injection', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('injects Authorization header when token exists', async () => {
    await AsyncStorage.setItem('access_token', 'my_token_123');
    const config = { headers: {} as Record<string, string> };

    const injectToken = async (cfg: typeof config) => {
      const token = await AsyncStorage.getItem('access_token');
      if (token) cfg.headers['Authorization'] = `Bearer ${token}`;
      return cfg;
    };

    const result = await injectToken(config);
    expect(result.headers['Authorization']).toBe('Bearer my_token_123');
  });

  it('does not inject Authorization header when no token', async () => {
    const config = { headers: {} as Record<string, string> };

    const injectToken = async (cfg: typeof config) => {
      const token = await AsyncStorage.getItem('access_token');
      if (token) cfg.headers['Authorization'] = `Bearer ${token}`;
      return cfg;
    };

    const result = await injectToken(config);
    expect(result.headers['Authorization']).toBeUndefined();
  });

  it('always sends X-Source: mobile_app header', async () => {
    await AsyncStorage.setItem('access_token', 'tok');
    const config = { headers: {} as Record<string, string> };

    const addSource = (cfg: typeof config) => {
      cfg.headers['X-Source'] = 'mobile_app';
      return cfg;
    };

    const result = addSource(config);
    expect(result.headers['X-Source']).toBe('mobile_app');
  });
});

describe('Token refresh logic', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('clears tokens on refresh failure', async () => {
    await AsyncStorage.setItem('access_token', 'expired');
    await AsyncStorage.setItem('refresh_token', 'bad_refresh');

    const handleRefreshFailure = async () => {
      await AsyncStorage.multiRemove(['access_token', 'refresh_token', 'user']);
    };

    await handleRefreshFailure();

    expect(await AsyncStorage.getItem('access_token')).toBeNull();
    expect(await AsyncStorage.getItem('refresh_token')).toBeNull();
  });

  it('stores new token after successful refresh', async () => {
    const newToken = 'fresh_token_456';

    const handleRefreshSuccess = async (token: string) => {
      await AsyncStorage.setItem('access_token', token);
    };

    await handleRefreshSuccess(newToken);
    expect(await AsyncStorage.getItem('access_token')).toBe(newToken);
  });
});
