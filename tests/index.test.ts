// index.test.ts
import {
  SuiClientErrorDecoder,
  decodeSuiError,
  defaultDecoder,
  DEFAULT_SUI_ERROR_CODES,
  TRANSACTION_ERROR_CODES,
  ErrorCodeMap,
} from "../src/index.js";

describe("SuiClientErrorDecoder", () => {
  let decoder: SuiClientErrorDecoder;

  beforeEach(() => {
    decoder = new SuiClientErrorDecoder();
  });

  describe("Constructor and Configuration", () => {
    test("should initialize with default error codes", () => {
      const errorCodes = decoder.getErrorCodes();
      expect(errorCodes[1000]).toBe("Unknown verification error");
      expect(errorCodes[2000]).toBe("Unknown invariant violation error");
    });

    test("should initialize with custom error codes", () => {
      const customCodes = { 9999: "Custom error message" };
      const customDecoder = new SuiClientErrorDecoder({
        customErrorCodes: customCodes,
      });
      expect(customDecoder.getErrorCodes()[9999]).toBe("Custom error message");
    });

    test("should initialize with custom transaction errors", () => {
      const customTransactionErrors = {
        CUSTOM_TX_ERROR: "Custom transaction error",
      };
      const customDecoder = new SuiClientErrorDecoder({
        customTransactionErrors,
      });
      expect(customDecoder.getTransactionErrors().CUSTOM_TX_ERROR).toBe(
        "Custom transaction error"
      );
    });

    test("should exclude defaults when includeDefaults is false", () => {
      const customCodes = { 9999: "Only custom error" };
      const customDecoder = new SuiClientErrorDecoder({
        customErrorCodes: customCodes,
        includeDefaults: false,
      });
      const errorCodes = customDecoder.getErrorCodes();
      expect(errorCodes[1000]).toBeUndefined();
      expect(errorCodes[9999]).toBe("Only custom error");
    });

    test("should merge custom codes with defaults when includeDefaults is true", () => {
      const customCodes = { 9999: "Custom error", 1000: "Overridden error" };
      const customDecoder = new SuiClientErrorDecoder({
        customErrorCodes: customCodes,
        includeDefaults: true,
      });
      const errorCodes = customDecoder.getErrorCodes();
      expect(errorCodes[1000]).toBe("Overridden error"); // Custom overrides default
      expect(errorCodes[1001]).toBe("Index out of bounds"); // Default preserved
      expect(errorCodes[9999]).toBe("Custom error");
    });
  });

  describe("Error Code Management", () => {
    test("should add custom error codes", () => {
      decoder.addErrorCodes({ 8888: "Added error code" });
      expect(decoder.getErrorCodes()[8888]).toBe("Added error code");
    });

    test("should add custom transaction errors", () => {
      decoder.addTransactionErrors({ NEW_TX_ERROR: "New transaction error" });
      expect(decoder.getTransactionErrors().NEW_TX_ERROR).toBe(
        "New transaction error"
      );
    });

    test("should check if error code is known", () => {
      expect(decoder.isKnownErrorCode(1000)).toBe(true);
      expect(decoder.isKnownErrorCode(99999)).toBe(false);
    });

    test("should check if transaction error type is known", () => {
      expect(decoder.isKnownTransactionError("INSUFFICIENT_GAS")).toBe(true);
      expect(decoder.isKnownTransactionError("UNKNOWN_ERROR")).toBe(false);
    });

    test("should get error message for specific code", () => {
      expect(decoder.getErrorMessage(1000)).toBe("Unknown verification error");
      expect(decoder.getErrorMessage(99999)).toBeNull();
    });

    test("should get transaction error message for specific error type", () => {
      expect(decoder.getTransactionErrorMessage("INSUFFICIENT_GAS")).toBe(
        "Insufficient gas."
      );
      expect(decoder.getTransactionErrorMessage("UNKNOWN_ERROR")).toBeNull();
    });

    test("should update default error codes while preserving custom ones", () => {
      // Add a custom code first
      decoder.addErrorCodes({ 9999: "Custom code" });

      // Update defaults
      const newDefaults = {
        1000: "Updated verification error",
        1001: "Updated index error",
      };
      decoder.updateDefaultErrorCodes(newDefaults);

      const errorCodes = decoder.getErrorCodes();
      expect(errorCodes[1000]).toBe("Updated verification error");
      expect(errorCodes[9999]).toBe("Custom code"); // Custom preserved
    });

    test("should update default transaction errors while preserving custom ones", () => {
      // Add a custom transaction error first
      decoder.addTransactionErrors({
        CUSTOM_ERROR: "Custom transaction error",
      });

      // Update defaults
      const newDefaults = { INSUFFICIENT_GAS: "Updated gas error" };
      decoder.updateDefaultTransactionErrors(newDefaults);

      const transactionErrors = decoder.getTransactionErrors();
      expect(transactionErrors.INSUFFICIENT_GAS).toBe("Updated gas error");
      expect(transactionErrors.CUSTOM_ERROR).toBe("Custom transaction error"); // Custom preserved
    });
  });

  describe("Error Parsing - Move Abort Errors", () => {
    test("should parse standard MoveAbort error with code", () => {
      const error =
        'MoveAbort(MoveLocation { module: ModuleId { address: 0x123, name: Identifier("pool") }, function: 1, code_offset: 42 }, 1001) in command 0';
      const parsed = decoder.parseError(error);

      expect(parsed.code).toBe(1001);
      expect(parsed.message).toBe("Error Code 1001: Index out of bounds");
      expect(parsed.isKnownError).toBe(true);
      expect(parsed.category).toBe("move_abort");
    });

    test("should parse MoveAbort with unknown code", () => {
      const error = "MoveAbort(address, 99999) in command 0";
      const parsed = decoder.parseError(error);

      expect(parsed.code).toBe(99999);
      expect(parsed.message).toBe(
        "Move Error Code 99999: Unknown error occurred"
      );
      expect(parsed.isKnownError).toBe(false);
      expect(parsed.category).toBe("move_abort");
    });

    test("should parse protocol-specific error codes", () => {
      const error = "CetusError(1020)";
      const parsed = decoder.parseError(error);

      expect(parsed.code).toBe(1020);
      expect(parsed.message).toBe("Error Code 1020: Type mismatch");
      expect(parsed.isKnownError).toBe(true);
      expect(parsed.category).toBe("move_abort");
    });

    test("should parse error with abort_code format", () => {
      const error = "Transaction failed with abort_code: 1003";
      const parsed = decoder.parseError(error);

      expect(parsed.code).toBe(1003);
      expect(parsed.message).toBe("Error Code 1003: Invalid signature token");
      expect(parsed.isKnownError).toBe(true);
    });

    test("should categorize errors correctly by code range", () => {
      const moveAbortError = decoder.parseError("Error Code 1000");
      expect(moveAbortError.category).toBe("move_abort");

      const systemError = decoder.parseError("Error Code 2000");
      expect(systemError.category).toBe("sui_system");

      const binaryError = decoder.parseError("Error Code 3000");
      expect(binaryError.category).toBe("sui_system");
    });
  });

  describe("Error Parsing - Transaction Errors", () => {
    test("should parse insufficient gas error", () => {
      const error = "INSUFFICIENT_GAS: Transaction requires more gas";
      const parsed = decoder.parseError(error);

      expect(parsed.errorType).toBe("INSUFFICIENT_GAS");
      expect(parsed.message).toBe(
        "Transaction Error (INSUFFICIENT_GAS): Insufficient gas."
      );
      expect(parsed.isKnownError).toBe(true);
      expect(parsed.category).toBe("transaction");
    });

    test("should parse move abort transaction error", () => {
      const error = "MOVE_ABORT: Move runtime abort occurred";
      const parsed = decoder.parseError(error);

      expect(parsed.errorType).toBe("MOVE_ABORT");
      expect(parsed.message).toBe(
        "Transaction Error (MOVE_ABORT): Move runtime abort."
      );
      expect(parsed.isKnownError).toBe(true);
      expect(parsed.category).toBe("transaction");
    });

    test("should detect insufficient gas by pattern", () => {
      const error = "Transaction failed due to insufficient gas budget";
      const parsed = decoder.parseError(error);

      expect(parsed.errorType).toBe("INSUFFICIENT_GAS");
      expect(parsed.message).toBe(
        "Transaction Error (INSUFFICIENT_GAS): Insufficient gas."
      );
      expect(parsed.isKnownError).toBe(true);
      expect(parsed.category).toBe("transaction");
    });

    test("should detect object too big error by pattern", () => {
      const error = "Move object is too big for storage";
      const parsed = decoder.parseError(error);

      expect(parsed.errorType).toBe("OBJECT_TOO_BIG");
      expect(parsed.message).toBe(
        "Transaction Error (OBJECT_TOO_BIG): Move object is larger than the maximum allowed size."
      );
      expect(parsed.isKnownError).toBe(true);
      expect(parsed.category).toBe("transaction");
    });

    test("should detect function not found error", () => {
      const error = "Function not found in module";
      const parsed = decoder.parseError(error);

      expect(parsed.errorType).toBe("FUNCTION_NOT_FOUND");
      expect(parsed.message).toBe(
        "Transaction Error (FUNCTION_NOT_FOUND): Function not found."
      );
      expect(parsed.isKnownError).toBe(true);
      expect(parsed.category).toBe("transaction");
    });
  });

  describe("Error Parsing - Named Errors", () => {
    test("should parse EInvalidTickRange error", () => {
      const error = "EInvalidTickRange: The tick range is invalid";
      const parsed = decoder.parseError(error);

      expect(parsed.message).toBe(
        "Error: Invalid tick range for liquidity pool"
      );
      expect(parsed.isKnownError).toBe(true);
      expect(parsed.category).toBe("move_abort");
    });

    test("should parse EInsufficientLiquidity error", () => {
      const error = "EInsufficientLiquidity encountered";
      const parsed = decoder.parseError(error);

      expect(parsed.message).toBe(
        "Error: Insufficient liquidity for pool creation"
      );
      expect(parsed.isKnownError).toBe(true);
      expect(parsed.category).toBe("move_abort");
    });

    test("should parse EUnauthorized error", () => {
      const error = "EUnauthorized access attempt";
      const parsed = decoder.parseError(error);

      expect(parsed.message).toBe("Error: Unauthorized access");
      expect(parsed.isKnownError).toBe(true);
      expect(parsed.category).toBe("move_abort");
    });
  });

  describe("Error Parsing - System Errors", () => {
    test("should parse InsufficientGas system error", () => {
      const error = "InsufficientGas for transaction execution";
      const parsed = decoder.parseError(error);

      expect(parsed.message).toBe(
        "Insufficient gas for transaction. Please increase gas budget."
      );
      expect(parsed.isKnownError).toBe(true);
      expect(parsed.category).toBe("sui_system");
    });

    test("should parse ObjectNotFound system error", () => {
      const error = "ObjectNotFound: 0x123abc...";
      const parsed = decoder.parseError(error);

      expect(parsed.message).toBe(
        "Required object not found. Please check object IDs."
      );
      expect(parsed.isKnownError).toBe(true);
      expect(parsed.category).toBe("sui_system");
    });

    test("should parse PackageNotFound system error", () => {
      const error = "PackageNotFound for deployment";
      const parsed = decoder.parseError(error);

      expect(parsed.message).toBe(
        "Smart contract package not found. Please check package deployment."
      );
      expect(parsed.isKnownError).toBe(true);
      expect(parsed.category).toBe("sui_system");
    });
  });

  describe("Error Parsing - Various Input Formats", () => {
    test("should handle Error object with message property", () => {
      const error = new Error("MoveAbort with code 1020");
      const parsed = decoder.parseError(error);

      expect(parsed.code).toBe(1020);
      expect(parsed.isKnownError).toBe(true);
    });

    test("should handle object with toString method", () => {
      const error = {
        toString: () => "Error Code 1001 occurred",
      };
      const parsed = decoder.parseError(error);

      expect(parsed.code).toBe(1001);
      expect(parsed.isKnownError).toBe(true);
    });

    test("should handle plain string errors", () => {
      const error = "Simple error with code 2000";
      const parsed = decoder.parseError(error);

      expect(parsed.code).toBe(2000);
      expect(parsed.isKnownError).toBe(true);
    });

    test("should handle null/undefined errors gracefully", () => {
      const nullParsed = decoder.parseError(null);
      expect(nullParsed.message).toBe("An unexpected error occurred");
      expect(nullParsed.isKnownError).toBe(false);
      expect(nullParsed.category).toBe("unknown");

      const undefinedParsed = decoder.parseError(undefined);
      expect(undefinedParsed.message).toBe("An unexpected error occurred");
      expect(undefinedParsed.isKnownError).toBe(false);
      expect(undefinedParsed.category).toBe("unknown");
    });

    test("should handle empty string errors", () => {
      const parsed = decoder.parseError("");
      expect(parsed.message).toBe("An unexpected error occurred");
      expect(parsed.isKnownError).toBe(false);
      expect(parsed.category).toBe("unknown");
    });
  });

  describe("Complex Error Scenarios", () => {
    test("should handle nested error structures", () => {
      const complexError = {
        cause: {
          message: "MoveAbort(address, 1020) in command 1",
        },
        message: "Transaction execution failed",
      };
      const parsed = decoder.parseError(complexError);

      expect(parsed.code).toBe(1020);
      expect(parsed.isKnownError).toBe(true);
    });

    test("should parse multiple error patterns in single string", () => {
      const error =
        "Transaction failed: INSUFFICIENT_GAS with MoveAbort code 1001";
      const parsed = decoder.parseError(error);

      // Should prioritize transaction errors over numeric codes
      expect(parsed.errorType).toBe("INSUFFICIENT_GAS");
      expect(parsed.category).toBe("transaction");
    });

    test("should handle Sui system error codes correctly", () => {
      const error = "System error with code 2023: Arithmetic overflow";
      const parsed = decoder.parseError(error);

      expect(parsed.code).toBe(2023);
      expect(parsed.message).toBe("Error Code 2023: Arithmetic overflow");
      expect(parsed.category).toBe("sui_system");
    });
  });

  describe("Convenience Methods", () => {
    test("decodeError should return just the message", () => {
      const error = "MoveAbort with code 1001";
      const message = decoder.decodeError(error);

      expect(message).toBe("Error Code 1001: Index out of bounds");
    });

    test("should maintain originalError in parsed result", () => {
      const originalError = new Error("Test error");
      const parsed = decoder.parseError(originalError);

      expect(parsed.originalError).toBe(originalError);
    });
  });

  describe("Custom Error Integration", () => {
    test("should use custom error codes in parsing", () => {
      const customDecoder = new SuiClientErrorDecoder({
        customErrorCodes: { 7777: "Custom protocol error" },
      });

      const error = "Error occurred with code 7777";
      const parsed = customDecoder.parseError(error);

      expect(parsed.code).toBe(7777);
      expect(parsed.message).toBe("Error Code 7777: Custom protocol error");
      expect(parsed.isKnownError).toBe(true);
    });

    test("should use custom transaction errors in parsing", () => {
      const customDecoder = new SuiClientErrorDecoder({
        customTransactionErrors: {
          CUSTOM_LIMIT_EXCEEDED: "Custom limit exceeded",
        },
      });

      const error = "CUSTOM_LIMIT_EXCEEDED in transaction";
      const parsed = customDecoder.parseError(error);

      expect(parsed.errorType).toBe("CUSTOM_LIMIT_EXCEEDED");
      expect(parsed.message).toBe(
        "Transaction Error (CUSTOM_LIMIT_EXCEEDED): Custom limit exceeded"
      );
      expect(parsed.isKnownError).toBe(true);
    });
  });
});

describe("Exported Functions", () => {
  describe("decodeSuiError", () => {
    test("should work with default decoder", () => {
      const error = "MoveAbort with code 1001";
      const message = decodeSuiError(error);

      expect(message).toBe("Error Code 1001: Index out of bounds");
    });

    test("should work with custom error codes", () => {
      const customCodes = { 8888: "Custom decode error" };
      const error = "Error code 8888 occurred";
      const message = decodeSuiError(error, customCodes);

      expect(message).toBe("Error Code 8888: Custom decode error");
    });

    test("should work with custom transaction errors", () => {
      const customTransactionErrors = { CUSTOM_TX: "Custom transaction error" };
      const error = "CUSTOM_TX occurred";
      const message = decodeSuiError(error, undefined, customTransactionErrors);

      expect(message).toBe(
        "Transaction Error (CUSTOM_TX): Custom transaction error"
      );
    });
  });

  describe("defaultDecoder", () => {
    test("should be an instance of SuiClientErrorDecoder", () => {
      expect(defaultDecoder).toBeInstanceOf(SuiClientErrorDecoder);
    });

    test("should have default error codes loaded", () => {
      expect(defaultDecoder.isKnownErrorCode(1000)).toBe(true);
    });

    test("should be able to decode errors", () => {
      const message = defaultDecoder.decodeError("Error with code 1001");
      expect(message).toBe("Error Code 1001: Index out of bounds");
    });
  });
});

describe("Exported Constants", () => {
  test("DEFAULT_SUI_ERROR_CODES should contain expected error codes", () => {
    expect(DEFAULT_SUI_ERROR_CODES[1000]).toBe("Unknown verification error");
    expect(DEFAULT_SUI_ERROR_CODES[2000]).toBe(
      "Unknown invariant violation error"
    );
    expect(DEFAULT_SUI_ERROR_CODES[3000]).toBe("Unknown binary error");
  });

  test("TRANSACTION_ERROR_CODES should contain expected transaction errors", () => {
    expect(TRANSACTION_ERROR_CODES.INSUFFICIENT_GAS).toBe("Insufficient gas.");
    expect(TRANSACTION_ERROR_CODES.MOVE_ABORT).toBe("Move runtime abort.");
    expect(TRANSACTION_ERROR_CODES.FUNCTION_NOT_FOUND).toBe(
      "Function not found."
    );
  });
});

describe("Edge Cases and Error Handling", () => {
  test("should handle malformed error strings gracefully", () => {
    const decoder = new SuiClientErrorDecoder();

    const malformedErrors = [
      "MoveAbort(",
      "Error Code abc",
      "}{invalid json}",
      "Code: NaN",
      123, // number instead of string
      [], // array
      {}, // empty object
    ];

    malformedErrors.forEach((error) => {
      const parsed = decoder.parseError(error);
      expect(parsed).toHaveProperty("message");
      expect(parsed).toHaveProperty("isKnownError");
      expect(parsed).toHaveProperty("category");
      expect(parsed.originalError).toBe(error);
    });
  });

  test("should handle very large error codes", () => {
    const decoder = new SuiClientErrorDecoder();
    const error = "Error with code 999999999999";
    const parsed = decoder.parseError(error);

    expect(parsed.code).toBe(999999999999);
    expect(parsed.isKnownError).toBe(false);
  });

  test("should handle negative error codes", () => {
    const decoder = new SuiClientErrorDecoder();
    const error = "Error with code -1000";
    const parsed = decoder.parseError(error);

    // Should not extract negative codes
    expect(parsed.code).toBeUndefined();
    expect(parsed.category).toBe("unknown");
  });

  test("should handle circular references in error objects", () => {
    const decoder = new SuiClientErrorDecoder();
    const circularError: any = { message: "Circular error" };
    circularError.self = circularError;

    const parsed = decoder.parseError(circularError);
    expect(parsed.message).toBe("Circular error");
  });
});

describe("Performance and Memory", () => {
  test("should handle large numbers of error codes efficiently", () => {
    const largeCodes: ErrorCodeMap = {};
    for (let index = 10000; index < 20000; index++) {
      largeCodes[index] = `Error ${index}`;
    }

    const decoder = new SuiClientErrorDecoder({
      customErrorCodes: largeCodes,
    });

    const start = Date.now();
    const parsed = decoder.parseError("Error with code 15000");
    const duration = Date.now() - start;

    expect(parsed.code).toBe(15000);
    expect(parsed.message).toBe("Error Code 15000: Error 15000");
    expect(duration).toBeLessThan(100); // Should be fast
  });

  test("should not leak memory when creating multiple decoders", () => {
    const initialMemory = process.memoryUsage().heapUsed;

    for (let index = 0; index < 1000; index++) {
      const decoder = new SuiClientErrorDecoder({
        customErrorCodes: { [index]: `Error ${index}` },
      });
      decoder.parseError(`Error ${index}`);
    }

    const finalMemory = process.memoryUsage().heapUsed;
    const memoryIncrease = finalMemory - initialMemory;

    // Memory increase should be reasonable (less than 50MB)
    expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
  });
});
