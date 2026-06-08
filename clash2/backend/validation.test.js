/**
 * validation.test.js
 * Automated unit test suite to verify backend/validation.js functions under normal and adversarial payloads.
 */

const {
    isString,
    isNumber,
    isInteger,
    isBoolean,
    validateString,
    validateNumber,
    validateInteger,
    validateBody
} = require('./validation');

const assert = (condition, message) => {
    if (!condition) {
        throw new Error(`Assertion failed: ${message}`);
    }
};

const runTests = () => {
    console.log('🧪 Starting validation unit tests...');

    // 1. Test isString
    console.log('  - Testing isString');
    assert(isString('hello') === true, 'string should be true');
    assert(isString('') === true, 'empty string should be true');
    assert(isString(123) === false, 'number should not be string');
    assert(isString(null) === false, 'null should not be string');
    assert(isString(undefined) === false, 'undefined should not be string');
    assert(isString({}) === false, 'object should not be string');

    // 2. Test isNumber
    console.log('  - Testing isNumber');
    assert(isNumber(123) === true, 'integer should be number');
    assert(isNumber(12.34) === true, 'float should be number');
    assert(isNumber(0) === true, 'zero should be number');
    assert(isNumber(NaN) === false, 'NaN is not a valid finite number');
    assert(isNumber(Infinity) === false, 'Infinity is not a valid finite number');
    assert(isNumber('123') === false, 'string representation of number is not number');

    // 3. Test isInteger
    console.log('  - Testing isInteger');
    assert(isInteger(123) === true, 'integer should be true');
    assert(isInteger(0) === true, 'zero integer should be true');
    assert(isInteger(12.34) === false, 'float should not be integer');
    assert(isInteger('123') === false, 'string should not be integer');

    // 4. Test isBoolean
    console.log('  - Testing isBoolean');
    assert(isBoolean(true) === true, 'true should be boolean');
    assert(isBoolean(false) === true, 'false should be boolean');
    assert(isBoolean('true') === false, 'string true should not be boolean');
    assert(isBoolean(1) === false, 'integer 1 should not be boolean');

    // 5. Test validateString
    console.log('  - Testing validateString');
    assert(validateString('hello', 3, 10) === true, 'valid string length');
    assert(validateString('he', 3, 10) === false, 'too short string');
    assert(validateString('hello world', 3, 10) === false, 'too long string');
    assert(validateString(123, 1, 10) === false, 'non-string input');

    // 6. Test validateNumber
    console.log('  - Testing validateNumber');
    assert(validateNumber(10, 5, 20) === true, 'valid range');
    assert(validateNumber(4, 5, 20) === false, 'under min');
    assert(validateNumber(21, 5, 20) === false, 'over max');
    assert(validateNumber(10.5, 5, 20) === true, 'valid decimal in range');

    // 7. Test validateInteger
    console.log('  - Testing validateInteger');
    assert(validateInteger(10, 5, 20) === true, 'valid integer range');
    assert(validateInteger(10.5, 5, 20) === false, 'decimal in integer validator should fail');
    assert(validateInteger(3, 5, 20) === false, 'under min integer');

    // 8. Test validateBody middleware behavior
    console.log('  - Testing validateBody middleware');
    const middleware = validateBody({
        username: (val) => validateString(val, 3, 15),
        bet: (val) => validateNumber(val, 0.1, 100)
    });

    // Case A: Valid body
    let nextCalled = false;
    let resStatus = null;
    let resJson = null;

    const mockReqValid = {
        body: {
            username: 'testuser',
            bet: 50.5
        }
    };
    const mockRes = {
        status: (code) => {
            resStatus = code;
            return {
                json: (obj) => { resJson = obj; }
            };
        }
    };
    const mockNext = () => { nextCalled = true; };

    middleware(mockReqValid, mockRes, mockNext);
    assert(nextCalled === true, 'next() should have been called for valid body');
    assert(resStatus === null, 'no error status should be set');

    // Case B: Invalid username type
    nextCalled = false;
    resStatus = null;
    resJson = null;
    const mockReqInvalid = {
        body: {
            username: 12345, // invalid type
            bet: 50.5
        }
    };
    middleware(mockReqInvalid, mockRes, mockNext);
    assert(nextCalled === false, 'next() should NOT be called for invalid username type');
    assert(resStatus === 400, 'should return 400 error status');
    assert(resJson && resJson.error.includes('username'), 'should identify invalid username');

    // Case C: Invalid bet range
    nextCalled = false;
    resStatus = null;
    resJson = null;
    const mockReqOutOfRange = {
        body: {
            username: 'testuser',
            bet: 999 // out of range
        }
    };
    middleware(mockReqOutOfRange, mockRes, mockNext);
    assert(nextCalled === false, 'next() should NOT be called for out of range bet');
    assert(resStatus === 400, 'should return 400 error status');
    assert(resJson && resJson.error.includes('bet'), 'should identify invalid bet');

    console.log('✅ All validation unit tests passed successfully!');
};

runTests();
