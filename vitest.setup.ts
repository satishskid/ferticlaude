import '@testing-library/jest-dom';
import { TextDecoder, TextEncoder } from 'util';

// Ensure TextEncoder/TextDecoder exist in the JSDOM environment when running tests.
if (!global.TextEncoder) {
  global.TextEncoder = TextEncoder;
  global.TextDecoder = TextDecoder as unknown as typeof global.TextDecoder;
}
