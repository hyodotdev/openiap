// SubscriptionIds.NormalizeForNative maps an empty or missing filter to null
// so the iOS resolvers call native unfiltered ("all") instead of matching
// nothing. Reached via InternalsVisibleTo.

using System.Collections.Generic;
using Xunit;

namespace OpenIap.Maui.Tests;

public class SubscriptionIdsTests
{
    [Fact]
    public void NormalizeForNative_MapsEmptyAndNullToNull()
    {
        Assert.Null(SubscriptionIds.NormalizeForNative(new List<string>()));
        Assert.Null(SubscriptionIds.NormalizeForNative(null));
    }

    [Fact]
    public void NormalizeForNative_PassesNonEmptyThrough()
    {
        IReadOnlyList<string> ids = new List<string> { "premium.monthly", "premium.yearly" };
        Assert.Same(ids, SubscriptionIds.NormalizeForNative(ids));
    }
}
