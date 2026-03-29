import AsyncStorage from '@react-native-async-storage/async-storage';
import { act } from '@testing-library/react-native';
import { useAuthStore, forceLogout } from '../../store/authStore';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

jest.mock('../../lib/api', () => ({
  __esModule: true,
  default: {
    post: jest.fn(),
    get: jest.fn(),
    defaults: { headers: { common: {} } },
  },
}));

import apiClient from '../../lib/api';

const FULL_USER = {
  id: 'u1',
  name: 'Ali',
  email: 'ali@test.com',
  phone: null,
  avatar_url: null,
  is_active: true,
  is_email_verified: true,
  is_phone_verified: false,
  role: 'user',
};

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
  useAuthStore.setState({
    user: null,
    accessToken: null,
    isAuthenticated: false,
    isLoading: false,
  });
});

describe('authStore — initial state', () => {
  it('starts unauthenticated', () => {
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.user).toBeNull();
  });
});

describe('authStore — login', () => {
  it('sets user and isAuthenticated on success', async () => {
    (apiClient.post as jest.Mock).mockResolvedValueOnce({
      data: { access_token: 'tok', refresh_token: 'ref' },
    });
    (apiClient.get as jest.Mock).mockResolvedValueOnce({ data: FULL_USER });

    await act(async () => {
      await useAuthStore.getState().login('ali@test.com', 'pass123');
    });

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.user).toEqual(FULL_USER);
  });

  it('persists access_token to AsyncStorage', async () => {
    (apiClient.post as jest.Mock).mockResolvedValueOnce({
      data: { access_token: 'tok123', refresh_token: 'ref456' },
    });
    (apiClient.get as jest.Mock).mockResolvedValueOnce({ data: FULL_USER });

    await act(async () => {
      await useAuthStore.getState().login('ali@test.com', 'pass123');
    });

    expect(await AsyncStorage.getItem('access_token')).toBe('tok123');
  });

  it('throws and stays unauthenticated on API error', async () => {
    (apiClient.post as jest.Mock).mockRejectedValueOnce(new Error('Unauthorized'));

    await expect(
      useAuthStore.getState().login('bad@test.com', 'wrong')
    ).rejects.toThrow('Unauthorized');

    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });
});

describe('authStore — logout', () => {
  it('clears user state', async () => {
    useAuthStore.setState({ user: FULL_USER, isAuthenticated: true });

    await act(async () => {
      await useAuthStore.getState().logout();
    });

    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().user).toBeNull();
  });

  it('calls AsyncStorage.multiRemove with correct keys', async () => {
    const spy = jest.spyOn(AsyncStorage, 'multiRemove');
    await act(async () => {
      await useAuthStore.getState().logout();
    });
    expect(spy).toHaveBeenCalledWith(['access_token', 'refresh_token', 'user']);
  });
});

describe('authStore — updateUser', () => {
  it('replaces user in state', () => {
    useAuthStore.setState({ user: FULL_USER, isAuthenticated: true });
    const updated = { ...FULL_USER, name: 'Ali Updated' };

    act(() => {
      useAuthStore.getState().updateUser(updated);
    });

    expect(useAuthStore.getState().user?.name).toBe('Ali Updated');
    expect(useAuthStore.getState().user?.email).toBe('ali@test.com');
  });

  it('persists updated user to AsyncStorage', async () => {
    useAuthStore.setState({ user: FULL_USER, isAuthenticated: true });
    const updated = { ...FULL_USER, name: 'Ali Updated' };

    act(() => {
      useAuthStore.getState().updateUser(updated);
    });

    await new Promise((r) => setTimeout(r, 10));
    const stored = await AsyncStorage.getItem('user');
    expect(JSON.parse(stored!).name).toBe('Ali Updated');
  });
});

describe('authStore — loadFromStorage', () => {
  it('restores session when token is valid (server confirms)', async () => {
    await AsyncStorage.multiSet([
      ['access_token', 'stored_tok'],
      ['user', JSON.stringify(FULL_USER)],
    ]);
    (apiClient.get as jest.Mock).mockResolvedValueOnce({ data: FULL_USER });

    await act(async () => {
      await useAuthStore.getState().loadFromStorage();
    });

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.user).toEqual(FULL_USER);
    expect(state.accessToken).toBe('stored_tok');
    expect(state.isLoading).toBe(false);
  });

  it('refreshes user data from server on startup', async () => {
    const freshUser = { ...FULL_USER, name: 'Ali Fresh' };
    await AsyncStorage.multiSet([
      ['access_token', 'stored_tok'],
      ['user', JSON.stringify(FULL_USER)],
    ]);
    (apiClient.get as jest.Mock).mockResolvedValueOnce({ data: freshUser });

    await act(async () => {
      await useAuthStore.getState().loadFromStorage();
    });

    expect(useAuthStore.getState().user?.name).toBe('Ali Fresh');
  });

  it('forces logout when server rejects the stored token (user deleted / DB purged)', async () => {
    await AsyncStorage.multiSet([
      ['access_token', 'stale_tok'],
      ['refresh_token', 'stale_ref'],
      ['user', JSON.stringify(FULL_USER)],
    ]);
    // Server returns 401 — user no longer exists
    (apiClient.get as jest.Mock).mockRejectedValueOnce({ response: { status: 401 } });

    await act(async () => {
      await useAuthStore.getState().loadFromStorage();
    });

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.user).toBeNull();
    expect(state.accessToken).toBeNull();
    expect(state.isLoading).toBe(false);
  });

  it('clears AsyncStorage when server rejects stored token', async () => {
    await AsyncStorage.multiSet([
      ['access_token', 'stale_tok'],
      ['refresh_token', 'stale_ref'],
      ['user', JSON.stringify(FULL_USER)],
    ]);
    (apiClient.get as jest.Mock).mockRejectedValueOnce({ response: { status: 401 } });

    await act(async () => {
      await useAuthStore.getState().loadFromStorage();
    });

    expect(await AsyncStorage.getItem('access_token')).toBeNull();
    expect(await AsyncStorage.getItem('user')).toBeNull();
  });

  it('stays unauthenticated when no token in AsyncStorage', async () => {
    await act(async () => {
      await useAuthStore.getState().loadFromStorage();
    });

    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().isLoading).toBe(false);
    // Should NOT have called the server at all
    expect(apiClient.get as jest.Mock).not.toHaveBeenCalled();
  });
});

describe('authStore — forceLogout', () => {
  it('clears Zustand state', async () => {
    useAuthStore.setState({ user: FULL_USER, isAuthenticated: true, accessToken: 'tok' });

    await act(async () => {
      await forceLogout();
    });

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.user).toBeNull();
    expect(state.accessToken).toBeNull();
    expect(state.isLoading).toBe(false);
  });

  it('clears AsyncStorage', async () => {
    await AsyncStorage.multiSet([
      ['access_token', 'tok'],
      ['refresh_token', 'ref'],
      ['user', JSON.stringify(FULL_USER)],
    ]);

    await act(async () => {
      await forceLogout();
    });

    expect(await AsyncStorage.getItem('access_token')).toBeNull();
    expect(await AsyncStorage.getItem('refresh_token')).toBeNull();
    expect(await AsyncStorage.getItem('user')).toBeNull();
  });
});
