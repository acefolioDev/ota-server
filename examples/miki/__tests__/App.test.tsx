/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Text } from 'react-native';
import App from '../App';

test('shows and switches between the three app screens', async () => {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(<App />);
  });

  expect(renderer.root.findAllByType(Text).some(text => text.props.children === 'Your notes')).toBe(true);

  await ReactTestRenderer.act(() => {
    renderer.root
      .findByProps({ accessibilityLabel: 'Open Pinned screen' })
      .props.onPress();
  });
  expect(renderer.root.findAllByType(Text).some(text => text.props.children === 'Pinned')).toBe(true);

  await ReactTestRenderer.act(() => {
    renderer.root
      .findByProps({ accessibilityLabel: 'Open Settings screen' })
      .props.onPress();
  });
  expect(renderer.root.findAllByType(Text).some(text => text.props.children === 'Keep Miki up to date')).toBe(true);

  await ReactTestRenderer.act(() => {
    renderer.root
      .findByProps({ accessibilityLabel: 'Open About screen' })
      .props.onPress();
  });
  expect(renderer.root.findAllByType(Text).some(text => text.props.children === 'About')).toBe(true);
});
