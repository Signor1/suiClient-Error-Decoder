// index.test.ts file

import {
  SuiClientErrorDecoder,
  decodeSuiError,
  defaultDecoder,
} from "../src/index.js";

describe("SuiClientErrorDecoder", () => {
  let decoder: SuiClientErrorDecoder;

  beforeEach(() => {
    decoder = new SuiClientErrorDecoder();
  });

  describe("constructor", () => {
    it("should initialize with default error codes", () => {
      expect(decoder.isKnownErrorCode(1)).toBe(true);
      expect(decoder.getErrorMessage(1)).toBe("Invalid argument provided");
    });

    it("should accept custom error codes", () => {
      const customDecoder = new SuiClientErrorDecoder({
        customErrorCodes: { 9999: "Custom error message" },
      });

      expect(customDecoder.isKnownErrorCode(9999)).toBe(true);
      expect(customDecoder.getErrorMessage(9999)).toBe("Custom error message");
    });

    it("should allow disabling default error codes", () => {
      const customDecoder = new SuiClientErrorDecoder({
        customErrorCodes: { 9999: "Custom error message" },
        includeDefaults: false,
      });

      expect(customDecoder.isKnownErrorCode(1)).toBe(false);
      expect(customDecoder.isKnownErrorCode(9999)).toBe(true);
    });
  });

  describe("parseError", () => {
    it("should parse MoveAbort errors with known codes", () => {
      const error = new Error("MoveAbort(0x123, 7) in command");
      const result = decoder.parseError(error);

      expect(result.code).toBe(7);
      expect(result.message).toContain("Insufficient balance or resources");
      expect(result.isKnownError).toBe(true);
      expect(result.category).toBe("move_abort");
    });

    it("should parse MoveAbort errors with unknown codes", () => {
      const error = new Error("MoveAbort(0x123, 99999) in command");
      const result = decoder.parseError(error);

      expect(result.code).toBe(99999);
      expect(result.message).toContain("Unknown error occurred");
      expect(result.isKnownError).toBe(false);
      expect(result.category).toBe("move_abort");
    });

    it("should parse named errors", () => {
      const error = new Error("EInvalidTickRange");
      const result = decoder.parseError(error);

      expect(result.message).toContain("Invalid tick range for liquidity pool");
      expect(result.isKnownError).toBe(true);
      expect(result.category).toBe("move_abort");
    });

    it("should parse system errors", () => {
      const error = new Error("InsufficientGas");
      const result = decoder.parseError(error);

      expect(result.message).toContain("Insufficient gas for transaction");
      expect(result.isKnownError).toBe(true);
      expect(result.category).toBe("sui_system");
    });

    it("should handle unknown errors gracefully", () => {
      const error = new Error("Some unknown error");
      const result = decoder.parseError(error);

      expect(result.message).toBe("Some unknown error");
      expect(result.isKnownError).toBe(false);
      expect(result.category).toBe("unknown");
    });

    it("should handle different error formats", () => {
      const testCases = [
        { input: "MoveAbort(0x123, 7)", expectedCode: 7 },
        { input: "abort_code: 7", expectedCode: 7 },
        { input: "error_code: 7", expectedCode: 7 },
        { input: "CetusError(7)", expectedCode: 7 },
      ];

      testCases.forEach(({ input, expectedCode }) => {
        const result = decoder.parseError(new Error(input));
        expect(result.code).toBe(expectedCode);
      });
    });
  });

  describe("addErrorCodes", () => {
    it("should add new error codes", () => {
      decoder.addErrorCodes({ 5000: "New custom error" });

      expect(decoder.isKnownErrorCode(5000)).toBe(true);
      expect(decoder.getErrorMessage(5000)).toBe("New custom error");
    });

    it("should override existing error codes", () => {
      decoder.addErrorCodes({ 1: "Override default error" });

      expect(decoder.getErrorMessage(1)).toBe("Override default error");
    });
  });

  describe("decodeError", () => {
    it("should return just the error message", () => {
      const error = new Error("MoveAbort(0x123, 7) in command");
      const message = decoder.decodeError(error);

      expect(message).toContain("Error Code 7");
      expect(message).toContain("Insufficient balance or resources");
    });
  });

  describe("decodeSuiError function", () => {
    it("should work with default decoder", () => {
      const error = new Error("MoveAbort(0x123, 7) in command");
      const message = decodeSuiError(error);

      expect(message).toContain("Error Code 7");
    });

    it("should work with custom error codes", () => {
      const error = new Error("MoveAbort(0x123, 9999) in command");
      const message = decodeSuiError(error, { 9999: "Custom test error" });

      expect(message).toContain("Error Code 9999");
      expect(message).toContain("Custom test error");
    });
  });

  describe("error categorization", () => {
    it("should categorize move abort errors correctly", () => {
      const error = new Error("MoveAbort(0x123, 5) in command");
      const result = decoder.parseError(error);

      expect(result.category).toBe("move_abort");
    });

    it("should categorize system errors correctly", () => {
      const error = new Error("InsufficientGas");
      const result = decoder.parseError(error);

      expect(result.category).toBe("sui_system");
    });

    it("should categorize transaction errors correctly", () => {
      const error = new Error("TransactionExpired");
      const result = decoder.parseError(error);

      expect(result.category).toBe("transaction");
    });
  });
});
