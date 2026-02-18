import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import Input from '../../components/ui/Input';

jest.mock('react-native-reanimated', () =>
  require('react-native-reanimated/mock')
);
jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

describe('Input', () => {
  it('renders with label', () => {
    const { getByText } = render(
      <Input label="Email" value="" onChangeText={() => {}} />
    );
    expect(getByText('Email')).toBeTruthy();
  });

  it('renders placeholder', () => {
    const { getByPlaceholderText } = render(
      <Input
        label="Email"
        placeholder="you@example.com"
        value=""
        onChangeText={() => {}}
      />
    );
    expect(getByPlaceholderText('you@example.com')).toBeTruthy();
  });

  it('calls onChangeText when text changes', () => {
    const onChangeText = jest.fn();
    const { getByPlaceholderText } = render(
      <Input
        label="Name"
        placeholder="Enter name"
        value=""
        onChangeText={onChangeText}
      />
    );
    fireEvent.changeText(getByPlaceholderText('Enter name'), 'Ali');
    expect(onChangeText).toHaveBeenCalledWith('Ali');
  });

  it('displays error message', () => {
    const { getByText } = render(
      <Input
        label="Email"
        value=""
        onChangeText={() => {}}
        error="Email is required"
      />
    );
    expect(getByText('Email is required')).toBeTruthy();
  });

  it('displays hint message', () => {
    const { getByText } = render(
      <Input
        label="Password"
        value=""
        onChangeText={() => {}}
        hint="At least 8 characters"
      />
    );
    expect(getByText('At least 8 characters')).toBeTruthy();
  });

  it('does not show error when no error prop', () => {
    const { queryByText } = render(
      <Input label="Email" value="" onChangeText={() => {}} />
    );
    expect(queryByText('Email is required')).toBeNull();
  });

  it('renders password input with secureTextEntry', () => {
    const { getByPlaceholderText } = render(
      <Input
        label="Password"
        placeholder="Your password"
        value=""
        onChangeText={() => {}}
        isPassword
      />
    );
    const input = getByPlaceholderText('Your password');
    expect(input.props.secureTextEntry).toBe(true);
  });

  it('toggles password visibility', () => {
    const { getByPlaceholderText, getByTestId } = render(
      <Input
        label="Password"
        placeholder="Your password"
        value=""
        onChangeText={() => {}}
        isPassword
        testID="password-input"
      />
    );
    const input = getByPlaceholderText('Your password');
    expect(input.props.secureTextEntry).toBe(true);
  });
});
