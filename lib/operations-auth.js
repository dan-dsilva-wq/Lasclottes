'use strict';

const encoder = new TextEncoder();

const configuredOperationsToken = (value) => {
    const token = String(value || '').trim();
    return token.length >= 32 && token.length <= 256 ? token : '';
};

const bearerToken = (value) => {
    const match = /^Bearer ([A-Za-z0-9._~-]{32,256})$/.exec(String(value || '').trim());
    return match ? match[1] : '';
};

const digest = (value) => globalThis.crypto.subtle.digest('SHA-256', encoder.encode(value));

const operationsAuthorized = async (authorizationHeader, configuredToken) => {
    const expected = configuredOperationsToken(configuredToken);
    if (!expected) return false;
    const supplied = bearerToken(authorizationHeader);
    const [suppliedDigest, expectedDigest] = await Promise.all([
        digest(supplied),
        digest(expected)
    ]);
    const left = new Uint8Array(suppliedDigest);
    const right = new Uint8Array(expectedDigest);
    let difference = supplied ? 0 : 1;
    for (let index = 0; index < left.length; index += 1) {
        difference |= left[index] ^ right[index];
    }
    return difference === 0;
};

module.exports = {
    bearerToken,
    configuredOperationsToken,
    operationsAuthorized
};
