// Native matches an empty subscription filter against nothing; an empty or
// missing list means "all", so normalize it to null before calling native.

#nullable enable

using System.Collections.Generic;

namespace OpenIap.Maui;

internal static class SubscriptionIds
{
    internal static IReadOnlyList<string>? NormalizeForNative(IReadOnlyList<string>? subscriptionIds)
        => subscriptionIds is { Count: > 0 } ? subscriptionIds : null;
}
