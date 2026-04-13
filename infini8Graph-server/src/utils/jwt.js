import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const AUTH_EXCHANGE_EXPIRES_IN = '60s';

if (!JWT_SECRET) {
    throw new Error('JWT_SECRET is not defined in environment variables');
}

/**
 * Generate a JWT token for a user
 * @param {object} payload - The payload to encode
 * @returns {string} - The JWT token
 */
export function generateToken(payload) {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function generateExchangeToken(payload) {
    return jwt.sign(
        {
            type: 'auth_exchange',
            payload,
        },
        JWT_SECRET,
        { expiresIn: AUTH_EXCHANGE_EXPIRES_IN }
    );
}

/**
 * Verify and decode a JWT token
 * @param {string} token - The JWT token to verify
 * @returns {object|null} - The decoded payload or null if invalid
 */
export function verifyToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (error) {
        return null;
    }
}

export function verifyExchangeToken(token) {
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded?.type !== 'auth_exchange' || !decoded?.payload) {
            return null;
        }

        return decoded.payload;
    } catch (error) {
        return null;
    }
}

/**
 * Decode a JWT token without verification
 * @param {string} token - The JWT token to decode
 * @returns {object|null} - The decoded payload or null if invalid
 */
export function decodeToken(token) {
    try {
        return jwt.decode(token);
    } catch (error) {
        return null;
    }
}

export default { generateToken, generateExchangeToken, verifyToken, verifyExchangeToken, decodeToken };
