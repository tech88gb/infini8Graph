const EXCHANGE_CODE_TTL_MS = 60 * 1000;
const exchangeStore = new Map();

function cleanupExpiredEntries() {
    const now = Date.now();
    for (const [code, entry] of exchangeStore.entries()) {
        if (entry.expiresAt <= now || entry.used) {
            exchangeStore.delete(code);
        }
    }
}

function generateExchangeCode() {
    return `${Math.random().toString(36).slice(2, 12)}${Date.now().toString(36)}`;
}

export function createAuthExchangeCode(token) {
    cleanupExpiredEntries();

    const code = generateExchangeCode();
    exchangeStore.set(code, {
        token,
        used: false,
        expiresAt: Date.now() + EXCHANGE_CODE_TTL_MS,
    });

    return code;
}

export function consumeAuthExchangeCode(code) {
    cleanupExpiredEntries();

    const entry = exchangeStore.get(code);
    if (!entry) return null;
    if (entry.used || entry.expiresAt <= Date.now()) {
        exchangeStore.delete(code);
        return null;
    }

    entry.used = true;
    exchangeStore.delete(code);
    return entry.token;
}

export default {
    createAuthExchangeCode,
    consumeAuthExchangeCode,
};
