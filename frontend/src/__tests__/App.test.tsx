import React from 'react';
import { render, screen } from '@testing-library/react';
import App from '../App';

test('renders app without crashing', () => {
  render(<App />);
  // If App renders, we assume root element exists
  const el = screen.getByTestId('app-root');
  expect(el).toBeInTheDocument();
});
