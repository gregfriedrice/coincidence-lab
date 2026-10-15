/**
 * Zener symbols metadata, SVG generator, and cryptographic randomness utilities.
 */

const ZENER_SYMBOLS = [
    { id: 0, name: 'Circle' },
    { id: 1, name: 'Cross'  },
    { id: 2, name: 'Waves'  },
    { id: 3, name: 'Square' },
    { id: 4, name: 'Star'   },
];

/**
 * Returns an inline SVG string for a given Zener symbol.
 * @param {number} id - Symbol ID (0 to 4)
 * @param {string} sizeClass - Tailwind sizing class (e.g. 'w-10 h-10', 'w-20 h-20')
 * @returns {string} SVG HTML string
 */
function getSymbolSvg(id, sizeClass = 'w-10 h-10') {
    switch (id) {
        case 0:
            return `<svg class="${sizeClass}" viewBox="0 0 48 48"><circle cx="24" cy="24" r="16" stroke="white" stroke-width="3.5" fill="none"/></svg>`;
        case 1:
            return `<svg class="${sizeClass}" viewBox="0 0 48 48"><path d="M24 10v28M10 24h28" stroke="white" stroke-width="3.5" stroke-linecap="round"/></svg>`;
        case 2:
            return `<svg class="${sizeClass}" viewBox="0 0 48 48"><path d="M8 15c5-4 10 4 16 0s11-4 16 0M8 24c5-4 10 4 16 0s11-4 16 0M8 33c5-4 10 4 16 0s11-4 16 0" stroke="white" stroke-width="3" fill="none" stroke-linecap="round"/></svg>`;
        case 3:
            return `<svg class="${sizeClass}" viewBox="0 0 48 48"><rect x="11" y="11" width="26" height="26" stroke="white" stroke-width="3.5" fill="none" rx="2"/></svg>`;
        case 4:
            return `<svg class="${sizeClass}" viewBox="0 0 48 48"><polygon points="24,6 29.5,18.5 43,20 33.5,29.5 36,43 24,36.5 12,43 14.5,29.5 5,20 18.5,18.5" fill="white"/></svg>`;
        default:
            return '';
    }
}

/**
 * Cryptographically uniform Fisher-Yates array shuffle.
 * @param {Array} arr
 * @returns {Array} Shuffled copy
 */
function cryptoShuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const buf = new Uint32Array(1);
        window.crypto.getRandomValues(buf);
        const j = buf[0] % (i + 1);
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

/**
 * Generates an unambiguous alphanumeric room code (no I, O, 0, 1).
 * @param {number} len - Code length (default 4)
 * @returns {string} Room code
 */
function generateRoomCode(len = 4) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const buf = new Uint32Array(len);
    window.crypto.getRandomValues(buf);
    return Array.from(buf).map(n => chars[n % chars.length]).join('');
}
