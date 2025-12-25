// src/polyfills.js
import process from 'process';
import { Buffer } from 'buffer';

if (typeof window !== 'undefined') {
  if (typeof window.process === 'undefined') {
    window.process = process;
  }
  if (typeof window.Buffer === 'undefined') {
    window.Buffer = Buffer;
  }
}
