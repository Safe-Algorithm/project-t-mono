import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import Button from '../../components/ui/Button';

jest.mock('react-native-reanimated', () =>
  require('react-native-reanimated/mock')
);

describe('Button', () => {
  it('renders title text', () => {
    const { getByText } = render(<Button title="Book Now" onPress={() => {}} />);
    expect(getByText('Book Now')).toBeTruthy();
  });

  it('calls onPress when tapped', () => {
    const onPress = jest.fn();
    const { getByText } = render(<Button title="Tap Me" onPress={onPress} />);
    fireEvent.press(getByText('Tap Me'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not call onPress when disabled', () => {
    const onPress = jest.fn();
    const { getByText } = render(<Button title="Disabled" onPress={onPress} disabled />);
    fireEvent.press(getByText('Disabled'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('does not call onPress when loading', () => {
    const onPress = jest.fn();
    const { queryByText, getByTestId } = render(
      <Button title="Loading" onPress={onPress} loading testID="btn" />
    );
    fireEvent.press(getByTestId('btn'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('shows loading indicator when loading=true', () => {
    const { queryByText, getByTestId } = render(
      <Button title="Submit" onPress={() => {}} loading testID="btn" />
    );
    expect(queryByText('Submit')).toBeNull();
  });

  it('renders primary variant by default', () => {
    const { getByText } = render(<Button title="Primary" onPress={() => {}} />);
    expect(getByText('Primary')).toBeTruthy();
  });

  it('renders outline variant', () => {
    const { getByText } = render(
      <Button title="Outline" onPress={() => {}} variant="outline" />
    );
    expect(getByText('Outline')).toBeTruthy();
  });

  it('renders danger variant', () => {
    const { getByText } = render(
      <Button title="Delete" onPress={() => {}} variant="danger" />
    );
    expect(getByText('Delete')).toBeTruthy();
  });

  it('renders small size', () => {
    const { getByText } = render(
      <Button title="Small" onPress={() => {}} size="sm" />
    );
    expect(getByText('Small')).toBeTruthy();
  });

  it('renders large size', () => {
    const { getByText } = render(
      <Button title="Large" onPress={() => {}} size="lg" />
    );
    expect(getByText('Large')).toBeTruthy();
  });
});
