import crypto from "crypto";

function assertHexLen(hex, bytes) {
	if (typeof hex !== "string") throw new Error("Expected hex string");
	if (hex.length !== bytes * 2) throw new Error(`Expected ${bytes} bytes hex`);
	return Buffer.from(hex, "hex");
}

export function getMasterKey(masterKeyHex) {
	return assertHexLen(masterKeyHex, 32);
}

export function encryptWithAes256Gcm({ key, iv, plaintext }) {
	const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
	const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
	const tag = cipher.getAuthTag();
	return { ciphertext, tag };
}

export function decryptWithAes256Gcm({ key, iv, ciphertext, tag }) {
	const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
	decipher.setAuthTag(tag);
	return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

export function wrapDataKey({ masterKey, dataKey }) {
	const wrapIv = crypto.randomBytes(12);
	const { ciphertext: wrappedKey, tag: wrapTag } = encryptWithAes256Gcm({
		key: masterKey,
		iv: wrapIv,
		plaintext: dataKey
	});
	return {
		wrappedKeyHex: wrappedKey.toString("hex"),
		wrapIvHex: wrapIv.toString("hex"),
		wrapTagHex: wrapTag.toString("hex")
	};
}

export function unwrapDataKey({ masterKey, wrappedKeyHex, wrapIvHex, wrapTagHex }) {
	const wrappedKey = Buffer.from(wrappedKeyHex, "hex");
	const wrapIv = Buffer.from(wrapIvHex, "hex");
	const wrapTag = Buffer.from(wrapTagHex, "hex");
	return decryptWithAes256Gcm({ key: masterKey, iv: wrapIv, ciphertext: wrappedKey, tag: wrapTag });
}
