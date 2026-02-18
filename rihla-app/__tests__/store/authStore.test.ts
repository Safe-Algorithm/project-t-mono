import AsyncStorage from '@react-native-async-storage/async-storage';
import { act } from '@testing-library/react-native';
import { useAuthStore } from '../../store/authStore';

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
  it('restores session when token exists in AsyncStorage', async () => {
    await AsyncStorage.multiSet([
      ['access_token', 'stored_tok'],
      ['user', JSON.stringify(FULL_USER)],
    ]);

    await act(async () => {
      await useAuthStore.getState().loadFromStorage();
    });

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.user).toEqual(FULL_USER);
    expect(state.accessToken).toBe('stored_tok');
  });

  it('stays unauthenticated when no token in AsyncStorage', async () => {
    await act(async () => {
      await useAuthStore.getState().loadFromStorage();
    });

    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().user).toBeNull();
  });
});
