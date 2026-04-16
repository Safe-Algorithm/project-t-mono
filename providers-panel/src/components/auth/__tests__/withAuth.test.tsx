import React from 'react';
import { render, screen } from '@testing-library/react';
import withAuth from '../withAuth';
import { useAuth } from '@/context/UserContext';
import { UserRole } from '@/types/user';

// Mock the useAuth hook
jest.mock('@/context/UserContext', () => ({
  useAuth: jest.fn(),
}));

// Mock the Next.js router
const mockReplace = jest.fn();
jest.mock('next/router', () => ({
  useRouter: () => ({
    replace: mockReplace,
  }),
}));

// A simple component to be wrapped
const TestComponent = () => <div>Protected Content</div>;

describe('withAuth HOC', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows loading state', () => {
    (useAuth as jest.Mock).mockReturnValue({ user: null, isLoading: true });
    const AuthProtectedComponent = withAuth(TestComponent);
    render(<AuthProtectedComponent />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('redirects if user is not authenticated', () => {
    (useAuth as jest.Mock).mockReturnValue({ user: null, isLoading: false });
    const AuthProtectedComponent = withAuth(TestComponent);
    render(<AuthProtectedComponent />);
    expect(mockReplace).toHaveBeenCalledWith('/');
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('redirects if user does not have the required role', () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: { id: '1', name: 'Test User', role: UserRole.NORMAL },
      isLoading: false,
    });
    const AuthProtectedComponent = withAuth(TestComponent, UserRole.SUPER_USER);
    render(<AuthProtectedComponent />);
    expect(mockReplace).toHaveBeenCalledWith('/');
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('renders the component if user is authenticated and has the required role', () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: { id: '1', name: 'Test User', role: UserRole.SUPER_USER },
      isLoading: false,
    });
    const AuthProtectedComponent = withAuth(TestComponent, UserRole.SUPER_USER);
    render(<AuthProtectedComponent />);
    expect(screen.getByText('Protected Content')).toBeInTheDocument();
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
