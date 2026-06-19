/**
 * Simple, self-contained XOR obfuscation with base64 URL-safe encoding.
 * This replaces the Jasypt PBEWithMD5AndDES encryption from the Spring Boot backend.
 */
const SECRET_KEY = "YinYang";

export function encryptId(id: string | number): string {
  const input = String(id);
  let result = "";
  for (let i = 0; i < input.length; i++) {
    const charCode = input.charCodeAt(i) ^ SECRET_KEY.charCodeAt(i % SECRET_KEY.length);
    result += String.fromCharCode(charCode);
  }
  // Base64 URL Safe encoding
  const b64 = btoa(unescape(encodeURIComponent(result)));
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decryptId(encrypted: string): string {
  // Restore standard base64 from URL-safe
  let base64 = encrypted.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  try {
    const raw = decodeURIComponent(escape(atob(base64)));
    let result = "";
    for (let i = 0; i < raw.length; i++) {
      const charCode = raw.charCodeAt(i) ^ SECRET_KEY.charCodeAt(i % SECRET_KEY.length);
      result += String.fromCharCode(charCode);
    }
    return result;
  } catch (e) {
    console.error("Failed to decrypt ID", e);
    return "";
  }
}
