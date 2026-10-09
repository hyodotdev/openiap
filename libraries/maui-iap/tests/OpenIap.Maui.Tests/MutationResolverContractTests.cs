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
    public void RemovedRedemptionAliases_AreAbsentFromTheStableContract()
    {
        Assert.Null(typeof(MutationResolver).GetMethod("OpenRedeemOfferCodeAndroidAsync"));
        Assert.Null(typeof(MutationResolver).GetMethod("PresentCodeRedemptionSheetIOSAsync"));
        Assert.Null(typeof(VerifyPurchaseResultHorizon).GetProperty("Success"));
    }
}
