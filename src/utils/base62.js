const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const BASE = BigInt(ALPHABET.length);

export function encodeBase62(num) {
  if (typeof num !== 'bigint' || num < 0n) {
    throw new Error('Input must be a non-negative BigInt.');
  }
  if (num === 0n) {
    return ALPHABET[0];
  }

  let str = '';
  while (num > 0n) {
    const remainder = num % BASE;
    str = ALPHABET[Number(remainder)] + str;
    num /= BASE;
  }
  return str;
}

export function decodeBase62(str) {
  if (typeof str !== 'string' || !/^[0-9a-zA-Z]+$/.test(str)) {
     // Allow empty string to represent 0n or handle as needed
     if (str === '') return 0n;
    throw new Error('Input must be a valid Base62 string.');
  }
  if (str === ALPHABET[0]) {
    return 0n;
  }

  let num = 0n;
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    const value = ALPHABET.indexOf(char);
    if (value === -1) {
       throw new Error(`Invalid character in Base62 string: ${char}`);
    }
    num = num * BASE + BigInt(value);
  }
  return num;
} 