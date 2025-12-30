// Test validation functions
const xss = require('xss');

function validateRoomCode(code) {
    if (code === null || code === undefined) return null;
    const codeStr = String(code).trim();
    if (!/^\d{4}$/.test(codeStr)) return null;
    return codeStr;
}

function sanitizeNickname(nickname) {
    if (!nickname || typeof nickname !== 'string') return 'Player';
    let clean = xss(nickname.trim());
    clean = clean.substring(0, 20);
    clean = clean.replace(/[<>"'&]/g, '');
    return clean || 'Player';
}

console.log('=== Testing validateRoomCode ===');
console.log('Test "1234":', validateRoomCode('1234'));
console.log('Test 1234 (number):', validateRoomCode(1234));
console.log('Test " 1234 ":', validateRoomCode(' 1234 '));
console.log('Test "ABC":', validateRoomCode('ABC'));
console.log('Test "":', validateRoomCode(''));
console.log('Test null:', validateRoomCode(null));

console.log('\n=== Testing sanitizeNickname ===');
console.log('Test "Anna":', sanitizeNickname('Anna'));
console.log('Test "<script>":', sanitizeNickname('<script>alert(1)</script>'));
console.log('Test "":', sanitizeNickname(''));
console.log('Test null:', sanitizeNickname(null));
console.log('Test undefined:', sanitizeNickname(undefined));
