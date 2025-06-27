// index.ts file

import {
  DEFAULT_SUI_ERROR_CODES,
  TRANSACTION_ERROR_CODES,
} from "./defaultErrors.js";

export interface ErrorCodeMap {
  [key: number]: string;
}

export interface TransactionErrorMap {
  [key: string]: string;
}

export interface SuiErrorDecoderOptions {
  customErrorCodes?: ErrorCodeMap;
  customTransactionErrors?: TransactionErrorMap;
  includeDefaults?: boolean;
}

export interface ParsedError {
  code?: number;
  errorType?: string;
  message: string;
  isKnownError: boolean;
  category: "move_abort" | "transaction" | "sui_system" | "unknown";
  originalError: any;
}

export interface PatternMatcher {
  pattern: RegExp;
  category: ParsedError["category"];
  message: string | ((match: RegExpMatchArray) => string);
  errorType?: string;
}

/*
 *  SuiClientErrorDecoder is a class that decodes Sui client errors into human-readable messages.
 *  It supports custom error codes and transaction errors, and categorizes errors into known   types.
 */
export class SuiClientErrorDecoder {
  private errorCodes: ErrorCodeMap;
  private transactionErrors: TransactionErrorMap;

  private customErrorCodes: ErrorCodeMap;
  private customTransactionErrors: TransactionErrorMap;

  private readonly PATTERN_MATCHERS: PatternMatcher[];

  /**
   * Create a new SuiClientErrorDecoder instance.
   *
   * @param options - Configuration options.
   * @param options.customErrorCodes - Custom error codes to add to the default
   *     set. The keys are numeric error codes and the values are human-readable
   *     error messages.
   * @param options.customTransactionErrors - Custom transaction errors to add to
   *     the default set. The keys are transaction error types and the values are
   *     human-readable error messages.
   * @param options.includeDefaults - Whether to include the default error codes
   *     and transaction errors. Defaults to true.
   */
  constructor(options: SuiErrorDecoderOptions = {}) {
    const {
      customErrorCodes = {},
      customTransactionErrors = {},
      includeDefaults = true,
    } = options;

    this.customErrorCodes = customErrorCodes;
    this.customTransactionErrors = customTransactionErrors;

    this.errorCodes = includeDefaults
      ? { ...DEFAULT_SUI_ERROR_CODES, ...this.customErrorCodes }
      : this.customErrorCodes;

    this.transactionErrors = includeDefaults
      ? { ...TRANSACTION_ERROR_CODES, ...this.customTransactionErrors }
      : this.customTransactionErrors;

    // Initialize the pattern matchers with both system and transaction errors
    // This allows for a more comprehensive error matching strategy.
    this.PATTERN_MATCHERS = [
      // System Errors
      {
        pattern: /InsufficientGas/,
        message:
          "Insufficient gas for transaction. Please increase gas budget.",
        category: "sui_system",
      },
      {
        pattern: /ObjectNotFound/,
        message: "Required object not found. Please check object IDs.",
        category: "sui_system",
      },
      {
        pattern: /InvalidObjectOwner/,
        message: "Invalid object ownership. Please verify permissions.",
        category: "sui_system",
      },
      {
        pattern: /PackageNotFound/,
        message:
          "Smart contract package not found. Please check package deployment.",
        category: "sui_system",
      },
      {
        pattern: /TransactionExpired/,
        message: "Transaction expired. Please try again.",
        category: "transaction",
      },
      {
        pattern: /InvalidSignature/,
        message: "Invalid transaction signature.",
        category: "transaction",
      },
      {
        pattern: /Unexpected deserialization error/i,
        message: "Unexpected deserialization error",
        category: "sui_system",
      },

      // Transaction Errors (with dynamic messages)
      {
        pattern: /insufficient.*gas/i,
        errorType: "INSUFFICIENT_GAS",
        category: "transaction",
        message: `Transaction Error (INSUFFICIENT_GAS): ${this.transactionErrors.INSUFFICIENT_GAS}`,
      },
      {
        pattern: /invalid.*gas.*object/i,
        errorType: "INVALID_GAS_OBJECT",
        category: "transaction",
        message: `Transaction Error (INVALID_GAS_OBJECT): ${this.transactionErrors.INVALID_GAS_OBJECT}`,
      },
      {
        pattern: /object.*too.*big/i,
        errorType: "OBJECT_TOO_BIG",
        category: "transaction",
        message: `Transaction Error (OBJECT_TOO_BIG): ${this.transactionErrors.OBJECT_TOO_BIG}`,
      },
      {
        pattern: /package.*too.*big/i,
        errorType: "PACKAGE_TOO_BIG",
        category: "transaction",
        message: `Transaction Error (PACKAGE_TOO_BIG): ${this.transactionErrors.PACKAGE_TOO_BIG}`,
      },
      {
        pattern: /circular.*ownership/i,
        errorType: "CIRCULAR_OBJECT_OWNERSHIP",
        category: "transaction",
        message: `Transaction Error (CIRCULAR_OBJECT_OWNERSHIP): ${this.transactionErrors.CIRCULAR_OBJECT_OWNERSHIP}`,
      },
      {
        pattern: /insufficient.*coin.*balance/i,
        errorType: "INSUFFICIENT_COIN_BALANCE",
        category: "transaction",
        message: `Transaction Error (INSUFFICIENT_COIN_BALANCE): ${this.transactionErrors.INSUFFICIENT_COIN_BALANCE}`,
      },
      {
        pattern: /function.*not.*found/i,
        errorType: "FUNCTION_NOT_FOUND",
        category: "transaction",
        message: `Transaction Error (FUNCTION_NOT_FOUND): ${this.transactionErrors.FUNCTION_NOT_FOUND}`,
      },
      {
        pattern: /move.*abort/i,
        errorType: "MOVE_ABORT",
        category: "transaction",
        message: `Transaction Error (MOVE_ABORT): ${this.transactionErrors.MOVE_ABORT}`,
      },

      // Named Move Abort Errors
      {
        pattern: /EInvalidTickRange/,
        message: "Error: Invalid tick range for liquidity pool",
        category: "move_abort",
      },
      {
        pattern: /EInvalidLiquidity/,
        message: "Error: Invalid liquidity amount",
        category: "move_abort",
      },
      {
        pattern: /EInvalidTickSpacing/,
        message: "Error: Invalid tick spacing - must be 100, 500, or 3000",
        category: "move_abort",
      },
      {
        pattern: /ETickNotAligned/,
        message: "Error: Tick not aligned with tick spacing",
        category: "move_abort",
      },
      {
        pattern: /EInsufficientLiquidity/,
        message: "Error: Insufficient liquidity for pool creation",
        category: "move_abort",
      },
      {
        pattern: /EInvalidPrice/,
        message: "Error: Invalid price for pool creation",
        category: "move_abort",
      },
      {
        pattern: /EInvalidPhase/,
        message: "Error: Invalid phase for operation",
        category: "move_abort",
      },
      {
        pattern: /EUnauthorized/,
        message: "Error: Unauthorized access",
        category: "move_abort",
      },
    ];
  }

  /**
   * Adds custom error codes to the decoder.
   *
   * @param errorCodes - Error codes to add. Keys are numeric error codes, values are human-readable error messages.
   *
   * @remarks
   * This method updates both the custom error code map and the combined error code map.
   * This means that if you add a custom code that is already present in the default error codes,
   * your custom code will override the default one.
   */
  public addErrorCodes(errorCodes: ErrorCodeMap): void {
    this.customErrorCodes = { ...this.customErrorCodes, ...errorCodes };
    this.errorCodes = { ...this.errorCodes, ...errorCodes };
  }

  /**
   * Adds custom transaction error codes to the decoder.
   *
   * @param transactionErrors - Transaction error codes to add. Keys are string error types, values are human-readable error messages.
   *
   * @remarks
   * This method updates both the custom transaction error code map and the combined transaction error code map.
   * This means that if you add a custom code that is already present in the default transaction error codes,
   * your custom code will override the default one.
   */
  public addTransactionErrors(transactionErrors: TransactionErrorMap): void {
    this.customTransactionErrors = {
      ...this.customTransactionErrors,
      ...transactionErrors,
    };
    this.transactionErrors = {
      ...this.transactionErrors,
      ...transactionErrors,
    };
  }

  /**
   * Updates the default error codes.
   *
   * @param defaultCodes - Default error codes to use. This will be combined with any custom error codes that have been added.
   *
   * @remarks
   * This method updates the `errorCodes` map with the provided default error codes and any custom error codes that have been added.
   * If a custom code is already present in the default error codes, the custom code will override the default one.
   */
  public updateDefaultErrorCodes(defaultCodes: ErrorCodeMap): void {
    this.errorCodes = { ...defaultCodes, ...this.customErrorCodes };
  }

  /**
   * Updates the default transaction error codes.
   *
   * @param defaultTransactionErrors - Default transaction error codes to use.
   * This will be combined with any custom transaction error codes that have been added.
   *
   * @remarks
   * This method updates the `transactionErrors` map with the provided default transaction errors
   * and any custom transaction error codes that have been added. If a custom error type is
   * already present in the default transaction errors, the custom error will override the default one.
   */

  public updateDefaultTransactionErrors(
    defaultTransactionErrors: TransactionErrorMap
  ): void {
    this.transactionErrors = {
      ...defaultTransactionErrors,
      ...this.customTransactionErrors,
    };
  }

  /**
   * Returns a copy of the current error code map.
   *
   * @remarks
   * This method returns a shallow copy of the current error code map, which includes both default error codes
   * and any custom error codes that have been added. This is useful for inspecting the current error code map
   * without modifying the decoder's internal state.
   *
   * @returns A shallow copy of the current error code map.
   */
  public getErrorCodes(): ErrorCodeMap {
    return { ...this.errorCodes };
  }

  /**
   * Returns a copy of the current transaction error code map.
   *
   * @remarks
   * This method returns a shallow copy of the current transaction error code map, which includes both default transaction errors
   * and any custom transaction error codes that have been added. This is useful for inspecting the current transaction error code map
   * without modifying the decoder's internal state.
   *
   * @returns A shallow copy of the current transaction error code map.
   */
  public getTransactionErrors(): TransactionErrorMap {
    return { ...this.transactionErrors };
  }

  /**
   * Returns a copy of the current custom error code map.
   *
   * @returns A shallow copy of the current custom error code map.
   */
  private getCustomErrorCodes(): ErrorCodeMap {
    return this.customErrorCodes;
  }

  /**
   * Returns a copy of the current custom transaction error code map.
   *
   * @returns A shallow copy of the current custom transaction error code map.
   */
  private getCustomTransactionErrors(): TransactionErrorMap {
    return this.customTransactionErrors;
  }

  /**
   * Parse an error into a human-readable format and categorize it.
   *
   * @param error - The error to parse. Can be a string, an object with a `message` property, or an Error object.
   *
   * @returns A parsed error object with the following properties:
   * - `code`: An optional numeric error code.
   * - `message`: A human-readable error message.
   * - `isKnownError`: A boolean indicating whether the error is a known error code or pattern.
   * - `category`: The category of the error, which can be "move_abort", "transaction", "sui_system", or "unknown".
   * - `originalError`: The original error object that was passed in.
   */
  public parseError(error: any): ParsedError {
    const errorString = this.extractErrorString(error);

    // 1. Check for numeric error codes first
    const errorCode = this.extractErrorCode(errorString);
    if (errorCode !== null) {
      const message = this.errorCodes[errorCode];
      if (message) {
        return {
          code: errorCode,
          message: `Error Code ${errorCode}: ${message}`,
          isKnownError: true,
          category: this.categorizeError(errorCode, errorString),
          originalError: error,
        };
      } else {
        return {
          code: errorCode,
          message: `Move Error Code ${errorCode}: Unknown error occurred`,
          isKnownError: false,
          category: "move_abort",
          originalError: error,
        };
      }
    }

    // 2. Check for string-based patterns
    const patternMatch = this.findPatternMatch(errorString);
    if (patternMatch) {
      // We set originalError here to avoid duplicating it in the helper
      return { ...patternMatch, originalError: error };
    }

    // 3. Fallback to a generic unknown error
    return {
      message: errorString || "An unexpected error occurred",
      isKnownError: false,
      category: "unknown",
      originalError: error,
    };
  }

  /**
   * Searches for a match in the given error string, first checking for exact matches
   * of known transaction error types, then checking against a consolidated set of regex
   * patterns. If a match is found, returns an object with the error type, message,
   * whether the error is known, and the error category. If no match is found, returns
   * null.
   * @param errorString the error string to search for a match in
   * @returns the match object if a match is found, or null if no match is found
   */
  private findPatternMatch(
    errorString: string
  ): Omit<ParsedError, "originalError"> | null {
    // First, check for exact transaction error type matches (e.g., "INSUFFICIENT_GAS")
    for (const [errorType, message] of Object.entries(this.transactionErrors)) {
      if (new RegExp(`\\b${errorType}\\b`).test(errorString)) {
        return {
          errorType,
          message: `Transaction Error (${errorType}): ${message}`,
          isKnownError: true,
          category: "transaction",
        };
      }
    }

    // Then, check the consolidated regex patterns
    for (const matcher of this.PATTERN_MATCHERS) {
      const match = errorString.match(matcher.pattern);
      if (match) {
        return {
          errorType: matcher.errorType,
          message:
            typeof matcher.message === "function"
              ? matcher.message(match)
              : matcher.message,
          isKnownError: true,
          category: matcher.category,
        };
      }
    }

    return null;
  }

  /**
   * Extracts a string representation from an error object.
   *
   * @param error - The error object which can be of any type.
   * @returns The error message as a string. If the error is null or undefined, returns an empty string.
   *          If the error is a string, returns it directly. If it is an object with a message property,
   *          returns the message. If it has a cause with a message, returns that message. If it has a
   *          toString method, returns the result of that method unless it's the default object representation.
   *          In case of any other type, attempts to convert the error to a string.
   */
  private extractErrorString(error: any): string {
    if (error === null || error === undefined) return "";
    if (typeof error === "string") return error;
    if (error && typeof error === "object") {
      if (error.message && typeof error.message === "string")
        return error.message;
      if (error.cause?.message && typeof error.cause.message === "string")
        return error.cause.message;
      if (typeof error.toString === "function") {
        const stringified = error.toString();
        if (stringified !== "[object Object]") return stringified;
      }
    }
    try {
      return String(error);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
      return "";
    }
  }

  /**
   * Extracts an error code from a given error string using predefined patterns.
   *
   * @param errorString - The string representation of the error which may contain an error code.
   * @returns The extracted error code as a number if found and valid (non-negative integer),
   *          otherwise returns null. The function uses various regex patterns to identify
   *          the error code within the error string.
   */
  private extractErrorCode(errorString: string): number | null {
    const patterns = [
      /MoveAbort\([^,)]*,\s*(\d+)\)/,
      /MoveAbort\([^)]+\)\s*,?\s*(\d+)\)/,
      /MoveAbort.*?(\d+)\)/,
      /}, (\d+)\) in command/,
      /abort_code:\s*(\d+)/i,
      /error_code:\s*(\d+)/i,
      /CetusError\((\d+)\)/,
      /PoolCreationError\((\d+)\)/,
      /InsufficientLiquidity\((\d+)\)/,
      /LaunchpadError\((\d+)\)/,
      /Error\s*Code\s*(\d+)/i,
      /ErrorCode:?\s*(\d+)/i,
      /code[:\s]*(\d+)/i,
      /error[:\s]*(\d+)/i,
      /with\s+code\s+(\d+)/i,
      /error\s+(\d+)/i,
    ];

    for (const pattern of patterns) {
      const match = errorString.match(pattern);
      if (match && match[1]) {
        const code = parseInt(match[1], 10);
        if (!isNaN(code) && code >= 0) return code;
      }
    }
    return null;
  }

  /**
   * Determines the category of a given error code.
   *
   * @param errorCode - The numeric error code.
   * @param errorString - The string representation of the error.
   * @returns One of "move_abort", "sui_system", or "transaction".
   *
   * The categorization is based on the numeric range of the error code.
   * If the code is not recognized, the function falls back to searching
   * the error string for keywords "Transaction" or "Signature" to
   * determine if the error is a transaction error. If no match is found,
   * the function returns "move_abort".
   */
  private categorizeError(
    errorCode: number,
    errorString: string
  ): ParsedError["category"] {
    if (errorCode >= 1000 && errorCode <= 1999) return "move_abort";
    if (errorCode >= 2000 && errorCode <= 2999) return "sui_system";
    if (errorCode >= 3000) return "sui_system";
    if (errorCode >= 1 && errorCode <= 999) return "move_abort";
    if (
      errorString.includes("Transaction") ||
      errorString.includes("Signature")
    )
      return "transaction";
    return "move_abort";
  }

  /**
   * Decodes an error object to a human-readable error message.
   *
   * @param error - The error object to decode, which can be of any type.
   * @returns The human-readable message extracted from the error.
   */
  public decodeError(error: any): string {
    return this.parseError(error).message;
  }

  /**
   * Checks if the given error code is recognized by the decoder.
   *
   * @param code - The numeric error code to check.
   * @returns True if the error code is known, false otherwise.
   */
  public isKnownErrorCode(code: number): boolean {
    return code in this.errorCodes;
  }

  /**
   * Checks if the given transaction error type is recognized by the decoder.
   *
   * @param errorType - The transaction error type to check.
   * @returns True if the error type is known, false otherwise.
   */
  public isKnownTransactionError(errorType: string): boolean {
    return errorType in this.transactionErrors;
  }

  /**
   * Retrieves the human-readable error message for a given error code.
   *
   * @param code - The numeric error code to retrieve the message for.
   * @returns The human-readable error message if the code is recognized, null otherwise.
   */
  public getErrorMessage(code: number): string | null {
    return this.errorCodes[code] || null;
  }

  /**
   * Retrieves the human-readable transaction error message for a given error type.
   *
   * @param errorType - The string identifier of the transaction error to look up.
   * @returns The human-readable error message if the error type is recognized, or null if it is not.
   */
  public getTransactionErrorMessage(errorType: string): string | null {
    return this.transactionErrors[errorType] || null;
  }

  /**
   * Retrieves a list of numeric error codes that have been overridden
   * by custom error codes.
   *
   * @returns An array of error codes that exist in both the custom
   * error codes and the default Sui error codes, indicating that the
   * custom error codes have overridden the defaults.
   */
  public getOverriddenCodes(): number[] {
    const overridden: number[] = [];
    for (const codeStr of Object.keys(this.customErrorCodes)) {
      const numCode = parseInt(codeStr);
      if (DEFAULT_SUI_ERROR_CODES[numCode]) {
        overridden.push(numCode);
      }
    }
    return overridden;
  }
}

// Default instance and helper function remain the same
export const defaultDecoder = new SuiClientErrorDecoder();

/**
 * Decodes a given error into a human-readable message, utilizing optional custom error codes
 * and transaction errors if provided. If no custom codes are specified, the default decoder
 * is used.
 *
 * @param error - The error object to decode.
 * @param customCodes - Optional custom error codes to override or extend the defaults.
 * @param customTransactionErrors - Optional custom transaction error codes to override or extend the defaults.
 * @returns A string that represents the human-readable error message.
 */
export function decodeSuiError(
  error: any,
  customCodes?: ErrorCodeMap,
  customTransactionErrors?: TransactionErrorMap
): string {
  if (customCodes || customTransactionErrors) {
    const decoder = new SuiClientErrorDecoder({
      customErrorCodes: customCodes,
      customTransactionErrors: customTransactionErrors,
    });
    return decoder.decodeError(error);
  }
  return defaultDecoder.decodeError(error);
}

export {
  DEFAULT_SUI_ERROR_CODES,
  TRANSACTION_ERROR_CODES,
} from "./defaultErrors.js";
