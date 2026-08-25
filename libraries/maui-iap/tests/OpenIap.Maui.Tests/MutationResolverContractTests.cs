// Generated-contract guard for the offer-code redemption surface: the unified
// cross-platform openRedeemOfferCode operation plus the deprecated suffixed
// operations that stay declared until OpenIAP 4.0.

using System.Reflection;
using Xunit;

namespace OpenIap.Maui.Tests;

public class MutationResolverContractTests
{
    [Fact]
    public void OpenRedeemOfferCode_DeclaresParameterlessNullablePurchaseTask()
    {
        var method = typeof(MutationResolver).GetMethod("OpenRedeemOfferCodeAsync");

        Assert.NotNull(method);
        Assert.Empty(method!.GetParameters());
        Assert.Equal(typeof(Task<Purchase>), method.ReturnType);

        // Task<Purchase?> — a null resolve is part of the contract (sheet /
        // redeem page presented without a synchronously reported purchase).
        var nullability = new NullabilityInfoContext().Create(method.ReturnParameter);
        Assert.Equal(NullabilityState.Nullable, nullability.GenericTypeArguments[0].ReadState);
    }

    [Fact]
    public void DeprecatedRedemptionOps_KeepReleasedSignaturesUntilOpenIap4()
    {
        var android = typeof(MutationResolver).GetMethod("OpenRedeemOfferCodeAndroidAsync");
        Assert.NotNull(android);
        Assert.Empty(android!.GetParameters());
        Assert.Equal(typeof(Task<bool>), android.ReturnType);

        var ios = typeof(MutationResolver).GetMethod("PresentCodeRedemptionSheetIOSAsync");
        Assert.NotNull(ios);
        Assert.Empty(ios!.GetParameters());
        Assert.Equal(typeof(Task<PurchaseIOS>), ios.ReturnType);
        var iosNullability = new NullabilityInfoContext().Create(ios.ReturnParameter);
        Assert.Equal(NullabilityState.Nullable, iosNullability.GenericTypeArguments[0].ReadState);
    }
}
