// An empty or missing subscription filter means "all"; older native releases
// matched an empty list against nothing, so normalize it to null.

#nullable enable

using System.Collections.Generic;

namespace OpenIap.Maui;

internal static class SubscriptionIds
{
    internal static IReadOnlyList<string>? NormalizeForNative(IReadOnlyList<string>? subscriptionIds)
        => subscriptionIds is { Count: > 0 } ? subscriptionIds : null;
}
