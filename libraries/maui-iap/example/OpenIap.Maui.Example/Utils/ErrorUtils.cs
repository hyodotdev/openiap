// Mirrors libraries/expo-iap/example/src/utils/errorUtils.ts.

using OpenIap;

namespace OpenIap.Maui.Example.Utils;

public static class ErrorUtils
{
    /// <summary>
    /// Extract a human-readable message from arbitrary error shapes — plain
    /// exceptions, IAPKit-style `{ errors: [...] }` objects, or raw strings.
    /// </summary>
    public static string ExtractErrorMessage(object? error)
    {
        return error switch
        {
            null => "Unknown error",
            Exception ex => ex.Message,
            string s => s,
            _ => error.ToString() ?? "Unknown error",
        };
    }

    public static bool IsUserCancelled(object? error) => error switch
    {
        OpenIapException ex => ex.Error.Code == ErrorCode.UserCancelled,
        PurchaseError purchaseError => purchaseError.Code == ErrorCode.UserCancelled,
        _ => false,
    };

    public static string FormatPurchaseFailure(object error, string operation = "Purchase") =>
        IsUserCancelled(error)
            ? $"{operation} cancelled by user"
            : $"{operation} failed: {ExtractErrorMessage(error)}";
}
