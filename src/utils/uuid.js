const UUID_FORMAT = [
    8, 4, 4, 4, 12
];

// Constants for 128-bit operations
const BIT_COUNT = 128n;
const HALF_BIT_COUNT = 64n;
const MAX_UUID_VAL = (1n << BIT_COUNT) - 1n;
const MAX_HALF_VAL = (1n << HALF_BIT_COUNT) - 1n;
const NUM_ROUNDS = 16; // Increased rounds for potentially better mixing

// --- Feistel Network Helpers ---

// Use different constants for the 64-bit round function
const K1 = 0xDEADBEEFCAFEF00Dn;
const K2 = 0x1234567890ABCDEFn;
const K3 = 0xF0E1D2C3B4A50617n;
const K4 = 0x7E5A3C1B8D6F4E29n;
const R64_1 = 31; // Rotation amount for 64-bit
const R64_2 = 17; // Rotation amount for 64-bit

// Simple 64-bit rotation (modify existing ones or create new)
function rotateLeft64(value, shift) {
    const s = BigInt(shift) % HALF_BIT_COUNT;
    if (s === 0n) return value;
    const val = value & MAX_HALF_VAL;
    const left = (val << s) & MAX_HALF_VAL;
    const right = val >> (HALF_BIT_COUNT - s);
    return left | right;
}

// Enhanced 64-bit Feistel round function (F)
// Takes a 64-bit value and a round index
function feistelRoundFn(r_half, roundIndex) {
    let x = r_half & MAX_HALF_VAL;
    const roundKey = K1 ^ BigInt(roundIndex);

    x = x ^ roundKey;
    x = (x + K2) & MAX_HALF_VAL; // Modular add 2^64
    x = rotateLeft64(x, R64_1);
    x = x ^ K3;
    x = (x + K4) & MAX_HALF_VAL;
    x = rotateLeft64(x, R64_2);
    return x;
}

// --- Core Derivation/Finding Functions (Feistel Network) ---

export function deriveUUIDFromLocation(locationId) {
    let val = locationId & MAX_UUID_VAL;

    // Split into L and R halves
    let L = val >> HALF_BIT_COUNT;
    let R = val & MAX_HALF_VAL;

    // Apply Feistel rounds
    for (let i = 0; i < NUM_ROUNDS; i++) {
        const F_out = feistelRoundFn(R, i);
        const temp = L ^ F_out;
        L = R;
        R = temp;
    }

    // Combine halves (Note: final swap is implicitly handled by how we start/end)
    return (L << HALF_BIT_COUNT) | R;
}

export function findLocationFromUUID(uuidBigInt) {
    if (typeof uuidBigInt !== 'bigint' || uuidBigInt < 0n || uuidBigInt > MAX_UUID_VAL) {
        console.error("Invalid input BigInt for finding location: ", uuidBigInt);
        return 0n;
    }
    let val = uuidBigInt & MAX_UUID_VAL;

    // Split into L and R halves (these are the *final* L/R from derive)
    let L = val >> HALF_BIT_COUNT;
    let R = val & MAX_HALF_VAL;

    // Apply inverse Feistel rounds (iterate backwards)
    for (let i = NUM_ROUNDS - 1; i >= 0; i--) {
        const F_out = feistelRoundFn(L, i); // Need F(L) to reverse
        const temp = R ^ F_out;
        R = L;
        L = temp;
    }

    // Combine halves to get original locationId
    return (L << HALF_BIT_COUNT) | R;
}

// --- V4 Bit Forcing ---

// Masks to clear and set V4 bits
// Version bits (clear bits 12-15 of time_hi_and_version, counting 0-15 from left)
// Hex: 00000000-0000-X000-Y000-000000000000
// Bit positions (from LSB=0): Clear bits 76-79 (0xF000 shifted left by 64)
// Version 4 (0100): Set bit 78 (0x4000 shifted left by 64)
const VERSION_MASK = ~(0xF000n << (64n)); // Use ~ for NOT on BigInt
const VERSION_4_BITS = 0x4000n << 64n;

// Variant bits (clear bits 6-7 of clock_seq_hi_reserved, counting 0-7 from left)
// Hex: 00000000-0000-0000-X000-000000000000
// Bit positions (from LSB=0): Clear bits 64-65 (0xC0 shifted left by 56)
// Variant 1 (10xx): Set bit 65 (0x80 shifted left by 56)
const VARIANT_MASK = ~(0xC0n << 56n);
const VARIANT_1_BITS = 0x80n << 56n;

// Forces V4 and Variant 1 bits onto a 128-bit BigInt
export function forceV4Bits(uuidBigInt) {
    let result = uuidBigInt & MAX_UUID_VAL;
    result &= VERSION_MASK;
    result |= VERSION_4_BITS;
    result &= VARIANT_MASK;
    result |= VARIANT_1_BITS;
    return result;
}

// --- Formatting and Parsing --- (Keep existing functions)

export function formatBigIntAsUUID(num) {
    if (typeof num !== 'bigint' || num < 0n || num > MAX_UUID_VAL) {
        console.error("Invalid input for UUID formatting: ", num);
        return '00000000-0000-0000-0000-000000000000';
    }
    const hex = num.toString(16).padStart(32, '0');
    let uuid = '';
    let currentPos = 0;
    for (let i = 0; i < UUID_FORMAT.length; i++) {
        const len = UUID_FORMAT[i];
        uuid += hex.substring(currentPos, currentPos + len);
        currentPos += len;
        if (i < UUID_FORMAT.length - 1) {
            uuid += '-';
        }
    }
    return uuid;
}

export function parseUUIDtoBigInt(uuid) {
    if (typeof uuid !== 'string') {
        return null;
    }
    const hex = uuid.replace(/-/g, '');
    if (hex.length !== 32 || !/^[0-9a-fA-F]+$/.test(hex)) {
         console.error("Invalid UUID string for parsing: ", uuid);
         return null;
    }
    return BigInt(`0x${hex}`);
}