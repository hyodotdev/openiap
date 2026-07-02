// ============================================================================
// AUTO-GENERATED TYPES — DO NOT EDIT DIRECTLY
// Run `bun run generate` after updating any *.graphql schema file.
// ============================================================================

#nullable enable

using System;
using System.Collections.Generic;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading.Tasks;

namespace OpenIap;

// ============================================================================
// Enums
// ============================================================================

/// <summary>Alternative billing mode for Android</summary>
/// <summary>Controls which billing system is used</summary>
/// <summary>@deprecated Use enableBillingProgramAndroid with BillingProgramAndroid instead.</summary>
/// <summary>Use USER_CHOICE_BILLING for user choice billing, EXTERNAL_OFFER for alternative only.</summary>
[JsonConverter(typeof(AlternativeBillingModeAndroidJsonConverter))]
public enum AlternativeBillingModeAndroid
{
    /// <summary>Standard Google Play billing (default)</summary>
    None,
    /// <summary>User choice billing - user can select between Google Play or alternative</summary>
    /// <summary>Requires Google Play Billing Library 7.0+</summary>
    /// <summary>@deprecated Use BillingProgramAndroid.USER_CHOICE_BILLING instead</summary>
    UserChoice,
    /// <summary>Alternative billing only - no Google Play billing option</summary>
    /// <summary>Requires Google Play Billing Library 6.2+</summary>
    /// <summary>@deprecated Use BillingProgramAndroid.EXTERNAL_OFFER instead</summary>
    AlternativeOnly
}

public sealed class AlternativeBillingModeAndroidJsonConverter : JsonConverter<AlternativeBillingModeAndroid>
{
    private static readonly Dictionary<string, AlternativeBillingModeAndroid> _fromString = new()
    {
        ["none"] = AlternativeBillingModeAndroid.None,
        ["NONE"] = AlternativeBillingModeAndroid.None,
        ["user-choice"] = AlternativeBillingModeAndroid.UserChoice,
        ["USER_CHOICE"] = AlternativeBillingModeAndroid.UserChoice,
        ["alternative-only"] = AlternativeBillingModeAndroid.AlternativeOnly,
        ["ALTERNATIVE_ONLY"] = AlternativeBillingModeAndroid.AlternativeOnly,
    };

    private static readonly Dictionary<AlternativeBillingModeAndroid, string> _toString = new()
    {
        [AlternativeBillingModeAndroid.None] = "none",
        [AlternativeBillingModeAndroid.UserChoice] = "user-choice",
        [AlternativeBillingModeAndroid.AlternativeOnly] = "alternative-only",
    };

    public override AlternativeBillingModeAndroid Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        var raw = reader.GetString();
        if (raw is not null && _fromString.TryGetValue(raw, out var value)) return value;
        throw new JsonException($"Unknown AlternativeBillingModeAndroid value: {raw}");
    }

    public override void Write(Utf8JsonWriter writer, AlternativeBillingModeAndroid value, JsonSerializerOptions options)
    {
        writer.WriteStringValue(_toString[value]);
    }

    internal static string ToRawString(AlternativeBillingModeAndroid value) => _toString[value];
    internal static AlternativeBillingModeAndroid FromRawString(string value) =>
        _fromString.TryGetValue(value, out var v) ? v : throw new ArgumentException($"Unknown AlternativeBillingModeAndroid value: {value}");
}

public static class AlternativeBillingModeAndroidExtensions
{
    public static string ToJson(this AlternativeBillingModeAndroid value) => AlternativeBillingModeAndroidJsonConverter.ToRawString(value);
    public static AlternativeBillingModeAndroid FromJson(string value) => AlternativeBillingModeAndroidJsonConverter.FromRawString(value);
}

/// <summary>Billing program types for external content links, external offers, and external payments (Android)</summary>
/// <summary>Available in Google Play Billing Library 8.2.0+, EXTERNAL_PAYMENTS added in 8.3.0</summary>
[JsonConverter(typeof(BillingProgramAndroidJsonConverter))]
public enum BillingProgramAndroid
{
    /// <summary>Unspecified billing program. Do not use.</summary>
    Unspecified,
    /// <summary>User Choice Billing program.</summary>
    /// <summary>User can select between Google Play Billing or alternative billing.</summary>
    /// <summary>Available in Google Play Billing Library 7.0+</summary>
    UserChoiceBilling,
    /// <summary>External Content Links program.</summary>
    /// <summary>Allows linking to external content outside the app.</summary>
    /// <summary>Available in Google Play Billing Library 8.2.0+</summary>
    ExternalContentLink,
    /// <summary>External Offers program.</summary>
    /// <summary>Allows offering digital content purchases outside the app.</summary>
    /// <summary>Available in Google Play Billing Library 8.2.0+</summary>
    ExternalOffer,
    /// <summary>External Payments program (Japan only).</summary>
    /// <summary>Allows presenting a side-by-side choice between Google Play Billing and developer&apos;s external payment option.</summary>
    /// <summary>Users can choose to complete the purchase on the developer&apos;s website.</summary>
    /// <summary>Available in Google Play Billing Library 8.3.0+</summary>
    ExternalPayments
}

public sealed class BillingProgramAndroidJsonConverter : JsonConverter<BillingProgramAndroid>
{
    private static readonly Dictionary<string, BillingProgramAndroid> _fromString = new()
    {
        ["unspecified"] = BillingProgramAndroid.Unspecified,
        ["UNSPECIFIED"] = BillingProgramAndroid.Unspecified,
        ["user-choice-billing"] = BillingProgramAndroid.UserChoiceBilling,
        ["USER_CHOICE_BILLING"] = BillingProgramAndroid.UserChoiceBilling,
        ["external-content-link"] = BillingProgramAndroid.ExternalContentLink,
        ["EXTERNAL_CONTENT_LINK"] = BillingProgramAndroid.ExternalContentLink,
        ["external-offer"] = BillingProgramAndroid.ExternalOffer,
        ["EXTERNAL_OFFER"] = BillingProgramAndroid.ExternalOffer,
        ["external-payments"] = BillingProgramAndroid.ExternalPayments,
        ["EXTERNAL_PAYMENTS"] = BillingProgramAndroid.ExternalPayments,
    };

    private static readonly Dictionary<BillingProgramAndroid, string> _toString = new()
    {
        [BillingProgramAndroid.Unspecified] = "unspecified",
        [BillingProgramAndroid.UserChoiceBilling] = "user-choice-billing",
        [BillingProgramAndroid.ExternalContentLink] = "external-content-link",
        [BillingProgramAndroid.ExternalOffer] = "external-offer",
        [BillingProgramAndroid.ExternalPayments] = "external-payments",
    };

    public override BillingProgramAndroid Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        var raw = reader.GetString();
        if (raw is not null && _fromString.TryGetValue(raw, out var value)) return value;
        throw new JsonException($"Unknown BillingProgramAndroid value: {raw}");
    }

    public override void Write(Utf8JsonWriter writer, BillingProgramAndroid value, JsonSerializerOptions options)
    {
        writer.WriteStringValue(_toString[value]);
    }

    internal static string ToRawString(BillingProgramAndroid value) => _toString[value];
    internal static BillingProgramAndroid FromRawString(string value) =>
        _fromString.TryGetValue(value, out var v) ? v : throw new ArgumentException($"Unknown BillingProgramAndroid value: {value}");
}

public static class BillingProgramAndroidExtensions
{
    public static string ToJson(this BillingProgramAndroid value) => BillingProgramAndroidJsonConverter.ToRawString(value);
    public static BillingProgramAndroid FromJson(string value) => BillingProgramAndroidJsonConverter.FromRawString(value);
}

/// <summary>Launch mode for developer billing option (Android)</summary>
/// <summary>Determines how the external payment URL is launched</summary>
/// <summary>Available in Google Play Billing Library 8.3.0+</summary>
[JsonConverter(typeof(DeveloperBillingLaunchModeAndroidJsonConverter))]
public enum DeveloperBillingLaunchModeAndroid
{
    /// <summary>Unspecified launch mode. Do not use.</summary>
    Unspecified,
    /// <summary>Google Play will launch the link in an external browser or eligible app.</summary>
    /// <summary>Use this when you want Play to handle launching the external payment URL.</summary>
    LaunchInExternalBrowserOrApp,
    /// <summary>The caller app will launch the link after Play returns control.</summary>
    /// <summary>Use this when you want to handle launching the external payment URL yourself.</summary>
    CallerWillLaunchLink
}

public sealed class DeveloperBillingLaunchModeAndroidJsonConverter : JsonConverter<DeveloperBillingLaunchModeAndroid>
{
    private static readonly Dictionary<string, DeveloperBillingLaunchModeAndroid> _fromString = new()
    {
        ["unspecified"] = DeveloperBillingLaunchModeAndroid.Unspecified,
        ["UNSPECIFIED"] = DeveloperBillingLaunchModeAndroid.Unspecified,
        ["launch-in-external-browser-or-app"] = DeveloperBillingLaunchModeAndroid.LaunchInExternalBrowserOrApp,
        ["LAUNCH_IN_EXTERNAL_BROWSER_OR_APP"] = DeveloperBillingLaunchModeAndroid.LaunchInExternalBrowserOrApp,
        ["caller-will-launch-link"] = DeveloperBillingLaunchModeAndroid.CallerWillLaunchLink,
        ["CALLER_WILL_LAUNCH_LINK"] = DeveloperBillingLaunchModeAndroid.CallerWillLaunchLink,
    };

    private static readonly Dictionary<DeveloperBillingLaunchModeAndroid, string> _toString = new()
    {
        [DeveloperBillingLaunchModeAndroid.Unspecified] = "unspecified",
        [DeveloperBillingLaunchModeAndroid.LaunchInExternalBrowserOrApp] = "launch-in-external-browser-or-app",
        [DeveloperBillingLaunchModeAndroid.CallerWillLaunchLink] = "caller-will-launch-link",
    };

    public override DeveloperBillingLaunchModeAndroid Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        var raw = reader.GetString();
        if (raw is not null && _fromString.TryGetValue(raw, out var value)) return value;
        throw new JsonException($"Unknown DeveloperBillingLaunchModeAndroid value: {raw}");
    }

    public override void Write(Utf8JsonWriter writer, DeveloperBillingLaunchModeAndroid value, JsonSerializerOptions options)
    {
        writer.WriteStringValue(_toString[value]);
    }

    internal static string ToRawString(DeveloperBillingLaunchModeAndroid value) => _toString[value];
    internal static DeveloperBillingLaunchModeAndroid FromRawString(string value) =>
        _fromString.TryGetValue(value, out var v) ? v : throw new ArgumentException($"Unknown DeveloperBillingLaunchModeAndroid value: {value}");
}

public static class DeveloperBillingLaunchModeAndroidExtensions
{
    public static string ToJson(this DeveloperBillingLaunchModeAndroid value) => DeveloperBillingLaunchModeAndroidJsonConverter.ToRawString(value);
    public static DeveloperBillingLaunchModeAndroid FromJson(string value) => DeveloperBillingLaunchModeAndroidJsonConverter.FromRawString(value);
}

/// <summary>Discount offer type enumeration.</summary>
/// <summary>Categorizes the type of discount or promotional offer.</summary>
[JsonConverter(typeof(DiscountOfferTypeJsonConverter))]
public enum DiscountOfferType
{
    /// <summary>Introductory offer for new subscribers (first-time purchase discount)</summary>
    Introductory,
    /// <summary>Promotional offer for existing or returning subscribers</summary>
    Promotional,
    /// <summary>One-time product discount (Android only, Google Play Billing 7.0+)</summary>
    OneTime
}

public sealed class DiscountOfferTypeJsonConverter : JsonConverter<DiscountOfferType>
{
    private static readonly Dictionary<string, DiscountOfferType> _fromString = new()
    {
        ["introductory"] = DiscountOfferType.Introductory,
        ["INTRODUCTORY"] = DiscountOfferType.Introductory,
        ["Introductory"] = DiscountOfferType.Introductory,
        ["promotional"] = DiscountOfferType.Promotional,
        ["PROMOTIONAL"] = DiscountOfferType.Promotional,
        ["Promotional"] = DiscountOfferType.Promotional,
        ["one-time"] = DiscountOfferType.OneTime,
        ["ONE_TIME"] = DiscountOfferType.OneTime,
        ["OneTime"] = DiscountOfferType.OneTime,
    };

    private static readonly Dictionary<DiscountOfferType, string> _toString = new()
    {
        [DiscountOfferType.Introductory] = "introductory",
        [DiscountOfferType.Promotional] = "promotional",
        [DiscountOfferType.OneTime] = "one-time",
    };

    public override DiscountOfferType Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        var raw = reader.GetString();
        if (raw is not null && _fromString.TryGetValue(raw, out var value)) return value;
        throw new JsonException($"Unknown DiscountOfferType value: {raw}");
    }

    public override void Write(Utf8JsonWriter writer, DiscountOfferType value, JsonSerializerOptions options)
    {
        writer.WriteStringValue(_toString[value]);
    }

    internal static string ToRawString(DiscountOfferType value) => _toString[value];
    internal static DiscountOfferType FromRawString(string value) =>
        _fromString.TryGetValue(value, out var v) ? v : throw new ArgumentException($"Unknown DiscountOfferType value: {value}");
}

public static class DiscountOfferTypeExtensions
{
    public static string ToJson(this DiscountOfferType value) => DiscountOfferTypeJsonConverter.ToRawString(value);
    public static DiscountOfferType FromJson(string value) => DiscountOfferTypeJsonConverter.FromRawString(value);
}

[JsonConverter(typeof(ErrorCodeJsonConverter))]
public enum ErrorCode
{
    Unknown,
    UserCancelled,
    UserError,
    ItemUnavailable,
    RemoteError,
    NetworkError,
    ServiceError,
    ReceiptFailed,
    ReceiptFinished,
    ReceiptFinishedFailed,
    PurchaseVerificationFailed,
    PurchaseVerificationFinished,
    PurchaseVerificationFinishFailed,
    NotPrepared,
    NotEnded,
    AlreadyOwned,
    DeveloperError,
    BillingResponseJsonParseError,
    DeferredPayment,
    Interrupted,
    IapNotAvailable,
    PurchaseError,
    SyncError,
    TransactionValidationFailed,
    ActivityUnavailable,
    AlreadyPrepared,
    Pending,
    ConnectionClosed,
    InitConnection,
    ServiceDisconnected,
    ServiceTimeout,
    QueryProduct,
    SkuNotFound,
    SkuOfferMismatch,
    ItemNotOwned,
    BillingUnavailable,
    FeatureNotSupported,
    EmptySkuList,
    DuplicatePurchase
}

public sealed class ErrorCodeJsonConverter : JsonConverter<ErrorCode>
{
    private static readonly Dictionary<string, ErrorCode> _fromString = new()
    {
        ["unknown"] = ErrorCode.Unknown,
        ["UNKNOWN"] = ErrorCode.Unknown,
        ["Unknown"] = ErrorCode.Unknown,
        ["user-cancelled"] = ErrorCode.UserCancelled,
        ["USER_CANCELLED"] = ErrorCode.UserCancelled,
        ["UserCancelled"] = ErrorCode.UserCancelled,
        ["user-error"] = ErrorCode.UserError,
        ["USER_ERROR"] = ErrorCode.UserError,
        ["UserError"] = ErrorCode.UserError,
        ["item-unavailable"] = ErrorCode.ItemUnavailable,
        ["ITEM_UNAVAILABLE"] = ErrorCode.ItemUnavailable,
        ["ItemUnavailable"] = ErrorCode.ItemUnavailable,
        ["remote-error"] = ErrorCode.RemoteError,
        ["REMOTE_ERROR"] = ErrorCode.RemoteError,
        ["RemoteError"] = ErrorCode.RemoteError,
        ["network-error"] = ErrorCode.NetworkError,
        ["NETWORK_ERROR"] = ErrorCode.NetworkError,
        ["NetworkError"] = ErrorCode.NetworkError,
        ["service-error"] = ErrorCode.ServiceError,
        ["SERVICE_ERROR"] = ErrorCode.ServiceError,
        ["ServiceError"] = ErrorCode.ServiceError,
        ["receipt-failed"] = ErrorCode.ReceiptFailed,
        ["RECEIPT_FAILED"] = ErrorCode.ReceiptFailed,
        ["ReceiptFailed"] = ErrorCode.ReceiptFailed,
        ["receipt-finished"] = ErrorCode.ReceiptFinished,
        ["RECEIPT_FINISHED"] = ErrorCode.ReceiptFinished,
        ["ReceiptFinished"] = ErrorCode.ReceiptFinished,
        ["receipt-finished-failed"] = ErrorCode.ReceiptFinishedFailed,
        ["RECEIPT_FINISHED_FAILED"] = ErrorCode.ReceiptFinishedFailed,
        ["ReceiptFinishedFailed"] = ErrorCode.ReceiptFinishedFailed,
        ["purchase-verification-failed"] = ErrorCode.PurchaseVerificationFailed,
        ["PURCHASE_VERIFICATION_FAILED"] = ErrorCode.PurchaseVerificationFailed,
        ["PurchaseVerificationFailed"] = ErrorCode.PurchaseVerificationFailed,
        ["purchase-verification-finished"] = ErrorCode.PurchaseVerificationFinished,
        ["PURCHASE_VERIFICATION_FINISHED"] = ErrorCode.PurchaseVerificationFinished,
        ["PurchaseVerificationFinished"] = ErrorCode.PurchaseVerificationFinished,
        ["purchase-verification-finish-failed"] = ErrorCode.PurchaseVerificationFinishFailed,
        ["PURCHASE_VERIFICATION_FINISH_FAILED"] = ErrorCode.PurchaseVerificationFinishFailed,
        ["PurchaseVerificationFinishFailed"] = ErrorCode.PurchaseVerificationFinishFailed,
        ["not-prepared"] = ErrorCode.NotPrepared,
        ["NOT_PREPARED"] = ErrorCode.NotPrepared,
        ["NotPrepared"] = ErrorCode.NotPrepared,
        ["not-ended"] = ErrorCode.NotEnded,
        ["NOT_ENDED"] = ErrorCode.NotEnded,
        ["NotEnded"] = ErrorCode.NotEnded,
        ["already-owned"] = ErrorCode.AlreadyOwned,
        ["ALREADY_OWNED"] = ErrorCode.AlreadyOwned,
        ["AlreadyOwned"] = ErrorCode.AlreadyOwned,
        ["developer-error"] = ErrorCode.DeveloperError,
        ["DEVELOPER_ERROR"] = ErrorCode.DeveloperError,
        ["DeveloperError"] = ErrorCode.DeveloperError,
        ["billing-response-json-parse-error"] = ErrorCode.BillingResponseJsonParseError,
        ["BILLING_RESPONSE_JSON_PARSE_ERROR"] = ErrorCode.BillingResponseJsonParseError,
        ["BillingResponseJsonParseError"] = ErrorCode.BillingResponseJsonParseError,
        ["deferred-payment"] = ErrorCode.DeferredPayment,
        ["DEFERRED_PAYMENT"] = ErrorCode.DeferredPayment,
        ["DeferredPayment"] = ErrorCode.DeferredPayment,
        ["interrupted"] = ErrorCode.Interrupted,
        ["INTERRUPTED"] = ErrorCode.Interrupted,
        ["Interrupted"] = ErrorCode.Interrupted,
        ["iap-not-available"] = ErrorCode.IapNotAvailable,
        ["IAP_NOT_AVAILABLE"] = ErrorCode.IapNotAvailable,
        ["IapNotAvailable"] = ErrorCode.IapNotAvailable,
        ["purchase-error"] = ErrorCode.PurchaseError,
        ["PURCHASE_ERROR"] = ErrorCode.PurchaseError,
        ["PurchaseError"] = ErrorCode.PurchaseError,
        ["sync-error"] = ErrorCode.SyncError,
        ["SYNC_ERROR"] = ErrorCode.SyncError,
        ["SyncError"] = ErrorCode.SyncError,
        ["transaction-validation-failed"] = ErrorCode.TransactionValidationFailed,
        ["TRANSACTION_VALIDATION_FAILED"] = ErrorCode.TransactionValidationFailed,
        ["TransactionValidationFailed"] = ErrorCode.TransactionValidationFailed,
        ["activity-unavailable"] = ErrorCode.ActivityUnavailable,
        ["ACTIVITY_UNAVAILABLE"] = ErrorCode.ActivityUnavailable,
        ["ActivityUnavailable"] = ErrorCode.ActivityUnavailable,
        ["already-prepared"] = ErrorCode.AlreadyPrepared,
        ["ALREADY_PREPARED"] = ErrorCode.AlreadyPrepared,
        ["AlreadyPrepared"] = ErrorCode.AlreadyPrepared,
        ["pending"] = ErrorCode.Pending,
        ["PENDING"] = ErrorCode.Pending,
        ["Pending"] = ErrorCode.Pending,
        ["connection-closed"] = ErrorCode.ConnectionClosed,
        ["CONNECTION_CLOSED"] = ErrorCode.ConnectionClosed,
        ["ConnectionClosed"] = ErrorCode.ConnectionClosed,
        ["init-connection"] = ErrorCode.InitConnection,
        ["INIT_CONNECTION"] = ErrorCode.InitConnection,
        ["InitConnection"] = ErrorCode.InitConnection,
        ["service-disconnected"] = ErrorCode.ServiceDisconnected,
        ["SERVICE_DISCONNECTED"] = ErrorCode.ServiceDisconnected,
        ["ServiceDisconnected"] = ErrorCode.ServiceDisconnected,
        ["service-timeout"] = ErrorCode.ServiceTimeout,
        ["SERVICE_TIMEOUT"] = ErrorCode.ServiceTimeout,
        ["ServiceTimeout"] = ErrorCode.ServiceTimeout,
        ["query-product"] = ErrorCode.QueryProduct,
        ["QUERY_PRODUCT"] = ErrorCode.QueryProduct,
        ["QueryProduct"] = ErrorCode.QueryProduct,
        ["sku-not-found"] = ErrorCode.SkuNotFound,
        ["SKU_NOT_FOUND"] = ErrorCode.SkuNotFound,
        ["SkuNotFound"] = ErrorCode.SkuNotFound,
        ["sku-offer-mismatch"] = ErrorCode.SkuOfferMismatch,
        ["SKU_OFFER_MISMATCH"] = ErrorCode.SkuOfferMismatch,
        ["SkuOfferMismatch"] = ErrorCode.SkuOfferMismatch,
        ["item-not-owned"] = ErrorCode.ItemNotOwned,
        ["ITEM_NOT_OWNED"] = ErrorCode.ItemNotOwned,
        ["ItemNotOwned"] = ErrorCode.ItemNotOwned,
        ["billing-unavailable"] = ErrorCode.BillingUnavailable,
        ["BILLING_UNAVAILABLE"] = ErrorCode.BillingUnavailable,
        ["BillingUnavailable"] = ErrorCode.BillingUnavailable,
        ["feature-not-supported"] = ErrorCode.FeatureNotSupported,
        ["FEATURE_NOT_SUPPORTED"] = ErrorCode.FeatureNotSupported,
        ["FeatureNotSupported"] = ErrorCode.FeatureNotSupported,
        ["empty-sku-list"] = ErrorCode.EmptySkuList,
        ["EMPTY_SKU_LIST"] = ErrorCode.EmptySkuList,
        ["EmptySkuList"] = ErrorCode.EmptySkuList,
        ["duplicate-purchase"] = ErrorCode.DuplicatePurchase,
        ["DUPLICATE_PURCHASE"] = ErrorCode.DuplicatePurchase,
        ["DuplicatePurchase"] = ErrorCode.DuplicatePurchase,
    };

    private static readonly Dictionary<ErrorCode, string> _toString = new()
    {
        [ErrorCode.Unknown] = "unknown",
        [ErrorCode.UserCancelled] = "user-cancelled",
        [ErrorCode.UserError] = "user-error",
        [ErrorCode.ItemUnavailable] = "item-unavailable",
        [ErrorCode.RemoteError] = "remote-error",
        [ErrorCode.NetworkError] = "network-error",
        [ErrorCode.ServiceError] = "service-error",
        [ErrorCode.ReceiptFailed] = "receipt-failed",
        [ErrorCode.ReceiptFinished] = "receipt-finished",
        [ErrorCode.ReceiptFinishedFailed] = "receipt-finished-failed",
        [ErrorCode.PurchaseVerificationFailed] = "purchase-verification-failed",
        [ErrorCode.PurchaseVerificationFinished] = "purchase-verification-finished",
        [ErrorCode.PurchaseVerificationFinishFailed] = "purchase-verification-finish-failed",
        [ErrorCode.NotPrepared] = "not-prepared",
        [ErrorCode.NotEnded] = "not-ended",
        [ErrorCode.AlreadyOwned] = "already-owned",
        [ErrorCode.DeveloperError] = "developer-error",
        [ErrorCode.BillingResponseJsonParseError] = "billing-response-json-parse-error",
        [ErrorCode.DeferredPayment] = "deferred-payment",
        [ErrorCode.Interrupted] = "interrupted",
        [ErrorCode.IapNotAvailable] = "iap-not-available",
        [ErrorCode.PurchaseError] = "purchase-error",
        [ErrorCode.SyncError] = "sync-error",
        [ErrorCode.TransactionValidationFailed] = "transaction-validation-failed",
        [ErrorCode.ActivityUnavailable] = "activity-unavailable",
        [ErrorCode.AlreadyPrepared] = "already-prepared",
        [ErrorCode.Pending] = "pending",
        [ErrorCode.ConnectionClosed] = "connection-closed",
        [ErrorCode.InitConnection] = "init-connection",
        [ErrorCode.ServiceDisconnected] = "service-disconnected",
        [ErrorCode.ServiceTimeout] = "service-timeout",
        [ErrorCode.QueryProduct] = "query-product",
        [ErrorCode.SkuNotFound] = "sku-not-found",
        [ErrorCode.SkuOfferMismatch] = "sku-offer-mismatch",
        [ErrorCode.ItemNotOwned] = "item-not-owned",
        [ErrorCode.BillingUnavailable] = "billing-unavailable",
        [ErrorCode.FeatureNotSupported] = "feature-not-supported",
        [ErrorCode.EmptySkuList] = "empty-sku-list",
        [ErrorCode.DuplicatePurchase] = "duplicate-purchase",
    };

    public override ErrorCode Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        var raw = reader.GetString();
        if (raw is not null && _fromString.TryGetValue(raw, out var value)) return value;
        throw new JsonException($"Unknown ErrorCode value: {raw}");
    }

    public override void Write(Utf8JsonWriter writer, ErrorCode value, JsonSerializerOptions options)
    {
        writer.WriteStringValue(_toString[value]);
    }

    internal static string ToRawString(ErrorCode value) => _toString[value];
    internal static ErrorCode FromRawString(string value) =>
        _fromString.TryGetValue(value, out var v) ? v : throw new ArgumentException($"Unknown ErrorCode value: {value}");
}

public static class ErrorCodeExtensions
{
    public static string ToJson(this ErrorCode value) => ErrorCodeJsonConverter.ToRawString(value);
    public static ErrorCode FromJson(string value) => ErrorCodeJsonConverter.FromRawString(value);
}

/// <summary>Launch mode for external link flow (Android)</summary>
/// <summary>Determines how the external URL is launched</summary>
/// <summary>Available in Google Play Billing Library 8.2.0+</summary>
[JsonConverter(typeof(ExternalLinkLaunchModeAndroidJsonConverter))]
public enum ExternalLinkLaunchModeAndroid
{
    /// <summary>Unspecified launch mode. Do not use.</summary>
    Unspecified,
    /// <summary>Play will launch the URL in an external browser or eligible app</summary>
    LaunchInExternalBrowserOrApp,
    /// <summary>Play will not launch the URL. The app handles launching the URL after Play returns control.</summary>
    CallerWillLaunchLink
}

public sealed class ExternalLinkLaunchModeAndroidJsonConverter : JsonConverter<ExternalLinkLaunchModeAndroid>
{
    private static readonly Dictionary<string, ExternalLinkLaunchModeAndroid> _fromString = new()
    {
        ["unspecified"] = ExternalLinkLaunchModeAndroid.Unspecified,
        ["UNSPECIFIED"] = ExternalLinkLaunchModeAndroid.Unspecified,
        ["launch-in-external-browser-or-app"] = ExternalLinkLaunchModeAndroid.LaunchInExternalBrowserOrApp,
        ["LAUNCH_IN_EXTERNAL_BROWSER_OR_APP"] = ExternalLinkLaunchModeAndroid.LaunchInExternalBrowserOrApp,
        ["caller-will-launch-link"] = ExternalLinkLaunchModeAndroid.CallerWillLaunchLink,
        ["CALLER_WILL_LAUNCH_LINK"] = ExternalLinkLaunchModeAndroid.CallerWillLaunchLink,
    };

    private static readonly Dictionary<ExternalLinkLaunchModeAndroid, string> _toString = new()
    {
        [ExternalLinkLaunchModeAndroid.Unspecified] = "unspecified",
        [ExternalLinkLaunchModeAndroid.LaunchInExternalBrowserOrApp] = "launch-in-external-browser-or-app",
        [ExternalLinkLaunchModeAndroid.CallerWillLaunchLink] = "caller-will-launch-link",
    };

    public override ExternalLinkLaunchModeAndroid Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        var raw = reader.GetString();
        if (raw is not null && _fromString.TryGetValue(raw, out var value)) return value;
        throw new JsonException($"Unknown ExternalLinkLaunchModeAndroid value: {raw}");
    }

    public override void Write(Utf8JsonWriter writer, ExternalLinkLaunchModeAndroid value, JsonSerializerOptions options)
    {
        writer.WriteStringValue(_toString[value]);
    }

    internal static string ToRawString(ExternalLinkLaunchModeAndroid value) => _toString[value];
    internal static ExternalLinkLaunchModeAndroid FromRawString(string value) =>
        _fromString.TryGetValue(value, out var v) ? v : throw new ArgumentException($"Unknown ExternalLinkLaunchModeAndroid value: {value}");
}

public static class ExternalLinkLaunchModeAndroidExtensions
{
    public static string ToJson(this ExternalLinkLaunchModeAndroid value) => ExternalLinkLaunchModeAndroidJsonConverter.ToRawString(value);
    public static ExternalLinkLaunchModeAndroid FromJson(string value) => ExternalLinkLaunchModeAndroidJsonConverter.FromRawString(value);
}

/// <summary>Link type for external link flow (Android)</summary>
/// <summary>Specifies the type of external link destination</summary>
/// <summary>Available in Google Play Billing Library 8.2.0+</summary>
[JsonConverter(typeof(ExternalLinkTypeAndroidJsonConverter))]
public enum ExternalLinkTypeAndroid
{
    /// <summary>Unspecified link type. Do not use.</summary>
    Unspecified,
    /// <summary>The link will direct users to a digital content offer</summary>
    LinkToDigitalContentOffer,
    /// <summary>The link will direct users to download an app</summary>
    LinkToAppDownload
}

public sealed class ExternalLinkTypeAndroidJsonConverter : JsonConverter<ExternalLinkTypeAndroid>
{
    private static readonly Dictionary<string, ExternalLinkTypeAndroid> _fromString = new()
    {
        ["unspecified"] = ExternalLinkTypeAndroid.Unspecified,
        ["UNSPECIFIED"] = ExternalLinkTypeAndroid.Unspecified,
        ["link-to-digital-content-offer"] = ExternalLinkTypeAndroid.LinkToDigitalContentOffer,
        ["LINK_TO_DIGITAL_CONTENT_OFFER"] = ExternalLinkTypeAndroid.LinkToDigitalContentOffer,
        ["link-to-app-download"] = ExternalLinkTypeAndroid.LinkToAppDownload,
        ["LINK_TO_APP_DOWNLOAD"] = ExternalLinkTypeAndroid.LinkToAppDownload,
    };

    private static readonly Dictionary<ExternalLinkTypeAndroid, string> _toString = new()
    {
        [ExternalLinkTypeAndroid.Unspecified] = "unspecified",
        [ExternalLinkTypeAndroid.LinkToDigitalContentOffer] = "link-to-digital-content-offer",
        [ExternalLinkTypeAndroid.LinkToAppDownload] = "link-to-app-download",
    };

    public override ExternalLinkTypeAndroid Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        var raw = reader.GetString();
        if (raw is not null && _fromString.TryGetValue(raw, out var value)) return value;
        throw new JsonException($"Unknown ExternalLinkTypeAndroid value: {raw}");
    }

    public override void Write(Utf8JsonWriter writer, ExternalLinkTypeAndroid value, JsonSerializerOptions options)
    {
        writer.WriteStringValue(_toString[value]);
    }

    internal static string ToRawString(ExternalLinkTypeAndroid value) => _toString[value];
    internal static ExternalLinkTypeAndroid FromRawString(string value) =>
        _fromString.TryGetValue(value, out var v) ? v : throw new ArgumentException($"Unknown ExternalLinkTypeAndroid value: {value}");
}

public static class ExternalLinkTypeAndroidExtensions
{
    public static string ToJson(this ExternalLinkTypeAndroid value) => ExternalLinkTypeAndroidJsonConverter.ToRawString(value);
    public static ExternalLinkTypeAndroid FromJson(string value) => ExternalLinkTypeAndroidJsonConverter.FromRawString(value);
}

/// <summary>Notice types for ExternalPurchaseCustomLink (iOS 18.1+).</summary>
/// <summary>Determines the style of disclosure notice to display.</summary>
/// <summary>Reference: https://developer.apple.com/documentation/storekit/externalpurchasecustomlink/noticetype</summary>
[JsonConverter(typeof(ExternalPurchaseCustomLinkNoticeTypeIOSJsonConverter))]
public enum ExternalPurchaseCustomLinkNoticeTypeIOS
{
    /// <summary>Notice type indicating external purchases will be displayed in a browser</summary>
    /// <summary>or destination of the app&apos;s choice.</summary>
    Browser
}

public sealed class ExternalPurchaseCustomLinkNoticeTypeIOSJsonConverter : JsonConverter<ExternalPurchaseCustomLinkNoticeTypeIOS>
{
    private static readonly Dictionary<string, ExternalPurchaseCustomLinkNoticeTypeIOS> _fromString = new()
    {
        ["browser"] = ExternalPurchaseCustomLinkNoticeTypeIOS.Browser,
        ["BROWSER"] = ExternalPurchaseCustomLinkNoticeTypeIOS.Browser,
        ["Browser"] = ExternalPurchaseCustomLinkNoticeTypeIOS.Browser,
    };

    private static readonly Dictionary<ExternalPurchaseCustomLinkNoticeTypeIOS, string> _toString = new()
    {
        [ExternalPurchaseCustomLinkNoticeTypeIOS.Browser] = "browser",
    };

    public override ExternalPurchaseCustomLinkNoticeTypeIOS Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        var raw = reader.GetString();
        if (raw is not null && _fromString.TryGetValue(raw, out var value)) return value;
        throw new JsonException($"Unknown ExternalPurchaseCustomLinkNoticeTypeIOS value: {raw}");
    }

    public override void Write(Utf8JsonWriter writer, ExternalPurchaseCustomLinkNoticeTypeIOS value, JsonSerializerOptions options)
    {
        writer.WriteStringValue(_toString[value]);
    }

    internal static string ToRawString(ExternalPurchaseCustomLinkNoticeTypeIOS value) => _toString[value];
    internal static ExternalPurchaseCustomLinkNoticeTypeIOS FromRawString(string value) =>
        _fromString.TryGetValue(value, out var v) ? v : throw new ArgumentException($"Unknown ExternalPurchaseCustomLinkNoticeTypeIOS value: {value}");
}

public static class ExternalPurchaseCustomLinkNoticeTypeIOSExtensions
{
    public static string ToJson(this ExternalPurchaseCustomLinkNoticeTypeIOS value) => ExternalPurchaseCustomLinkNoticeTypeIOSJsonConverter.ToRawString(value);
    public static ExternalPurchaseCustomLinkNoticeTypeIOS FromJson(string value) => ExternalPurchaseCustomLinkNoticeTypeIOSJsonConverter.FromRawString(value);
}

/// <summary>Token types for ExternalPurchaseCustomLink (iOS 18.1+).</summary>
/// <summary>Used to request different types of external purchase tokens for reporting to Apple.</summary>
/// <summary>Reference: https://developer.apple.com/documentation/storekit/externalpurchasecustomlink/token(for:)</summary>
[JsonConverter(typeof(ExternalPurchaseCustomLinkTokenTypeIOSJsonConverter))]
public enum ExternalPurchaseCustomLinkTokenTypeIOS
{
    /// <summary>Token for customer acquisition tracking.</summary>
    /// <summary>Use this when a new customer makes their first purchase through external link.</summary>
    Acquisition,
    /// <summary>Token for ongoing services tracking.</summary>
    /// <summary>Use this for existing customers making additional purchases.</summary>
    Services
}

public sealed class ExternalPurchaseCustomLinkTokenTypeIOSJsonConverter : JsonConverter<ExternalPurchaseCustomLinkTokenTypeIOS>
{
    private static readonly Dictionary<string, ExternalPurchaseCustomLinkTokenTypeIOS> _fromString = new()
    {
        ["acquisition"] = ExternalPurchaseCustomLinkTokenTypeIOS.Acquisition,
        ["ACQUISITION"] = ExternalPurchaseCustomLinkTokenTypeIOS.Acquisition,
        ["Acquisition"] = ExternalPurchaseCustomLinkTokenTypeIOS.Acquisition,
        ["services"] = ExternalPurchaseCustomLinkTokenTypeIOS.Services,
        ["SERVICES"] = ExternalPurchaseCustomLinkTokenTypeIOS.Services,
        ["Services"] = ExternalPurchaseCustomLinkTokenTypeIOS.Services,
    };

    private static readonly Dictionary<ExternalPurchaseCustomLinkTokenTypeIOS, string> _toString = new()
    {
        [ExternalPurchaseCustomLinkTokenTypeIOS.Acquisition] = "acquisition",
        [ExternalPurchaseCustomLinkTokenTypeIOS.Services] = "services",
    };

    public override ExternalPurchaseCustomLinkTokenTypeIOS Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        var raw = reader.GetString();
        if (raw is not null && _fromString.TryGetValue(raw, out var value)) return value;
        throw new JsonException($"Unknown ExternalPurchaseCustomLinkTokenTypeIOS value: {raw}");
    }

    public override void Write(Utf8JsonWriter writer, ExternalPurchaseCustomLinkTokenTypeIOS value, JsonSerializerOptions options)
    {
        writer.WriteStringValue(_toString[value]);
    }

    internal static string ToRawString(ExternalPurchaseCustomLinkTokenTypeIOS value) => _toString[value];
    internal static ExternalPurchaseCustomLinkTokenTypeIOS FromRawString(string value) =>
        _fromString.TryGetValue(value, out var v) ? v : throw new ArgumentException($"Unknown ExternalPurchaseCustomLinkTokenTypeIOS value: {value}");
}

public static class ExternalPurchaseCustomLinkTokenTypeIOSExtensions
{
    public static string ToJson(this ExternalPurchaseCustomLinkTokenTypeIOS value) => ExternalPurchaseCustomLinkTokenTypeIOSJsonConverter.ToRawString(value);
    public static ExternalPurchaseCustomLinkTokenTypeIOS FromJson(string value) => ExternalPurchaseCustomLinkTokenTypeIOSJsonConverter.FromRawString(value);
}

/// <summary>User actions on external purchase notice sheet (iOS 17.4+)</summary>
[JsonConverter(typeof(ExternalPurchaseNoticeActionJsonConverter))]
public enum ExternalPurchaseNoticeAction
{
    /// <summary>User chose to continue to external purchase</summary>
    Continue,
    /// <summary>User dismissed the notice sheet</summary>
    Dismissed
}

public sealed class ExternalPurchaseNoticeActionJsonConverter : JsonConverter<ExternalPurchaseNoticeAction>
{
    private static readonly Dictionary<string, ExternalPurchaseNoticeAction> _fromString = new()
    {
        ["continue"] = ExternalPurchaseNoticeAction.Continue,
        ["CONTINUE"] = ExternalPurchaseNoticeAction.Continue,
        ["Continue"] = ExternalPurchaseNoticeAction.Continue,
        ["dismissed"] = ExternalPurchaseNoticeAction.Dismissed,
        ["DISMISSED"] = ExternalPurchaseNoticeAction.Dismissed,
        ["Dismissed"] = ExternalPurchaseNoticeAction.Dismissed,
    };

    private static readonly Dictionary<ExternalPurchaseNoticeAction, string> _toString = new()
    {
        [ExternalPurchaseNoticeAction.Continue] = "continue",
        [ExternalPurchaseNoticeAction.Dismissed] = "dismissed",
    };

    public override ExternalPurchaseNoticeAction Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        var raw = reader.GetString();
        if (raw is not null && _fromString.TryGetValue(raw, out var value)) return value;
        throw new JsonException($"Unknown ExternalPurchaseNoticeAction value: {raw}");
    }

    public override void Write(Utf8JsonWriter writer, ExternalPurchaseNoticeAction value, JsonSerializerOptions options)
    {
        writer.WriteStringValue(_toString[value]);
    }

    internal static string ToRawString(ExternalPurchaseNoticeAction value) => _toString[value];
    internal static ExternalPurchaseNoticeAction FromRawString(string value) =>
        _fromString.TryGetValue(value, out var v) ? v : throw new ArgumentException($"Unknown ExternalPurchaseNoticeAction value: {value}");
}

public static class ExternalPurchaseNoticeActionExtensions
{
    public static string ToJson(this ExternalPurchaseNoticeAction value) => ExternalPurchaseNoticeActionJsonConverter.ToRawString(value);
    public static ExternalPurchaseNoticeAction FromJson(string value) => ExternalPurchaseNoticeActionJsonConverter.FromRawString(value);
}

[JsonConverter(typeof(IapEventJsonConverter))]
public enum IapEvent
{
    PurchaseUpdated,
    PurchaseError,
    PromotedProductIOS,
    UserChoiceBillingAndroid,
    /// <summary>Fired when user selects developer-provided billing option in external payments flow.</summary>
    /// <summary>Available on Android with Google Play Billing Library 8.3.0+</summary>
    DeveloperProvidedBillingAndroid,
    /// <summary>Fired when an active subscription enters a billing-issue state that requires user attention.</summary>
    /// <summary>Cross-platform unification of StoreKit 2 Message.billingIssue (iOS 18+) and</summary>
    /// <summary>Play Billing 8.1+ isSuspended. NOT emitted on the Horizon flavor, whose Billing</summary>
    /// <summary>Compatibility SDK implements only the Play Billing 7.0 API surface.</summary>
    SubscriptionBillingIssue
}

public sealed class IapEventJsonConverter : JsonConverter<IapEvent>
{
    private static readonly Dictionary<string, IapEvent> _fromString = new()
    {
        ["purchase-updated"] = IapEvent.PurchaseUpdated,
        ["PURCHASE_UPDATED"] = IapEvent.PurchaseUpdated,
        ["PurchaseUpdated"] = IapEvent.PurchaseUpdated,
        ["purchase-error"] = IapEvent.PurchaseError,
        ["PURCHASE_ERROR"] = IapEvent.PurchaseError,
        ["PurchaseError"] = IapEvent.PurchaseError,
        ["promoted-product-ios"] = IapEvent.PromotedProductIOS,
        ["PROMOTED_PRODUCT_IOS"] = IapEvent.PromotedProductIOS,
        ["PromotedProductIOS"] = IapEvent.PromotedProductIOS,
        ["user-choice-billing-android"] = IapEvent.UserChoiceBillingAndroid,
        ["USER_CHOICE_BILLING_ANDROID"] = IapEvent.UserChoiceBillingAndroid,
        ["UserChoiceBillingAndroid"] = IapEvent.UserChoiceBillingAndroid,
        ["developer-provided-billing-android"] = IapEvent.DeveloperProvidedBillingAndroid,
        ["DEVELOPER_PROVIDED_BILLING_ANDROID"] = IapEvent.DeveloperProvidedBillingAndroid,
        ["DeveloperProvidedBillingAndroid"] = IapEvent.DeveloperProvidedBillingAndroid,
        ["subscription-billing-issue"] = IapEvent.SubscriptionBillingIssue,
        ["SUBSCRIPTION_BILLING_ISSUE"] = IapEvent.SubscriptionBillingIssue,
        ["SubscriptionBillingIssue"] = IapEvent.SubscriptionBillingIssue,
    };

    private static readonly Dictionary<IapEvent, string> _toString = new()
    {
        [IapEvent.PurchaseUpdated] = "purchase-updated",
        [IapEvent.PurchaseError] = "purchase-error",
        [IapEvent.PromotedProductIOS] = "promoted-product-ios",
        [IapEvent.UserChoiceBillingAndroid] = "user-choice-billing-android",
        [IapEvent.DeveloperProvidedBillingAndroid] = "developer-provided-billing-android",
        [IapEvent.SubscriptionBillingIssue] = "subscription-billing-issue",
    };

    public override IapEvent Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        var raw = reader.GetString();
        if (raw is not null && _fromString.TryGetValue(raw, out var value)) return value;
        throw new JsonException($"Unknown IapEvent value: {raw}");
    }

    public override void Write(Utf8JsonWriter writer, IapEvent value, JsonSerializerOptions options)
    {
        writer.WriteStringValue(_toString[value]);
    }

    internal static string ToRawString(IapEvent value) => _toString[value];
    internal static IapEvent FromRawString(string value) =>
        _fromString.TryGetValue(value, out var v) ? v : throw new ArgumentException($"Unknown IapEvent value: {value}");
}

public static class IapEventExtensions
{
    public static string ToJson(this IapEvent value) => IapEventJsonConverter.ToRawString(value);
    public static IapEvent FromJson(string value) => IapEventJsonConverter.FromRawString(value);
}

/// <summary>Unified purchase states from IAPKit verification response.</summary>
[JsonConverter(typeof(IapkitPurchaseStateJsonConverter))]
public enum IapkitPurchaseState
{
    /// <summary>User is entitled to the product (purchase is complete and active).</summary>
    Entitled,
    /// <summary>Receipt is valid but still needs server acknowledgment.</summary>
    PendingAcknowledgment,
    /// <summary>Purchase is in progress or awaiting confirmation.</summary>
    Pending,
    /// <summary>Purchase was cancelled or refunded.</summary>
    Canceled,
    /// <summary>Subscription or entitlement has expired.</summary>
    Expired,
    /// <summary>Consumable purchase is ready to be fulfilled.</summary>
    ReadyToConsume,
    /// <summary>Consumable item has been fulfilled/consumed.</summary>
    Consumed,
    /// <summary>Purchase state could not be determined.</summary>
    Unknown,
    /// <summary>Purchase receipt is not authentic (fraudulent or tampered).</summary>
    Inauthentic
}

public sealed class IapkitPurchaseStateJsonConverter : JsonConverter<IapkitPurchaseState>
{
    private static readonly Dictionary<string, IapkitPurchaseState> _fromString = new()
    {
        ["entitled"] = IapkitPurchaseState.Entitled,
        ["ENTITLED"] = IapkitPurchaseState.Entitled,
        ["pending-acknowledgment"] = IapkitPurchaseState.PendingAcknowledgment,
        ["PENDING_ACKNOWLEDGMENT"] = IapkitPurchaseState.PendingAcknowledgment,
        ["pending"] = IapkitPurchaseState.Pending,
        ["PENDING"] = IapkitPurchaseState.Pending,
        ["canceled"] = IapkitPurchaseState.Canceled,
        ["CANCELED"] = IapkitPurchaseState.Canceled,
        ["expired"] = IapkitPurchaseState.Expired,
        ["EXPIRED"] = IapkitPurchaseState.Expired,
        ["ready-to-consume"] = IapkitPurchaseState.ReadyToConsume,
        ["READY_TO_CONSUME"] = IapkitPurchaseState.ReadyToConsume,
        ["consumed"] = IapkitPurchaseState.Consumed,
        ["CONSUMED"] = IapkitPurchaseState.Consumed,
        ["unknown"] = IapkitPurchaseState.Unknown,
        ["UNKNOWN"] = IapkitPurchaseState.Unknown,
        ["inauthentic"] = IapkitPurchaseState.Inauthentic,
        ["INAUTHENTIC"] = IapkitPurchaseState.Inauthentic,
    };

    private static readonly Dictionary<IapkitPurchaseState, string> _toString = new()
    {
        [IapkitPurchaseState.Entitled] = "entitled",
        [IapkitPurchaseState.PendingAcknowledgment] = "pending-acknowledgment",
        [IapkitPurchaseState.Pending] = "pending",
        [IapkitPurchaseState.Canceled] = "canceled",
        [IapkitPurchaseState.Expired] = "expired",
        [IapkitPurchaseState.ReadyToConsume] = "ready-to-consume",
        [IapkitPurchaseState.Consumed] = "consumed",
        [IapkitPurchaseState.Unknown] = "unknown",
        [IapkitPurchaseState.Inauthentic] = "inauthentic",
    };

    public override IapkitPurchaseState Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        var raw = reader.GetString();
        if (raw is not null && _fromString.TryGetValue(raw, out var value)) return value;
        throw new JsonException($"Unknown IapkitPurchaseState value: {raw}");
    }

    public override void Write(Utf8JsonWriter writer, IapkitPurchaseState value, JsonSerializerOptions options)
    {
        writer.WriteStringValue(_toString[value]);
    }

    internal static string ToRawString(IapkitPurchaseState value) => _toString[value];
    internal static IapkitPurchaseState FromRawString(string value) =>
        _fromString.TryGetValue(value, out var v) ? v : throw new ArgumentException($"Unknown IapkitPurchaseState value: {value}");
}

public static class IapkitPurchaseStateExtensions
{
    public static string ToJson(this IapkitPurchaseState value) => IapkitPurchaseStateJsonConverter.ToRawString(value);
    public static IapkitPurchaseState FromJson(string value) => IapkitPurchaseStateJsonConverter.FromRawString(value);
}

[JsonConverter(typeof(IapPlatformJsonConverter))]
public enum IapPlatform
{
    IOS,
    Android
}

public sealed class IapPlatformJsonConverter : JsonConverter<IapPlatform>
{
    private static readonly Dictionary<string, IapPlatform> _fromString = new()
    {
        ["ios"] = IapPlatform.IOS,
        ["IOS"] = IapPlatform.IOS,
        ["android"] = IapPlatform.Android,
        ["ANDROID"] = IapPlatform.Android,
        ["Android"] = IapPlatform.Android,
    };

    private static readonly Dictionary<IapPlatform, string> _toString = new()
    {
        [IapPlatform.IOS] = "ios",
        [IapPlatform.Android] = "android",
    };

    public override IapPlatform Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        var raw = reader.GetString();
        if (raw is not null && _fromString.TryGetValue(raw, out var value)) return value;
        throw new JsonException($"Unknown IapPlatform value: {raw}");
    }

    public override void Write(Utf8JsonWriter writer, IapPlatform value, JsonSerializerOptions options)
    {
        writer.WriteStringValue(_toString[value]);
    }

    internal static string ToRawString(IapPlatform value) => _toString[value];
    internal static IapPlatform FromRawString(string value) =>
        _fromString.TryGetValue(value, out var v) ? v : throw new ArgumentException($"Unknown IapPlatform value: {value}");
}

public static class IapPlatformExtensions
{
    public static string ToJson(this IapPlatform value) => IapPlatformJsonConverter.ToRawString(value);
    public static IapPlatform FromJson(string value) => IapPlatformJsonConverter.FromRawString(value);
}

[JsonConverter(typeof(IapStoreJsonConverter))]
public enum IapStore
{
    Unknown,
    Apple,
    Google,
    Horizon,
    Amazon
}

public sealed class IapStoreJsonConverter : JsonConverter<IapStore>
{
    private static readonly Dictionary<string, IapStore> _fromString = new()
    {
        ["unknown"] = IapStore.Unknown,
        ["UNKNOWN"] = IapStore.Unknown,
        ["Unknown"] = IapStore.Unknown,
        ["apple"] = IapStore.Apple,
        ["APPLE"] = IapStore.Apple,
        ["Apple"] = IapStore.Apple,
        ["google"] = IapStore.Google,
        ["GOOGLE"] = IapStore.Google,
        ["Google"] = IapStore.Google,
        ["horizon"] = IapStore.Horizon,
        ["HORIZON"] = IapStore.Horizon,
        ["Horizon"] = IapStore.Horizon,
        ["amazon"] = IapStore.Amazon,
        ["AMAZON"] = IapStore.Amazon,
        ["Amazon"] = IapStore.Amazon,
    };

    private static readonly Dictionary<IapStore, string> _toString = new()
    {
        [IapStore.Unknown] = "unknown",
        [IapStore.Apple] = "apple",
        [IapStore.Google] = "google",
        [IapStore.Horizon] = "horizon",
        [IapStore.Amazon] = "amazon",
    };

    public override IapStore Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        var raw = reader.GetString();
        if (raw is not null && _fromString.TryGetValue(raw, out var value)) return value;
        throw new JsonException($"Unknown IapStore value: {raw}");
    }

    public override void Write(Utf8JsonWriter writer, IapStore value, JsonSerializerOptions options)
    {
        writer.WriteStringValue(_toString[value]);
    }

    internal static string ToRawString(IapStore value) => _toString[value];
    internal static IapStore FromRawString(string value) =>
        _fromString.TryGetValue(value, out var v) ? v : throw new ArgumentException($"Unknown IapStore value: {value}");
}

public static class IapStoreExtensions
{
    public static string ToJson(this IapStore value) => IapStoreJsonConverter.ToRawString(value);
    public static IapStore FromJson(string value) => IapStoreJsonConverter.FromRawString(value);
}

/// <summary>Payment mode for subscription offers.</summary>
/// <summary>Determines how the user pays during the offer period.</summary>
[JsonConverter(typeof(PaymentModeJsonConverter))]
public enum PaymentMode
{
    /// <summary>Free trial period - no charge during offer</summary>
    FreeTrial,
    /// <summary>Pay each period at reduced price</summary>
    PayAsYouGo,
    /// <summary>Pay full discounted amount upfront</summary>
    PayUpFront,
    /// <summary>Unknown or unspecified payment mode</summary>
    Unknown
}

public sealed class PaymentModeJsonConverter : JsonConverter<PaymentMode>
{
    private static readonly Dictionary<string, PaymentMode> _fromString = new()
    {
        ["free-trial"] = PaymentMode.FreeTrial,
        ["FREE_TRIAL"] = PaymentMode.FreeTrial,
        ["FreeTrial"] = PaymentMode.FreeTrial,
        ["pay-as-you-go"] = PaymentMode.PayAsYouGo,
        ["PAY_AS_YOU_GO"] = PaymentMode.PayAsYouGo,
        ["PayAsYouGo"] = PaymentMode.PayAsYouGo,
        ["pay-up-front"] = PaymentMode.PayUpFront,
        ["PAY_UP_FRONT"] = PaymentMode.PayUpFront,
        ["PayUpFront"] = PaymentMode.PayUpFront,
        ["unknown"] = PaymentMode.Unknown,
        ["UNKNOWN"] = PaymentMode.Unknown,
        ["Unknown"] = PaymentMode.Unknown,
    };

    private static readonly Dictionary<PaymentMode, string> _toString = new()
    {
        [PaymentMode.FreeTrial] = "free-trial",
        [PaymentMode.PayAsYouGo] = "pay-as-you-go",
        [PaymentMode.PayUpFront] = "pay-up-front",
        [PaymentMode.Unknown] = "unknown",
    };

    public override PaymentMode Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        var raw = reader.GetString();
        if (raw is not null && _fromString.TryGetValue(raw, out var value)) return value;
        throw new JsonException($"Unknown PaymentMode value: {raw}");
    }

    public override void Write(Utf8JsonWriter writer, PaymentMode value, JsonSerializerOptions options)
    {
        writer.WriteStringValue(_toString[value]);
    }

    internal static string ToRawString(PaymentMode value) => _toString[value];
    internal static PaymentMode FromRawString(string value) =>
        _fromString.TryGetValue(value, out var v) ? v : throw new ArgumentException($"Unknown PaymentMode value: {value}");
}

public static class PaymentModeExtensions
{
    public static string ToJson(this PaymentMode value) => PaymentModeJsonConverter.ToRawString(value);
    public static PaymentMode FromJson(string value) => PaymentModeJsonConverter.FromRawString(value);
}

[JsonConverter(typeof(PaymentModeIOSJsonConverter))]
public enum PaymentModeIOS
{
    Empty,
    FreeTrial,
    PayAsYouGo,
    PayUpFront
}

public sealed class PaymentModeIOSJsonConverter : JsonConverter<PaymentModeIOS>
{
    private static readonly Dictionary<string, PaymentModeIOS> _fromString = new()
    {
        ["empty"] = PaymentModeIOS.Empty,
        ["EMPTY"] = PaymentModeIOS.Empty,
        ["Empty"] = PaymentModeIOS.Empty,
        ["free-trial"] = PaymentModeIOS.FreeTrial,
        ["FREE_TRIAL"] = PaymentModeIOS.FreeTrial,
        ["FreeTrial"] = PaymentModeIOS.FreeTrial,
        ["pay-as-you-go"] = PaymentModeIOS.PayAsYouGo,
        ["PAY_AS_YOU_GO"] = PaymentModeIOS.PayAsYouGo,
        ["PayAsYouGo"] = PaymentModeIOS.PayAsYouGo,
        ["pay-up-front"] = PaymentModeIOS.PayUpFront,
        ["PAY_UP_FRONT"] = PaymentModeIOS.PayUpFront,
        ["PayUpFront"] = PaymentModeIOS.PayUpFront,
    };

    private static readonly Dictionary<PaymentModeIOS, string> _toString = new()
    {
        [PaymentModeIOS.Empty] = "empty",
        [PaymentModeIOS.FreeTrial] = "free-trial",
        [PaymentModeIOS.PayAsYouGo] = "pay-as-you-go",
        [PaymentModeIOS.PayUpFront] = "pay-up-front",
    };

    public override PaymentModeIOS Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        var raw = reader.GetString();
        if (raw is not null && _fromString.TryGetValue(raw, out var value)) return value;
        throw new JsonException($"Unknown PaymentModeIOS value: {raw}");
    }

    public override void Write(Utf8JsonWriter writer, PaymentModeIOS value, JsonSerializerOptions options)
    {
        writer.WriteStringValue(_toString[value]);
    }

    internal static string ToRawString(PaymentModeIOS value) => _toString[value];
    internal static PaymentModeIOS FromRawString(string value) =>
        _fromString.TryGetValue(value, out var v) ? v : throw new ArgumentException($"Unknown PaymentModeIOS value: {value}");
}

public static class PaymentModeIOSExtensions
{
    public static string ToJson(this PaymentModeIOS value) => PaymentModeIOSJsonConverter.ToRawString(value);
    public static PaymentModeIOS FromJson(string value) => PaymentModeIOSJsonConverter.FromRawString(value);
}

[JsonConverter(typeof(ProductQueryTypeJsonConverter))]
public enum ProductQueryType
{
    InApp,
    Subs,
    All
}

public sealed class ProductQueryTypeJsonConverter : JsonConverter<ProductQueryType>
{
    private static readonly Dictionary<string, ProductQueryType> _fromString = new()
    {
        ["in-app"] = ProductQueryType.InApp,
        ["IN_APP"] = ProductQueryType.InApp,
        ["InApp"] = ProductQueryType.InApp,
        ["subs"] = ProductQueryType.Subs,
        ["SUBS"] = ProductQueryType.Subs,
        ["Subs"] = ProductQueryType.Subs,
        ["all"] = ProductQueryType.All,
        ["ALL"] = ProductQueryType.All,
        ["All"] = ProductQueryType.All,
    };

    private static readonly Dictionary<ProductQueryType, string> _toString = new()
    {
        [ProductQueryType.InApp] = "in-app",
        [ProductQueryType.Subs] = "subs",
        [ProductQueryType.All] = "all",
    };

    public override ProductQueryType Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        var raw = reader.GetString();
        if (raw is not null && _fromString.TryGetValue(raw, out var value)) return value;
        throw new JsonException($"Unknown ProductQueryType value: {raw}");
    }

    public override void Write(Utf8JsonWriter writer, ProductQueryType value, JsonSerializerOptions options)
    {
        writer.WriteStringValue(_toString[value]);
    }

    internal static string ToRawString(ProductQueryType value) => _toString[value];
    internal static ProductQueryType FromRawString(string value) =>
        _fromString.TryGetValue(value, out var v) ? v : throw new ArgumentException($"Unknown ProductQueryType value: {value}");
}

public static class ProductQueryTypeExtensions
{
    public static string ToJson(this ProductQueryType value) => ProductQueryTypeJsonConverter.ToRawString(value);
    public static ProductQueryType FromJson(string value) => ProductQueryTypeJsonConverter.FromRawString(value);
}

/// <summary>Status code for individual products returned from queryProductDetailsAsync (Android)</summary>
/// <summary>Prior to 8.0, products that couldn&apos;t be fetched were simply not returned.</summary>
/// <summary>With 8.0+, these products are returned with a status code explaining why.</summary>
/// <summary>Available in Google Play Billing Library 8.0.0+</summary>
[JsonConverter(typeof(ProductStatusAndroidJsonConverter))]
public enum ProductStatusAndroid
{
    /// <summary>Product was successfully fetched</summary>
    Ok,
    /// <summary>Product not found - the SKU doesn&apos;t exist in the Play Console</summary>
    NotFound,
    /// <summary>No offers available for the user - product exists but user is not eligible for any offers</summary>
    NoOffersAvailable,
    /// <summary>Unknown error occurred while fetching the product</summary>
    Unknown
}

public sealed class ProductStatusAndroidJsonConverter : JsonConverter<ProductStatusAndroid>
{
    private static readonly Dictionary<string, ProductStatusAndroid> _fromString = new()
    {
        ["ok"] = ProductStatusAndroid.Ok,
        ["OK"] = ProductStatusAndroid.Ok,
        ["not-found"] = ProductStatusAndroid.NotFound,
        ["NOT_FOUND"] = ProductStatusAndroid.NotFound,
        ["no-offers-available"] = ProductStatusAndroid.NoOffersAvailable,
        ["NO_OFFERS_AVAILABLE"] = ProductStatusAndroid.NoOffersAvailable,
        ["unknown"] = ProductStatusAndroid.Unknown,
        ["UNKNOWN"] = ProductStatusAndroid.Unknown,
    };

    private static readonly Dictionary<ProductStatusAndroid, string> _toString = new()
    {
        [ProductStatusAndroid.Ok] = "ok",
        [ProductStatusAndroid.NotFound] = "not-found",
        [ProductStatusAndroid.NoOffersAvailable] = "no-offers-available",
        [ProductStatusAndroid.Unknown] = "unknown",
    };

    public override ProductStatusAndroid Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        var raw = reader.GetString();
        if (raw is not null && _fromString.TryGetValue(raw, out var value)) return value;
        throw new JsonException($"Unknown ProductStatusAndroid value: {raw}");
    }

    public override void Write(Utf8JsonWriter writer, ProductStatusAndroid value, JsonSerializerOptions options)
    {
        writer.WriteStringValue(_toString[value]);
    }

    internal static string ToRawString(ProductStatusAndroid value) => _toString[value];
    internal static ProductStatusAndroid FromRawString(string value) =>
        _fromString.TryGetValue(value, out var v) ? v : throw new ArgumentException($"Unknown ProductStatusAndroid value: {value}");
}

public static class ProductStatusAndroidExtensions
{
    public static string ToJson(this ProductStatusAndroid value) => ProductStatusAndroidJsonConverter.ToRawString(value);
    public static ProductStatusAndroid FromJson(string value) => ProductStatusAndroidJsonConverter.FromRawString(value);
}

[JsonConverter(typeof(ProductTypeJsonConverter))]
public enum ProductType
{
    InApp,
    Subs
}

public sealed class ProductTypeJsonConverter : JsonConverter<ProductType>
{
    private static readonly Dictionary<string, ProductType> _fromString = new()
    {
        ["in-app"] = ProductType.InApp,
        ["IN_APP"] = ProductType.InApp,
        ["InApp"] = ProductType.InApp,
        ["subs"] = ProductType.Subs,
        ["SUBS"] = ProductType.Subs,
        ["Subs"] = ProductType.Subs,
    };

    private static readonly Dictionary<ProductType, string> _toString = new()
    {
        [ProductType.InApp] = "in-app",
        [ProductType.Subs] = "subs",
    };

    public override ProductType Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        var raw = reader.GetString();
        if (raw is not null && _fromString.TryGetValue(raw, out var value)) return value;
        throw new JsonException($"Unknown ProductType value: {raw}");
    }

    public override void Write(Utf8JsonWriter writer, ProductType value, JsonSerializerOptions options)
    {
        writer.WriteStringValue(_toString[value]);
    }

    internal static string ToRawString(ProductType value) => _toString[value];
    internal static ProductType FromRawString(string value) =>
        _fromString.TryGetValue(value, out var v) ? v : throw new ArgumentException($"Unknown ProductType value: {value}");
}

public static class ProductTypeExtensions
{
    public static string ToJson(this ProductType value) => ProductTypeJsonConverter.ToRawString(value);
    public static ProductType FromJson(string value) => ProductTypeJsonConverter.FromRawString(value);
}

[JsonConverter(typeof(ProductTypeIOSJsonConverter))]
public enum ProductTypeIOS
{
    Consumable,
    NonConsumable,
    AutoRenewableSubscription,
    NonRenewingSubscription
}

public sealed class ProductTypeIOSJsonConverter : JsonConverter<ProductTypeIOS>
{
    private static readonly Dictionary<string, ProductTypeIOS> _fromString = new()
    {
        ["consumable"] = ProductTypeIOS.Consumable,
        ["CONSUMABLE"] = ProductTypeIOS.Consumable,
        ["Consumable"] = ProductTypeIOS.Consumable,
        ["non-consumable"] = ProductTypeIOS.NonConsumable,
        ["NON_CONSUMABLE"] = ProductTypeIOS.NonConsumable,
        ["NonConsumable"] = ProductTypeIOS.NonConsumable,
        ["auto-renewable-subscription"] = ProductTypeIOS.AutoRenewableSubscription,
        ["AUTO_RENEWABLE_SUBSCRIPTION"] = ProductTypeIOS.AutoRenewableSubscription,
        ["AutoRenewableSubscription"] = ProductTypeIOS.AutoRenewableSubscription,
        ["non-renewing-subscription"] = ProductTypeIOS.NonRenewingSubscription,
        ["NON_RENEWING_SUBSCRIPTION"] = ProductTypeIOS.NonRenewingSubscription,
        ["NonRenewingSubscription"] = ProductTypeIOS.NonRenewingSubscription,
    };

    private static readonly Dictionary<ProductTypeIOS, string> _toString = new()
    {
        [ProductTypeIOS.Consumable] = "consumable",
        [ProductTypeIOS.NonConsumable] = "non-consumable",
        [ProductTypeIOS.AutoRenewableSubscription] = "auto-renewable-subscription",
        [ProductTypeIOS.NonRenewingSubscription] = "non-renewing-subscription",
    };

    public override ProductTypeIOS Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        var raw = reader.GetString();
        if (raw is not null && _fromString.TryGetValue(raw, out var value)) return value;
        throw new JsonException($"Unknown ProductTypeIOS value: {raw}");
    }

    public override void Write(Utf8JsonWriter writer, ProductTypeIOS value, JsonSerializerOptions options)
    {
        writer.WriteStringValue(_toString[value]);
    }

    internal static string ToRawString(ProductTypeIOS value) => _toString[value];
    internal static ProductTypeIOS FromRawString(string value) =>
        _fromString.TryGetValue(value, out var v) ? v : throw new ArgumentException($"Unknown ProductTypeIOS value: {value}");
}

public static class ProductTypeIOSExtensions
{
    public static string ToJson(this ProductTypeIOS value) => ProductTypeIOSJsonConverter.ToRawString(value);
    public static ProductTypeIOS FromJson(string value) => ProductTypeIOSJsonConverter.FromRawString(value);
}

[JsonConverter(typeof(PurchaseStateJsonConverter))]
public enum PurchaseState
{
    Pending,
    Purchased,
    Unknown
}

public sealed class PurchaseStateJsonConverter : JsonConverter<PurchaseState>
{
    private static readonly Dictionary<string, PurchaseState> _fromString = new()
    {
        ["pending"] = PurchaseState.Pending,
        ["PENDING"] = PurchaseState.Pending,
        ["Pending"] = PurchaseState.Pending,
        ["purchased"] = PurchaseState.Purchased,
        ["PURCHASED"] = PurchaseState.Purchased,
        ["Purchased"] = PurchaseState.Purchased,
        ["unknown"] = PurchaseState.Unknown,
        ["UNKNOWN"] = PurchaseState.Unknown,
        ["Unknown"] = PurchaseState.Unknown,
    };

    private static readonly Dictionary<PurchaseState, string> _toString = new()
    {
        [PurchaseState.Pending] = "pending",
        [PurchaseState.Purchased] = "purchased",
        [PurchaseState.Unknown] = "unknown",
    };

    public override PurchaseState Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        var raw = reader.GetString();
        if (raw is not null && _fromString.TryGetValue(raw, out var value)) return value;
        throw new JsonException($"Unknown PurchaseState value: {raw}");
    }

    public override void Write(Utf8JsonWriter writer, PurchaseState value, JsonSerializerOptions options)
    {
        writer.WriteStringValue(_toString[value]);
    }

    internal static string ToRawString(PurchaseState value) => _toString[value];
    internal static PurchaseState FromRawString(string value) =>
        _fromString.TryGetValue(value, out var v) ? v : throw new ArgumentException($"Unknown PurchaseState value: {value}");
}

public static class PurchaseStateExtensions
{
    public static string ToJson(this PurchaseState value) => PurchaseStateJsonConverter.ToRawString(value);
    public static PurchaseState FromJson(string value) => PurchaseStateJsonConverter.FromRawString(value);
}

[JsonConverter(typeof(PurchaseVerificationProviderJsonConverter))]
public enum PurchaseVerificationProvider
{
    Iapkit
}

public sealed class PurchaseVerificationProviderJsonConverter : JsonConverter<PurchaseVerificationProvider>
{
    private static readonly Dictionary<string, PurchaseVerificationProvider> _fromString = new()
    {
        ["iapkit"] = PurchaseVerificationProvider.Iapkit,
        ["IAPKIT"] = PurchaseVerificationProvider.Iapkit,
        ["Iapkit"] = PurchaseVerificationProvider.Iapkit,
    };

    private static readonly Dictionary<PurchaseVerificationProvider, string> _toString = new()
    {
        [PurchaseVerificationProvider.Iapkit] = "iapkit",
    };

    public override PurchaseVerificationProvider Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        var raw = reader.GetString();
        if (raw is not null && _fromString.TryGetValue(raw, out var value)) return value;
        throw new JsonException($"Unknown PurchaseVerificationProvider value: {raw}");
    }

    public override void Write(Utf8JsonWriter writer, PurchaseVerificationProvider value, JsonSerializerOptions options)
    {
        writer.WriteStringValue(_toString[value]);
    }

    internal static string ToRawString(PurchaseVerificationProvider value) => _toString[value];
    internal static PurchaseVerificationProvider FromRawString(string value) =>
        _fromString.TryGetValue(value, out var v) ? v : throw new ArgumentException($"Unknown PurchaseVerificationProvider value: {value}");
}

public static class PurchaseVerificationProviderExtensions
{
    public static string ToJson(this PurchaseVerificationProvider value) => PurchaseVerificationProviderJsonConverter.ToRawString(value);
    public static PurchaseVerificationProvider FromJson(string value) => PurchaseVerificationProviderJsonConverter.FromRawString(value);
}

/// <summary>Sub-response codes for more granular purchase error information (Android)</summary>
/// <summary>Available in Google Play Billing Library 8.0.0+</summary>
[JsonConverter(typeof(SubResponseCodeAndroidJsonConverter))]
public enum SubResponseCodeAndroid
{
    /// <summary>No specific sub-response code applies</summary>
    NoApplicableSubResponseCode,
    /// <summary>User&apos;s payment method has insufficient funds</summary>
    PaymentDeclinedDueToInsufficientFunds,
    /// <summary>User doesn&apos;t meet subscription offer eligibility requirements</summary>
    UserIneligible
}

public sealed class SubResponseCodeAndroidJsonConverter : JsonConverter<SubResponseCodeAndroid>
{
    private static readonly Dictionary<string, SubResponseCodeAndroid> _fromString = new()
    {
        ["no-applicable-sub-response-code"] = SubResponseCodeAndroid.NoApplicableSubResponseCode,
        ["NO_APPLICABLE_SUB_RESPONSE_CODE"] = SubResponseCodeAndroid.NoApplicableSubResponseCode,
        ["payment-declined-due-to-insufficient-funds"] = SubResponseCodeAndroid.PaymentDeclinedDueToInsufficientFunds,
        ["PAYMENT_DECLINED_DUE_TO_INSUFFICIENT_FUNDS"] = SubResponseCodeAndroid.PaymentDeclinedDueToInsufficientFunds,
        ["user-ineligible"] = SubResponseCodeAndroid.UserIneligible,
        ["USER_INELIGIBLE"] = SubResponseCodeAndroid.UserIneligible,
    };

    private static readonly Dictionary<SubResponseCodeAndroid, string> _toString = new()
    {
        [SubResponseCodeAndroid.NoApplicableSubResponseCode] = "no-applicable-sub-response-code",
        [SubResponseCodeAndroid.PaymentDeclinedDueToInsufficientFunds] = "payment-declined-due-to-insufficient-funds",
        [SubResponseCodeAndroid.UserIneligible] = "user-ineligible",
    };

    public override SubResponseCodeAndroid Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        var raw = reader.GetString();
        if (raw is not null && _fromString.TryGetValue(raw, out var value)) return value;
        throw new JsonException($"Unknown SubResponseCodeAndroid value: {raw}");
    }

    public override void Write(Utf8JsonWriter writer, SubResponseCodeAndroid value, JsonSerializerOptions options)
    {
        writer.WriteStringValue(_toString[value]);
    }

    internal static string ToRawString(SubResponseCodeAndroid value) => _toString[value];
    internal static SubResponseCodeAndroid FromRawString(string value) =>
        _fromString.TryGetValue(value, out var v) ? v : throw new ArgumentException($"Unknown SubResponseCodeAndroid value: {value}");
}

public static class SubResponseCodeAndroidExtensions
{
    public static string ToJson(this SubResponseCodeAndroid value) => SubResponseCodeAndroidJsonConverter.ToRawString(value);
    public static SubResponseCodeAndroid FromJson(string value) => SubResponseCodeAndroidJsonConverter.FromRawString(value);
}

[JsonConverter(typeof(SubscriptionBillingPlanTypeIOSJsonConverter))]
public enum SubscriptionBillingPlanTypeIOS
{
    /// <summary>Unknown or unsupported billing plan type.</summary>
    Unknown,
    /// <summary>Monthly billing with a 12-month commitment.</summary>
    Monthly,
    /// <summary>Up-front billing for the full subscription period.</summary>
    UpFront
}

public sealed class SubscriptionBillingPlanTypeIOSJsonConverter : JsonConverter<SubscriptionBillingPlanTypeIOS>
{
    private static readonly Dictionary<string, SubscriptionBillingPlanTypeIOS> _fromString = new()
    {
        ["unknown"] = SubscriptionBillingPlanTypeIOS.Unknown,
        ["UNKNOWN"] = SubscriptionBillingPlanTypeIOS.Unknown,
        ["Unknown"] = SubscriptionBillingPlanTypeIOS.Unknown,
        ["monthly"] = SubscriptionBillingPlanTypeIOS.Monthly,
        ["MONTHLY"] = SubscriptionBillingPlanTypeIOS.Monthly,
        ["Monthly"] = SubscriptionBillingPlanTypeIOS.Monthly,
        ["up-front"] = SubscriptionBillingPlanTypeIOS.UpFront,
        ["UP_FRONT"] = SubscriptionBillingPlanTypeIOS.UpFront,
        ["UpFront"] = SubscriptionBillingPlanTypeIOS.UpFront,
    };

    private static readonly Dictionary<SubscriptionBillingPlanTypeIOS, string> _toString = new()
    {
        [SubscriptionBillingPlanTypeIOS.Unknown] = "unknown",
        [SubscriptionBillingPlanTypeIOS.Monthly] = "monthly",
        [SubscriptionBillingPlanTypeIOS.UpFront] = "up-front",
    };

    public override SubscriptionBillingPlanTypeIOS Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        var raw = reader.GetString();
        if (raw is not null && _fromString.TryGetValue(raw, out var value)) return value;
        throw new JsonException($"Unknown SubscriptionBillingPlanTypeIOS value: {raw}");
    }

    public override void Write(Utf8JsonWriter writer, SubscriptionBillingPlanTypeIOS value, JsonSerializerOptions options)
    {
        writer.WriteStringValue(_toString[value]);
    }

    internal static string ToRawString(SubscriptionBillingPlanTypeIOS value) => _toString[value];
    internal static SubscriptionBillingPlanTypeIOS FromRawString(string value) =>
        _fromString.TryGetValue(value, out var v) ? v : throw new ArgumentException($"Unknown SubscriptionBillingPlanTypeIOS value: {value}");
}

public static class SubscriptionBillingPlanTypeIOSExtensions
{
    public static string ToJson(this SubscriptionBillingPlanTypeIOS value) => SubscriptionBillingPlanTypeIOSJsonConverter.ToRawString(value);
    public static SubscriptionBillingPlanTypeIOS FromJson(string value) => SubscriptionBillingPlanTypeIOSJsonConverter.FromRawString(value);
}

[JsonConverter(typeof(SubscriptionOfferTypeIOSJsonConverter))]
public enum SubscriptionOfferTypeIOS
{
    Introductory,
    Promotional,
    /// <summary>Win-back offer type (iOS 18+)</summary>
    /// <summary>Used to re-engage churned subscribers with a discount or free trial.</summary>
    WinBack
}

public sealed class SubscriptionOfferTypeIOSJsonConverter : JsonConverter<SubscriptionOfferTypeIOS>
{
    private static readonly Dictionary<string, SubscriptionOfferTypeIOS> _fromString = new()
    {
        ["introductory"] = SubscriptionOfferTypeIOS.Introductory,
        ["INTRODUCTORY"] = SubscriptionOfferTypeIOS.Introductory,
        ["Introductory"] = SubscriptionOfferTypeIOS.Introductory,
        ["promotional"] = SubscriptionOfferTypeIOS.Promotional,
        ["PROMOTIONAL"] = SubscriptionOfferTypeIOS.Promotional,
        ["Promotional"] = SubscriptionOfferTypeIOS.Promotional,
        ["win-back"] = SubscriptionOfferTypeIOS.WinBack,
        ["WIN_BACK"] = SubscriptionOfferTypeIOS.WinBack,
        ["WinBack"] = SubscriptionOfferTypeIOS.WinBack,
    };

    private static readonly Dictionary<SubscriptionOfferTypeIOS, string> _toString = new()
    {
        [SubscriptionOfferTypeIOS.Introductory] = "introductory",
        [SubscriptionOfferTypeIOS.Promotional] = "promotional",
        [SubscriptionOfferTypeIOS.WinBack] = "win-back",
    };

    public override SubscriptionOfferTypeIOS Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        var raw = reader.GetString();
        if (raw is not null && _fromString.TryGetValue(raw, out var value)) return value;
        throw new JsonException($"Unknown SubscriptionOfferTypeIOS value: {raw}");
    }

    public override void Write(Utf8JsonWriter writer, SubscriptionOfferTypeIOS value, JsonSerializerOptions options)
    {
        writer.WriteStringValue(_toString[value]);
    }

    internal static string ToRawString(SubscriptionOfferTypeIOS value) => _toString[value];
    internal static SubscriptionOfferTypeIOS FromRawString(string value) =>
        _fromString.TryGetValue(value, out var v) ? v : throw new ArgumentException($"Unknown SubscriptionOfferTypeIOS value: {value}");
}

public static class SubscriptionOfferTypeIOSExtensions
{
    public static string ToJson(this SubscriptionOfferTypeIOS value) => SubscriptionOfferTypeIOSJsonConverter.ToRawString(value);
    public static SubscriptionOfferTypeIOS FromJson(string value) => SubscriptionOfferTypeIOSJsonConverter.FromRawString(value);
}

[JsonConverter(typeof(SubscriptionPeriodIOSJsonConverter))]
public enum SubscriptionPeriodIOS
{
    Day,
    Week,
    Month,
    Year,
    Empty
}

public sealed class SubscriptionPeriodIOSJsonConverter : JsonConverter<SubscriptionPeriodIOS>
{
    private static readonly Dictionary<string, SubscriptionPeriodIOS> _fromString = new()
    {
        ["day"] = SubscriptionPeriodIOS.Day,
        ["DAY"] = SubscriptionPeriodIOS.Day,
        ["Day"] = SubscriptionPeriodIOS.Day,
        ["week"] = SubscriptionPeriodIOS.Week,
        ["WEEK"] = SubscriptionPeriodIOS.Week,
        ["Week"] = SubscriptionPeriodIOS.Week,
        ["month"] = SubscriptionPeriodIOS.Month,
        ["MONTH"] = SubscriptionPeriodIOS.Month,
        ["Month"] = SubscriptionPeriodIOS.Month,
        ["year"] = SubscriptionPeriodIOS.Year,
        ["YEAR"] = SubscriptionPeriodIOS.Year,
        ["Year"] = SubscriptionPeriodIOS.Year,
        ["empty"] = SubscriptionPeriodIOS.Empty,
        ["EMPTY"] = SubscriptionPeriodIOS.Empty,
        ["Empty"] = SubscriptionPeriodIOS.Empty,
    };

    private static readonly Dictionary<SubscriptionPeriodIOS, string> _toString = new()
    {
        [SubscriptionPeriodIOS.Day] = "day",
        [SubscriptionPeriodIOS.Week] = "week",
        [SubscriptionPeriodIOS.Month] = "month",
        [SubscriptionPeriodIOS.Year] = "year",
        [SubscriptionPeriodIOS.Empty] = "empty",
    };

    public override SubscriptionPeriodIOS Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        var raw = reader.GetString();
        if (raw is not null && _fromString.TryGetValue(raw, out var value)) return value;
        throw new JsonException($"Unknown SubscriptionPeriodIOS value: {raw}");
    }

    public override void Write(Utf8JsonWriter writer, SubscriptionPeriodIOS value, JsonSerializerOptions options)
    {
        writer.WriteStringValue(_toString[value]);
    }

    internal static string ToRawString(SubscriptionPeriodIOS value) => _toString[value];
    internal static SubscriptionPeriodIOS FromRawString(string value) =>
        _fromString.TryGetValue(value, out var v) ? v : throw new ArgumentException($"Unknown SubscriptionPeriodIOS value: {value}");
}

public static class SubscriptionPeriodIOSExtensions
{
    public static string ToJson(this SubscriptionPeriodIOS value) => SubscriptionPeriodIOSJsonConverter.ToRawString(value);
    public static SubscriptionPeriodIOS FromJson(string value) => SubscriptionPeriodIOSJsonConverter.FromRawString(value);
}

/// <summary>Subscription period unit for cross-platform use.</summary>
[JsonConverter(typeof(SubscriptionPeriodUnitJsonConverter))]
public enum SubscriptionPeriodUnit
{
    Day,
    Week,
    Month,
    Year,
    Unknown
}

public sealed class SubscriptionPeriodUnitJsonConverter : JsonConverter<SubscriptionPeriodUnit>
{
    private static readonly Dictionary<string, SubscriptionPeriodUnit> _fromString = new()
    {
        ["day"] = SubscriptionPeriodUnit.Day,
        ["DAY"] = SubscriptionPeriodUnit.Day,
        ["Day"] = SubscriptionPeriodUnit.Day,
        ["week"] = SubscriptionPeriodUnit.Week,
        ["WEEK"] = SubscriptionPeriodUnit.Week,
        ["Week"] = SubscriptionPeriodUnit.Week,
        ["month"] = SubscriptionPeriodUnit.Month,
        ["MONTH"] = SubscriptionPeriodUnit.Month,
        ["Month"] = SubscriptionPeriodUnit.Month,
        ["year"] = SubscriptionPeriodUnit.Year,
        ["YEAR"] = SubscriptionPeriodUnit.Year,
        ["Year"] = SubscriptionPeriodUnit.Year,
        ["unknown"] = SubscriptionPeriodUnit.Unknown,
        ["UNKNOWN"] = SubscriptionPeriodUnit.Unknown,
        ["Unknown"] = SubscriptionPeriodUnit.Unknown,
    };

    private static readonly Dictionary<SubscriptionPeriodUnit, string> _toString = new()
    {
        [SubscriptionPeriodUnit.Day] = "day",
        [SubscriptionPeriodUnit.Week] = "week",
        [SubscriptionPeriodUnit.Month] = "month",
        [SubscriptionPeriodUnit.Year] = "year",
        [SubscriptionPeriodUnit.Unknown] = "unknown",
    };

    public override SubscriptionPeriodUnit Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        var raw = reader.GetString();
        if (raw is not null && _fromString.TryGetValue(raw, out var value)) return value;
        throw new JsonException($"Unknown SubscriptionPeriodUnit value: {raw}");
    }

    public override void Write(Utf8JsonWriter writer, SubscriptionPeriodUnit value, JsonSerializerOptions options)
    {
        writer.WriteStringValue(_toString[value]);
    }

    internal static string ToRawString(SubscriptionPeriodUnit value) => _toString[value];
    internal static SubscriptionPeriodUnit FromRawString(string value) =>
        _fromString.TryGetValue(value, out var v) ? v : throw new ArgumentException($"Unknown SubscriptionPeriodUnit value: {value}");
}

public static class SubscriptionPeriodUnitExtensions
{
    public static string ToJson(this SubscriptionPeriodUnit value) => SubscriptionPeriodUnitJsonConverter.ToRawString(value);
    public static SubscriptionPeriodUnit FromJson(string value) => SubscriptionPeriodUnitJsonConverter.FromRawString(value);
}

/// <summary>Replacement mode for subscription changes (Android)</summary>
/// <summary>These modes determine how the subscription replacement affects billing.</summary>
/// <summary>Available in Google Play Billing Library 8.1.0+</summary>
[JsonConverter(typeof(SubscriptionReplacementModeAndroidJsonConverter))]
public enum SubscriptionReplacementModeAndroid
{
    /// <summary>Unknown replacement mode. Do not use.</summary>
    UnknownReplacementMode,
    /// <summary>Replacement takes effect immediately, and the new expiration time will be prorated.</summary>
    WithTimeProration,
    /// <summary>Replacement takes effect immediately, and the billing cycle remains the same.</summary>
    ChargeProratedPrice,
    /// <summary>Replacement takes effect immediately, and the user is charged full price immediately.</summary>
    ChargeFullPrice,
    /// <summary>Replacement takes effect when the old plan expires.</summary>
    WithoutProration,
    /// <summary>Replacement takes effect when the old plan expires, and the user is not charged.</summary>
    Deferred,
    /// <summary>Keep the existing payment schedule unchanged for the item (8.1.0+)</summary>
    KeepExisting
}

public sealed class SubscriptionReplacementModeAndroidJsonConverter : JsonConverter<SubscriptionReplacementModeAndroid>
{
    private static readonly Dictionary<string, SubscriptionReplacementModeAndroid> _fromString = new()
    {
        ["unknown-replacement-mode"] = SubscriptionReplacementModeAndroid.UnknownReplacementMode,
        ["UNKNOWN_REPLACEMENT_MODE"] = SubscriptionReplacementModeAndroid.UnknownReplacementMode,
        ["with-time-proration"] = SubscriptionReplacementModeAndroid.WithTimeProration,
        ["WITH_TIME_PRORATION"] = SubscriptionReplacementModeAndroid.WithTimeProration,
        ["charge-prorated-price"] = SubscriptionReplacementModeAndroid.ChargeProratedPrice,
        ["CHARGE_PRORATED_PRICE"] = SubscriptionReplacementModeAndroid.ChargeProratedPrice,
        ["charge-full-price"] = SubscriptionReplacementModeAndroid.ChargeFullPrice,
        ["CHARGE_FULL_PRICE"] = SubscriptionReplacementModeAndroid.ChargeFullPrice,
        ["without-proration"] = SubscriptionReplacementModeAndroid.WithoutProration,
        ["WITHOUT_PRORATION"] = SubscriptionReplacementModeAndroid.WithoutProration,
        ["deferred"] = SubscriptionReplacementModeAndroid.Deferred,
        ["DEFERRED"] = SubscriptionReplacementModeAndroid.Deferred,
        ["keep-existing"] = SubscriptionReplacementModeAndroid.KeepExisting,
        ["KEEP_EXISTING"] = SubscriptionReplacementModeAndroid.KeepExisting,
    };

    private static readonly Dictionary<SubscriptionReplacementModeAndroid, string> _toString = new()
    {
        [SubscriptionReplacementModeAndroid.UnknownReplacementMode] = "unknown-replacement-mode",
        [SubscriptionReplacementModeAndroid.WithTimeProration] = "with-time-proration",
        [SubscriptionReplacementModeAndroid.ChargeProratedPrice] = "charge-prorated-price",
        [SubscriptionReplacementModeAndroid.ChargeFullPrice] = "charge-full-price",
        [SubscriptionReplacementModeAndroid.WithoutProration] = "without-proration",
        [SubscriptionReplacementModeAndroid.Deferred] = "deferred",
        [SubscriptionReplacementModeAndroid.KeepExisting] = "keep-existing",
    };

    public override SubscriptionReplacementModeAndroid Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        var raw = reader.GetString();
        if (raw is not null && _fromString.TryGetValue(raw, out var value)) return value;
        throw new JsonException($"Unknown SubscriptionReplacementModeAndroid value: {raw}");
    }

    public override void Write(Utf8JsonWriter writer, SubscriptionReplacementModeAndroid value, JsonSerializerOptions options)
    {
        writer.WriteStringValue(_toString[value]);
    }

    internal static string ToRawString(SubscriptionReplacementModeAndroid value) => _toString[value];
    internal static SubscriptionReplacementModeAndroid FromRawString(string value) =>
        _fromString.TryGetValue(value, out var v) ? v : throw new ArgumentException($"Unknown SubscriptionReplacementModeAndroid value: {value}");
}

public static class SubscriptionReplacementModeAndroidExtensions
{
    public static string ToJson(this SubscriptionReplacementModeAndroid value) => SubscriptionReplacementModeAndroidJsonConverter.ToRawString(value);
    public static SubscriptionReplacementModeAndroid FromJson(string value) => SubscriptionReplacementModeAndroidJsonConverter.FromRawString(value);
}

[JsonConverter(typeof(SubscriptionStateJsonConverter))]
public enum SubscriptionState
{
    Active,
    InGracePeriod,
    InBillingRetry,
    Expired,
    Revoked,
    Refunded,
    Paused,
    Unknown
}

public sealed class SubscriptionStateJsonConverter : JsonConverter<SubscriptionState>
{
    private static readonly Dictionary<string, SubscriptionState> _fromString = new()
    {
        ["active"] = SubscriptionState.Active,
        ["ACTIVE"] = SubscriptionState.Active,
        ["Active"] = SubscriptionState.Active,
        ["in-grace-period"] = SubscriptionState.InGracePeriod,
        ["IN_GRACE_PERIOD"] = SubscriptionState.InGracePeriod,
        ["InGracePeriod"] = SubscriptionState.InGracePeriod,
        ["in-billing-retry"] = SubscriptionState.InBillingRetry,
        ["IN_BILLING_RETRY"] = SubscriptionState.InBillingRetry,
        ["InBillingRetry"] = SubscriptionState.InBillingRetry,
        ["expired"] = SubscriptionState.Expired,
        ["EXPIRED"] = SubscriptionState.Expired,
        ["Expired"] = SubscriptionState.Expired,
        ["revoked"] = SubscriptionState.Revoked,
        ["REVOKED"] = SubscriptionState.Revoked,
        ["Revoked"] = SubscriptionState.Revoked,
        ["refunded"] = SubscriptionState.Refunded,
        ["REFUNDED"] = SubscriptionState.Refunded,
        ["Refunded"] = SubscriptionState.Refunded,
        ["paused"] = SubscriptionState.Paused,
        ["PAUSED"] = SubscriptionState.Paused,
        ["Paused"] = SubscriptionState.Paused,
        ["unknown"] = SubscriptionState.Unknown,
        ["UNKNOWN"] = SubscriptionState.Unknown,
        ["Unknown"] = SubscriptionState.Unknown,
    };

    private static readonly Dictionary<SubscriptionState, string> _toString = new()
    {
        [SubscriptionState.Active] = "active",
        [SubscriptionState.InGracePeriod] = "in-grace-period",
        [SubscriptionState.InBillingRetry] = "in-billing-retry",
        [SubscriptionState.Expired] = "expired",
        [SubscriptionState.Revoked] = "revoked",
        [SubscriptionState.Refunded] = "refunded",
        [SubscriptionState.Paused] = "paused",
        [SubscriptionState.Unknown] = "unknown",
    };

    public override SubscriptionState Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        var raw = reader.GetString();
        if (raw is not null && _fromString.TryGetValue(raw, out var value)) return value;
        throw new JsonException($"Unknown SubscriptionState value: {raw}");
    }

    public override void Write(Utf8JsonWriter writer, SubscriptionState value, JsonSerializerOptions options)
    {
        writer.WriteStringValue(_toString[value]);
    }

    internal static string ToRawString(SubscriptionState value) => _toString[value];
    internal static SubscriptionState FromRawString(string value) =>
        _fromString.TryGetValue(value, out var v) ? v : throw new ArgumentException($"Unknown SubscriptionState value: {value}");
}

public static class SubscriptionStateExtensions
{
    public static string ToJson(this SubscriptionState value) => SubscriptionStateJsonConverter.ToRawString(value);
    public static SubscriptionState FromJson(string value) => SubscriptionStateJsonConverter.FromRawString(value);
}

[JsonConverter(typeof(WebhookCancellationReasonJsonConverter))]
public enum WebhookCancellationReason
{
    UserCanceled,
    BillingError,
    PriceIncreaseDeclined,
    ProductUnavailable,
    Refunded,
    Other
}

public sealed class WebhookCancellationReasonJsonConverter : JsonConverter<WebhookCancellationReason>
{
    private static readonly Dictionary<string, WebhookCancellationReason> _fromString = new()
    {
        ["user-canceled"] = WebhookCancellationReason.UserCanceled,
        ["USER_CANCELED"] = WebhookCancellationReason.UserCanceled,
        ["UserCanceled"] = WebhookCancellationReason.UserCanceled,
        ["billing-error"] = WebhookCancellationReason.BillingError,
        ["BILLING_ERROR"] = WebhookCancellationReason.BillingError,
        ["BillingError"] = WebhookCancellationReason.BillingError,
        ["price-increase-declined"] = WebhookCancellationReason.PriceIncreaseDeclined,
        ["PRICE_INCREASE_DECLINED"] = WebhookCancellationReason.PriceIncreaseDeclined,
        ["PriceIncreaseDeclined"] = WebhookCancellationReason.PriceIncreaseDeclined,
        ["product-unavailable"] = WebhookCancellationReason.ProductUnavailable,
        ["PRODUCT_UNAVAILABLE"] = WebhookCancellationReason.ProductUnavailable,
        ["ProductUnavailable"] = WebhookCancellationReason.ProductUnavailable,
        ["refunded"] = WebhookCancellationReason.Refunded,
        ["REFUNDED"] = WebhookCancellationReason.Refunded,
        ["Refunded"] = WebhookCancellationReason.Refunded,
        ["other"] = WebhookCancellationReason.Other,
        ["OTHER"] = WebhookCancellationReason.Other,
        ["Other"] = WebhookCancellationReason.Other,
    };

    private static readonly Dictionary<WebhookCancellationReason, string> _toString = new()
    {
        [WebhookCancellationReason.UserCanceled] = "user-canceled",
        [WebhookCancellationReason.BillingError] = "billing-error",
        [WebhookCancellationReason.PriceIncreaseDeclined] = "price-increase-declined",
        [WebhookCancellationReason.ProductUnavailable] = "product-unavailable",
        [WebhookCancellationReason.Refunded] = "refunded",
        [WebhookCancellationReason.Other] = "other",
    };

    public override WebhookCancellationReason Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        var raw = reader.GetString();
        if (raw is not null && _fromString.TryGetValue(raw, out var value)) return value;
        throw new JsonException($"Unknown WebhookCancellationReason value: {raw}");
    }

    public override void Write(Utf8JsonWriter writer, WebhookCancellationReason value, JsonSerializerOptions options)
    {
        writer.WriteStringValue(_toString[value]);
    }

    internal static string ToRawString(WebhookCancellationReason value) => _toString[value];
    internal static WebhookCancellationReason FromRawString(string value) =>
        _fromString.TryGetValue(value, out var v) ? v : throw new ArgumentException($"Unknown WebhookCancellationReason value: {value}");
}

public static class WebhookCancellationReasonExtensions
{
    public static string ToJson(this WebhookCancellationReason value) => WebhookCancellationReasonJsonConverter.ToRawString(value);
    public static WebhookCancellationReason FromJson(string value) => WebhookCancellationReasonJsonConverter.FromRawString(value);
}

[JsonConverter(typeof(WebhookEventEnvironmentJsonConverter))]
public enum WebhookEventEnvironment
{
    Production,
    Sandbox,
    Xcode
}

public sealed class WebhookEventEnvironmentJsonConverter : JsonConverter<WebhookEventEnvironment>
{
    private static readonly Dictionary<string, WebhookEventEnvironment> _fromString = new()
    {
        ["production"] = WebhookEventEnvironment.Production,
        ["PRODUCTION"] = WebhookEventEnvironment.Production,
        ["Production"] = WebhookEventEnvironment.Production,
        ["sandbox"] = WebhookEventEnvironment.Sandbox,
        ["SANDBOX"] = WebhookEventEnvironment.Sandbox,
        ["Sandbox"] = WebhookEventEnvironment.Sandbox,
        ["xcode"] = WebhookEventEnvironment.Xcode,
        ["XCODE"] = WebhookEventEnvironment.Xcode,
        ["Xcode"] = WebhookEventEnvironment.Xcode,
    };

    private static readonly Dictionary<WebhookEventEnvironment, string> _toString = new()
    {
        [WebhookEventEnvironment.Production] = "production",
        [WebhookEventEnvironment.Sandbox] = "sandbox",
        [WebhookEventEnvironment.Xcode] = "xcode",
    };

    public override WebhookEventEnvironment Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        var raw = reader.GetString();
        if (raw is not null && _fromString.TryGetValue(raw, out var value)) return value;
        throw new JsonException($"Unknown WebhookEventEnvironment value: {raw}");
    }

    public override void Write(Utf8JsonWriter writer, WebhookEventEnvironment value, JsonSerializerOptions options)
    {
        writer.WriteStringValue(_toString[value]);
    }

    internal static string ToRawString(WebhookEventEnvironment value) => _toString[value];
    internal static WebhookEventEnvironment FromRawString(string value) =>
        _fromString.TryGetValue(value, out var v) ? v : throw new ArgumentException($"Unknown WebhookEventEnvironment value: {value}");
}

public static class WebhookEventEnvironmentExtensions
{
    public static string ToJson(this WebhookEventEnvironment value) => WebhookEventEnvironmentJsonConverter.ToRawString(value);
    public static WebhookEventEnvironment FromJson(string value) => WebhookEventEnvironmentJsonConverter.FromRawString(value);
}

[JsonConverter(typeof(WebhookEventSourceJsonConverter))]
public enum WebhookEventSource
{
    AppleAppStoreServerNotificationsV2,
    GooglePlayRealTimeDeveloperNotifications,
    /// <summary>Synthetic source for Meta Horizon Store. Meta has no webhook /</summary>
    /// <summary>push notification system so kit polls `verify_entitlement` on a</summary>
    /// <summary>cron and emits these synthetic events when an entitlement</summary>
    /// <summary>transitions. SDK consumers see them on the SSE stream alongside</summary>
    /// <summary>real Apple / Google webhooks.</summary>
    MetaHorizonReconciler
}

public sealed class WebhookEventSourceJsonConverter : JsonConverter<WebhookEventSource>
{
    private static readonly Dictionary<string, WebhookEventSource> _fromString = new()
    {
        ["apple-app-store-server-notifications-v2"] = WebhookEventSource.AppleAppStoreServerNotificationsV2,
        ["APPLE_APP_STORE_SERVER_NOTIFICATIONS_V2"] = WebhookEventSource.AppleAppStoreServerNotificationsV2,
        ["AppleAppStoreServerNotificationsV2"] = WebhookEventSource.AppleAppStoreServerNotificationsV2,
        ["google-play-real-time-developer-notifications"] = WebhookEventSource.GooglePlayRealTimeDeveloperNotifications,
        ["GOOGLE_PLAY_REAL_TIME_DEVELOPER_NOTIFICATIONS"] = WebhookEventSource.GooglePlayRealTimeDeveloperNotifications,
        ["GooglePlayRealTimeDeveloperNotifications"] = WebhookEventSource.GooglePlayRealTimeDeveloperNotifications,
        ["meta-horizon-reconciler"] = WebhookEventSource.MetaHorizonReconciler,
        ["META_HORIZON_RECONCILER"] = WebhookEventSource.MetaHorizonReconciler,
        ["MetaHorizonReconciler"] = WebhookEventSource.MetaHorizonReconciler,
    };

    private static readonly Dictionary<WebhookEventSource, string> _toString = new()
    {
        [WebhookEventSource.AppleAppStoreServerNotificationsV2] = "apple-app-store-server-notifications-v2",
        [WebhookEventSource.GooglePlayRealTimeDeveloperNotifications] = "google-play-real-time-developer-notifications",
        [WebhookEventSource.MetaHorizonReconciler] = "meta-horizon-reconciler",
    };

    public override WebhookEventSource Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        var raw = reader.GetString();
        if (raw is not null && _fromString.TryGetValue(raw, out var value)) return value;
        throw new JsonException($"Unknown WebhookEventSource value: {raw}");
    }

    public override void Write(Utf8JsonWriter writer, WebhookEventSource value, JsonSerializerOptions options)
    {
        writer.WriteStringValue(_toString[value]);
    }

    internal static string ToRawString(WebhookEventSource value) => _toString[value];
    internal static WebhookEventSource FromRawString(string value) =>
        _fromString.TryGetValue(value, out var v) ? v : throw new ArgumentException($"Unknown WebhookEventSource value: {value}");
}

public static class WebhookEventSourceExtensions
{
    public static string ToJson(this WebhookEventSource value) => WebhookEventSourceJsonConverter.ToRawString(value);
    public static WebhookEventSource FromJson(string value) => WebhookEventSourceJsonConverter.FromRawString(value);
}

[JsonConverter(typeof(WebhookEventTypeJsonConverter))]
public enum WebhookEventType
{
    /// <summary>Initial purchase or first conversion from a free trial / intro offer.</summary>
    /// <summary>iOS: SUBSCRIBED (initialBuy / resubscribe).</summary>
    /// <summary>Android: SUBSCRIPTION_PURCHASED.</summary>
    SubscriptionStarted,
    /// <summary>Auto-renewal succeeded for an existing subscription.</summary>
    /// <summary>iOS: DID_RENEW.</summary>
    /// <summary>Android: SUBSCRIPTION_RENEWED.</summary>
    SubscriptionRenewed,
    /// <summary>Subscription reached its expiration without a successful renewal.</summary>
    /// <summary>iOS: EXPIRED.</summary>
    /// <summary>Android: SUBSCRIPTION_EXPIRED.</summary>
    SubscriptionExpired,
    /// <summary>Billing failed; the subscription is in a grace period during which the user</summary>
    /// <summary>retains entitlement while payment is retried.</summary>
    /// <summary>iOS: DID_FAIL_TO_RENEW (with grace period active).</summary>
    /// <summary>Android: SUBSCRIPTION_IN_GRACE_PERIOD.</summary>
    SubscriptionInGracePeriod,
    /// <summary>Billing failed and the subscription is in account-hold / billing retry,</summary>
    /// <summary>during which entitlement is paused but the subscription is not yet expired.</summary>
    /// <summary>iOS: DID_FAIL_TO_RENEW (no grace period; billing retry).</summary>
    /// <summary>Android: SUBSCRIPTION_ON_HOLD.</summary>
    SubscriptionInBillingRetry,
    /// <summary>Subscription returned to active state after a billing issue or pause.</summary>
    /// <summary>iOS: DID_RECOVER.</summary>
    /// <summary>Android: SUBSCRIPTION_RECOVERED (1) only — RESTARTED (7) is auto-</summary>
    /// <summary>renew re-enabled (Uncanceled), not billing recovery.</summary>
    SubscriptionRecovered,
    /// <summary>User turned off auto-renew. Access continues until the current period ends.</summary>
    /// <summary>iOS: DID_CHANGE_RENEWAL_STATUS (autoRenew turned off).</summary>
    /// <summary>Android: SUBSCRIPTION_CANCELED.</summary>
    SubscriptionCanceled,
    /// <summary>User reactivated auto-renew before the subscription expired.</summary>
    /// <summary>iOS: DID_CHANGE_RENEWAL_STATUS (autoRenew turned on).</summary>
    /// <summary>Android: SUBSCRIPTION_RESTARTED (when re-enabled, not after billing recovery).</summary>
    SubscriptionUncanceled,
    /// <summary>Access immediately revoked (family sharing removal, admin action, fraud).</summary>
    /// <summary>iOS: REVOKE.</summary>
    /// <summary>Android: SUBSCRIPTION_REVOKED.</summary>
    SubscriptionRevoked,
    /// <summary>A price change is pending or has been confirmed by the user.</summary>
    /// <summary>iOS: PRICE_INCREASE.</summary>
    /// <summary>Android: SUBSCRIPTION_PRICE_CHANGE_CONFIRMED.</summary>
    SubscriptionPriceChange,
    /// <summary>User upgraded, downgraded, or crossgraded their plan.</summary>
    /// <summary>iOS: DID_CHANGE_RENEWAL_PREF.</summary>
    /// <summary>Android: SUBSCRIPTION_DEFERRED / SUBSCRIPTION_PRODUCT_CHANGED.</summary>
    SubscriptionProductChanged,
    /// <summary>Subscription paused (Android only feature). Also fired when the</summary>
    /// <summary>pause schedule is changed — RTDN does not have a separate signal.</summary>
    /// <summary>Android: SUBSCRIPTION_PAUSED (10), SUBSCRIPTION_PAUSE_SCHEDULE_CHANGED (11).</summary>
    SubscriptionPaused,
    /// <summary>Paused subscription resumed (Android only feature). RTDN signals</summary>
    /// <summary>resume via SUBSCRIPTION_RECOVERED (1) once the next billing cycle</summary>
    /// <summary>starts; PAUSE_SCHEDULE_CHANGED is the schedule update, not the</summary>
    /// <summary>resume.</summary>
    /// <summary>Android: SUBSCRIPTION_RECOVERED (after pause).</summary>
    SubscriptionResumed,
    /// <summary>Refund issued for a one-time purchase or subscription period.</summary>
    /// <summary>iOS: REFUND.</summary>
    /// <summary>Android: ONE_TIME_PRODUCT_REFUNDED / VOIDED_PURCHASE.</summary>
    PurchaseRefunded,
    /// <summary>iOS-only: App Store requests a consumption status report for a refund decision.</summary>
    /// <summary>Servers should respond via the StoreKit consumption API.</summary>
    PurchaseConsumptionRequest,
    /// <summary>Sandbox or test notification fired by the store for diagnostic purposes.</summary>
    /// <summary>Useful for verifying webhook plumbing without a live transaction.</summary>
    TestNotification
}

public sealed class WebhookEventTypeJsonConverter : JsonConverter<WebhookEventType>
{
    private static readonly Dictionary<string, WebhookEventType> _fromString = new()
    {
        ["subscription-started"] = WebhookEventType.SubscriptionStarted,
        ["SUBSCRIPTION_STARTED"] = WebhookEventType.SubscriptionStarted,
        ["SubscriptionStarted"] = WebhookEventType.SubscriptionStarted,
        ["subscription-renewed"] = WebhookEventType.SubscriptionRenewed,
        ["SUBSCRIPTION_RENEWED"] = WebhookEventType.SubscriptionRenewed,
        ["SubscriptionRenewed"] = WebhookEventType.SubscriptionRenewed,
        ["subscription-expired"] = WebhookEventType.SubscriptionExpired,
        ["SUBSCRIPTION_EXPIRED"] = WebhookEventType.SubscriptionExpired,
        ["SubscriptionExpired"] = WebhookEventType.SubscriptionExpired,
        ["subscription-in-grace-period"] = WebhookEventType.SubscriptionInGracePeriod,
        ["SUBSCRIPTION_IN_GRACE_PERIOD"] = WebhookEventType.SubscriptionInGracePeriod,
        ["SubscriptionInGracePeriod"] = WebhookEventType.SubscriptionInGracePeriod,
        ["subscription-in-billing-retry"] = WebhookEventType.SubscriptionInBillingRetry,
        ["SUBSCRIPTION_IN_BILLING_RETRY"] = WebhookEventType.SubscriptionInBillingRetry,
        ["SubscriptionInBillingRetry"] = WebhookEventType.SubscriptionInBillingRetry,
        ["subscription-recovered"] = WebhookEventType.SubscriptionRecovered,
        ["SUBSCRIPTION_RECOVERED"] = WebhookEventType.SubscriptionRecovered,
        ["SubscriptionRecovered"] = WebhookEventType.SubscriptionRecovered,
        ["subscription-canceled"] = WebhookEventType.SubscriptionCanceled,
        ["SUBSCRIPTION_CANCELED"] = WebhookEventType.SubscriptionCanceled,
        ["SubscriptionCanceled"] = WebhookEventType.SubscriptionCanceled,
        ["subscription-uncanceled"] = WebhookEventType.SubscriptionUncanceled,
        ["SUBSCRIPTION_UNCANCELED"] = WebhookEventType.SubscriptionUncanceled,
        ["SubscriptionUncanceled"] = WebhookEventType.SubscriptionUncanceled,
        ["subscription-revoked"] = WebhookEventType.SubscriptionRevoked,
        ["SUBSCRIPTION_REVOKED"] = WebhookEventType.SubscriptionRevoked,
        ["SubscriptionRevoked"] = WebhookEventType.SubscriptionRevoked,
        ["subscription-price-change"] = WebhookEventType.SubscriptionPriceChange,
        ["SUBSCRIPTION_PRICE_CHANGE"] = WebhookEventType.SubscriptionPriceChange,
        ["SubscriptionPriceChange"] = WebhookEventType.SubscriptionPriceChange,
        ["subscription-product-changed"] = WebhookEventType.SubscriptionProductChanged,
        ["SUBSCRIPTION_PRODUCT_CHANGED"] = WebhookEventType.SubscriptionProductChanged,
        ["SubscriptionProductChanged"] = WebhookEventType.SubscriptionProductChanged,
        ["subscription-paused"] = WebhookEventType.SubscriptionPaused,
        ["SUBSCRIPTION_PAUSED"] = WebhookEventType.SubscriptionPaused,
        ["SubscriptionPaused"] = WebhookEventType.SubscriptionPaused,
        ["subscription-resumed"] = WebhookEventType.SubscriptionResumed,
        ["SUBSCRIPTION_RESUMED"] = WebhookEventType.SubscriptionResumed,
        ["SubscriptionResumed"] = WebhookEventType.SubscriptionResumed,
        ["purchase-refunded"] = WebhookEventType.PurchaseRefunded,
        ["PURCHASE_REFUNDED"] = WebhookEventType.PurchaseRefunded,
        ["PurchaseRefunded"] = WebhookEventType.PurchaseRefunded,
        ["purchase-consumption-request"] = WebhookEventType.PurchaseConsumptionRequest,
        ["PURCHASE_CONSUMPTION_REQUEST"] = WebhookEventType.PurchaseConsumptionRequest,
        ["PurchaseConsumptionRequest"] = WebhookEventType.PurchaseConsumptionRequest,
        ["test-notification"] = WebhookEventType.TestNotification,
        ["TEST_NOTIFICATION"] = WebhookEventType.TestNotification,
        ["TestNotification"] = WebhookEventType.TestNotification,
    };

    private static readonly Dictionary<WebhookEventType, string> _toString = new()
    {
        [WebhookEventType.SubscriptionStarted] = "subscription-started",
        [WebhookEventType.SubscriptionRenewed] = "subscription-renewed",
        [WebhookEventType.SubscriptionExpired] = "subscription-expired",
        [WebhookEventType.SubscriptionInGracePeriod] = "subscription-in-grace-period",
        [WebhookEventType.SubscriptionInBillingRetry] = "subscription-in-billing-retry",
        [WebhookEventType.SubscriptionRecovered] = "subscription-recovered",
        [WebhookEventType.SubscriptionCanceled] = "subscription-canceled",
        [WebhookEventType.SubscriptionUncanceled] = "subscription-uncanceled",
        [WebhookEventType.SubscriptionRevoked] = "subscription-revoked",
        [WebhookEventType.SubscriptionPriceChange] = "subscription-price-change",
        [WebhookEventType.SubscriptionProductChanged] = "subscription-product-changed",
        [WebhookEventType.SubscriptionPaused] = "subscription-paused",
        [WebhookEventType.SubscriptionResumed] = "subscription-resumed",
        [WebhookEventType.PurchaseRefunded] = "purchase-refunded",
        [WebhookEventType.PurchaseConsumptionRequest] = "purchase-consumption-request",
        [WebhookEventType.TestNotification] = "test-notification",
    };

    public override WebhookEventType Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        var raw = reader.GetString();
        if (raw is not null && _fromString.TryGetValue(raw, out var value)) return value;
        throw new JsonException($"Unknown WebhookEventType value: {raw}");
    }

    public override void Write(Utf8JsonWriter writer, WebhookEventType value, JsonSerializerOptions options)
    {
        writer.WriteStringValue(_toString[value]);
    }

    internal static string ToRawString(WebhookEventType value) => _toString[value];
    internal static WebhookEventType FromRawString(string value) =>
        _fromString.TryGetValue(value, out var v) ? v : throw new ArgumentException($"Unknown WebhookEventType value: {value}");
}

public static class WebhookEventTypeExtensions
{
    public static string ToJson(this WebhookEventType value) => WebhookEventTypeJsonConverter.ToRawString(value);
    public static WebhookEventType FromJson(string value) => WebhookEventTypeJsonConverter.FromRawString(value);
}

// ============================================================================
// Interfaces
// ============================================================================

public interface ProductCommon
{
    string Currency { get; }
    string? DebugDescription { get; }
    string Description { get; }
    string? DisplayName { get; }
    string DisplayPrice { get; }
    string Id { get; }
    IapPlatform Platform { get; }
    double? Price { get; }
    string Title { get; }
    ProductType Type { get; }
}

public interface PurchaseCommon
{
    /// <summary>The current plan identifier. This is:</summary>
    /// <summary>- On Android: the basePlanId (e.g., &quot;premium&quot;, &quot;premium-year&quot;)</summary>
    /// <summary>- On iOS: the productId (e.g., &quot;com.example.premium_monthly&quot;, &quot;com.example.premium_yearly&quot;)</summary>
    /// <summary>This provides a unified way to identify which specific plan/tier the user is subscribed to.</summary>
    string? CurrentPlanId { get; }
    string Id { get; }
    IReadOnlyList<string>? Ids { get; }
    bool IsAutoRenewing { get; }
    IapPlatform Platform { get; }
    string ProductId { get; }
    PurchaseState PurchaseState { get; }
    /// <summary>Unified purchase token (iOS JWS, Android purchaseToken)</summary>
    string? PurchaseToken { get; }
    int Quantity { get; }
    /// <summary>Store where purchase was made</summary>
    IapStore Store { get; }
    double TransactionDate { get; }
}

// ============================================================================
// Unions
// ============================================================================

[JsonPolymorphic(TypeDiscriminatorPropertyName = "__typename")]
[JsonDerivedType(typeof(ProductAndroid), "ProductAndroid")]
[JsonDerivedType(typeof(ProductIOS), "ProductIOS")]
public abstract record Product : ProductOrSubscription;

[JsonPolymorphic(TypeDiscriminatorPropertyName = "__typename")]
[JsonDerivedType(typeof(ProductAndroid), "ProductAndroid")]
[JsonDerivedType(typeof(ProductIOS), "ProductIOS")]
[JsonDerivedType(typeof(ProductSubscriptionAndroid), "ProductSubscriptionAndroid")]
[JsonDerivedType(typeof(ProductSubscriptionIOS), "ProductSubscriptionIOS")]
public abstract record ProductOrSubscription;

[JsonPolymorphic(TypeDiscriminatorPropertyName = "__typename")]
[JsonDerivedType(typeof(ProductSubscriptionAndroid), "ProductSubscriptionAndroid")]
[JsonDerivedType(typeof(ProductSubscriptionIOS), "ProductSubscriptionIOS")]
public abstract record ProductSubscription : ProductOrSubscription;

[JsonPolymorphic(TypeDiscriminatorPropertyName = "__typename")]
[JsonDerivedType(typeof(PurchaseAndroid), "PurchaseAndroid")]
[JsonDerivedType(typeof(PurchaseIOS), "PurchaseIOS")]
public abstract record Purchase;

[JsonPolymorphic(TypeDiscriminatorPropertyName = "__typename")]
[JsonDerivedType(typeof(VerifyPurchaseResultAndroid), "VerifyPurchaseResultAndroid")]
[JsonDerivedType(typeof(VerifyPurchaseResultHorizon), "VerifyPurchaseResultHorizon")]
[JsonDerivedType(typeof(VerifyPurchaseResultIOS), "VerifyPurchaseResultIOS")]
public abstract record VerifyPurchaseResult;

// ============================================================================
// Objects
// ============================================================================

public sealed record ActiveSubscription
{
    [JsonPropertyName("autoRenewingAndroid")]
    public bool? AutoRenewingAndroid { get; init; }
    [JsonPropertyName("basePlanIdAndroid")]
    public string? BasePlanIdAndroid { get; init; }
    /// <summary>The current plan identifier. This is:</summary>
    /// <summary>- On Android: the basePlanId (e.g., &quot;premium&quot;, &quot;premium-year&quot;)</summary>
    /// <summary>- On iOS: the productId (e.g., &quot;com.example.premium_monthly&quot;, &quot;com.example.premium_yearly&quot;)</summary>
    /// <summary>This provides a unified way to identify which specific plan/tier the user is subscribed to.</summary>
    [JsonPropertyName("currentPlanId")]
    public string? CurrentPlanId { get; init; }
    [JsonPropertyName("daysUntilExpirationIOS")]
    public double? DaysUntilExpirationIOS { get; init; }
    [JsonPropertyName("environmentIOS")]
    public string? EnvironmentIOS { get; init; }
    [JsonPropertyName("expirationDateIOS")]
    public double? ExpirationDateIOS { get; init; }
    [JsonPropertyName("isActive")]
    public required bool IsActive { get; init; }
    [JsonPropertyName("productId")]
    public required string ProductId { get; init; }
    [JsonPropertyName("purchaseToken")]
    public string? PurchaseToken { get; init; }
    /// <summary>Required for subscription upgrade/downgrade on Android</summary>
    [JsonPropertyName("purchaseTokenAndroid")]
    public string? PurchaseTokenAndroid { get; init; }
    /// <summary>Renewal information from StoreKit 2 (iOS only). Contains details about subscription renewal status,</summary>
    /// <summary>pending upgrades/downgrades, and auto-renewal preferences.</summary>
    [JsonPropertyName("renewalInfoIOS")]
    public RenewalInfoIOS? RenewalInfoIOS { get; init; }
    [JsonPropertyName("transactionDate")]
    public required double TransactionDate { get; init; }
    [JsonPropertyName("transactionId")]
    public required string TransactionId { get; init; }
    /// <summary>@deprecated iOS only - use daysUntilExpirationIOS instead.</summary>
    /// <summary>Whether the subscription will expire soon (within 7 days).</summary>
    /// <summary>Consider using daysUntilExpirationIOS for more precise control.</summary>
    [JsonPropertyName("willExpireSoon")]
    public bool? WillExpireSoon { get; init; }
}

/// <summary>Advanced Commerce metadata from a transaction (iOS 18.4+).</summary>
/// <summary>Contains item details, tax information, and refund data for purchases</summary>
/// <summary>made through the Advanced Commerce API using generic SKUs.</summary>
/// <summary>Only present for transactions that use the Advanced Commerce API.</summary>
public sealed record AdvancedCommerceInfoIOS
{
    /// <summary>Optional description</summary>
    [JsonPropertyName("description")]
    public string? Description { get; init; }
    /// <summary>Optional display name</summary>
    [JsonPropertyName("displayName")]
    public string? DisplayName { get; init; }
    /// <summary>Estimated tax amount (decimal string)</summary>
    [JsonPropertyName("estimatedTax")]
    public string? EstimatedTax { get; init; }
    /// <summary>The items purchased as part of this transaction</summary>
    [JsonPropertyName("items")]
    public required IReadOnlyList<AdvancedCommerceItemIOS> Items { get; init; }
    /// <summary>Request reference identifier for tracking</summary>
    [JsonPropertyName("requestReferenceId")]
    public string? RequestReferenceId { get; init; }
    /// <summary>Tax code for the transaction</summary>
    [JsonPropertyName("taxCode")]
    public string? TaxCode { get; init; }
    /// <summary>Price excluding tax (decimal string)</summary>
    [JsonPropertyName("taxExclusivePrice")]
    public string? TaxExclusivePrice { get; init; }
    /// <summary>Tax rate applied (decimal string)</summary>
    [JsonPropertyName("taxRate")]
    public string? TaxRate { get; init; }
}

/// <summary>Details of an Advanced Commerce item (iOS 18.4+).</summary>
public sealed record AdvancedCommerceItemDetailsIOS
{
    /// <summary>JSON representation of the item details</summary>
    [JsonPropertyName("jsonRepresentation")]
    public string? JsonRepresentation { get; init; }
}

/// <summary>An item purchased through the Advanced Commerce API (iOS 18.4+).</summary>
/// <summary>Represents a developer-defined product within a generic SKU transaction.</summary>
public sealed record AdvancedCommerceItemIOS
{
    /// <summary>The item&apos;s detail information</summary>
    [JsonPropertyName("details")]
    public AdvancedCommerceItemDetailsIOS? Details { get; init; }
    /// <summary>Refunds issued for this item, if any</summary>
    [JsonPropertyName("refunds")]
    public IReadOnlyList<AdvancedCommerceRefundIOS>? Refunds { get; init; }
    /// <summary>Date access to this item was revoked (milliseconds since epoch)</summary>
    [JsonPropertyName("revocationDate")]
    public double? RevocationDate { get; init; }
}

/// <summary>Refund information for an Advanced Commerce item (iOS 18.4+).</summary>
public sealed record AdvancedCommerceRefundIOS
{
    /// <summary>JSON representation of the refund details</summary>
    [JsonPropertyName("jsonRepresentation")]
    public string? JsonRepresentation { get; init; }
}

public sealed record AppTransaction
{
    [JsonPropertyName("appId")]
    public required double AppId { get; init; }
    [JsonPropertyName("appTransactionId")]
    public string? AppTransactionId { get; init; }
    [JsonPropertyName("appVersion")]
    public required string AppVersion { get; init; }
    [JsonPropertyName("appVersionId")]
    public required double AppVersionId { get; init; }
    [JsonPropertyName("bundleId")]
    public required string BundleId { get; init; }
    [JsonPropertyName("deviceVerification")]
    public required string DeviceVerification { get; init; }
    [JsonPropertyName("deviceVerificationNonce")]
    public required string DeviceVerificationNonce { get; init; }
    [JsonPropertyName("environment")]
    public required string Environment { get; init; }
    [JsonPropertyName("originalAppVersion")]
    public required string OriginalAppVersion { get; init; }
    [JsonPropertyName("originalPlatform")]
    public string? OriginalPlatform { get; init; }
    [JsonPropertyName("originalPurchaseDate")]
    public required double OriginalPurchaseDate { get; init; }
    [JsonPropertyName("preorderDate")]
    public double? PreorderDate { get; init; }
    [JsonPropertyName("signedDate")]
    public required double SignedDate { get; init; }
}

/// <summary>Result of checking billing program availability (Android)</summary>
/// <summary>Available in Google Play Billing Library 8.2.0+</summary>
public sealed record BillingProgramAvailabilityResultAndroid
{
    /// <summary>The billing program that was checked</summary>
    [JsonPropertyName("billingProgram")]
    public required BillingProgramAndroid BillingProgram { get; init; }
    /// <summary>Whether the billing program is available for the user</summary>
    [JsonPropertyName("isAvailable")]
    public required bool IsAvailable { get; init; }
}

/// <summary>Reporting details for transactions made outside of Google Play Billing (Android)</summary>
/// <summary>Contains the external transaction token needed for reporting</summary>
/// <summary>Available in Google Play Billing Library 8.2.0+</summary>
public sealed record BillingProgramReportingDetailsAndroid
{
    /// <summary>The billing program that the reporting details are associated with</summary>
    [JsonPropertyName("billingProgram")]
    public required BillingProgramAndroid BillingProgram { get; init; }
    /// <summary>External transaction token used to report transactions made outside of Google Play Billing.</summary>
    /// <summary>This token must be used when reporting the external transaction to Google.</summary>
    [JsonPropertyName("externalTransactionToken")]
    public required string ExternalTransactionToken { get; init; }
}

/// <summary>Extended billing result with sub-response code (Android)</summary>
/// <summary>Available in Google Play Billing Library 8.0.0+</summary>
public sealed record BillingResultAndroid
{
    /// <summary>Debug message from the billing library</summary>
    [JsonPropertyName("debugMessage")]
    public string? DebugMessage { get; init; }
    /// <summary>The response code from the billing operation</summary>
    [JsonPropertyName("responseCode")]
    public required int ResponseCode { get; init; }
    /// <summary>Sub-response code for more granular error information (8.0+).</summary>
    /// <summary>Provides additional context when responseCode indicates an error.</summary>
    [JsonPropertyName("subResponseCode")]
    public SubResponseCodeAndroid? SubResponseCode { get; init; }
}

/// <summary>Details provided when user selects developer billing option (Android)</summary>
/// <summary>Received via DeveloperProvidedBillingListener callback</summary>
/// <summary>Available in Google Play Billing Library 8.3.0+</summary>
public sealed record DeveloperProvidedBillingDetailsAndroid
{
    /// <summary>External transaction token used to report transactions made through developer billing.</summary>
    /// <summary>This token must be used when reporting the external transaction to Google Play.</summary>
    /// <summary>Must be reported within 24 hours of the transaction.</summary>
    [JsonPropertyName("externalTransactionToken")]
    public required string ExternalTransactionToken { get; init; }
}

/// <summary>Discount amount details for one-time purchase offers (Android)</summary>
/// <summary>Available in Google Play Billing Library 7.0+</summary>
public sealed record DiscountAmountAndroid
{
    /// <summary>Discount amount in micro-units (1,000,000 = 1 unit of currency)</summary>
    [JsonPropertyName("discountAmountMicros")]
    public required string DiscountAmountMicros { get; init; }
    /// <summary>Formatted discount amount with currency sign (e.g., &quot;$4.99&quot;)</summary>
    [JsonPropertyName("formattedDiscountAmount")]
    public required string FormattedDiscountAmount { get; init; }
}

/// <summary>Discount display information for one-time purchase offers (Android)</summary>
/// <summary>Available in Google Play Billing Library 7.0+</summary>
public sealed record DiscountDisplayInfoAndroid
{
    /// <summary>Absolute discount amount details</summary>
    /// <summary>Only returned for fixed amount discounts</summary>
    [JsonPropertyName("discountAmount")]
    public DiscountAmountAndroid? DiscountAmount { get; init; }
    /// <summary>Percentage discount (e.g., 33 for 33% off)</summary>
    /// <summary>Only returned for percentage-based discounts</summary>
    [JsonPropertyName("percentageDiscount")]
    public int? PercentageDiscount { get; init; }
}

/// <summary>Discount information returned from the store.</summary>
/// <summary>@deprecated Use the standardized SubscriptionOffer type instead for cross-platform compatibility.</summary>
/// <summary>@see https://openiap.dev/docs/types#subscription-offer</summary>
public sealed record DiscountIOS
{
    [JsonPropertyName("identifier")]
    public required string Identifier { get; init; }
    [JsonPropertyName("localizedPrice")]
    public string? LocalizedPrice { get; init; }
    [JsonPropertyName("numberOfPeriods")]
    public required int NumberOfPeriods { get; init; }
    [JsonPropertyName("paymentMode")]
    public required PaymentModeIOS PaymentMode { get; init; }
    [JsonPropertyName("price")]
    public required string Price { get; init; }
    [JsonPropertyName("priceAmount")]
    public required double PriceAmount { get; init; }
    [JsonPropertyName("subscriptionPeriod")]
    public required string SubscriptionPeriod { get; init; }
    [JsonPropertyName("type")]
    public required string Type { get; init; }
}

/// <summary>Standardized one-time product discount offer.</summary>
/// <summary>Provides a unified interface for one-time purchase discounts across platforms.</summary>
/// <summary></summary>
/// <summary>Currently supported on Android (Google Play Billing 7.0+).</summary>
/// <summary>iOS does not support one-time purchase discounts in the same way.</summary>
/// <summary></summary>
/// <summary>@see https://openiap.dev/docs/features/discount</summary>
public sealed record DiscountOffer
{
    /// <summary>Currency code (ISO 4217, e.g., &quot;USD&quot;)</summary>
    [JsonPropertyName("currency")]
    public required string Currency { get; init; }
    /// <summary>[Android] Fixed discount amount in micro-units.</summary>
    /// <summary>Only present for fixed amount discounts.</summary>
    [JsonPropertyName("discountAmountMicrosAndroid")]
    public string? DiscountAmountMicrosAndroid { get; init; }
    /// <summary>Formatted display price string (e.g., &quot;$4.99&quot;)</summary>
    [JsonPropertyName("displayPrice")]
    public required string DisplayPrice { get; init; }
    /// <summary>[Android] Formatted discount amount string (e.g., &quot;$5.00 OFF&quot;).</summary>
    [JsonPropertyName("formattedDiscountAmountAndroid")]
    public string? FormattedDiscountAmountAndroid { get; init; }
    /// <summary>[Android] Original full price in micro-units before discount.</summary>
    /// <summary>Divide by 1,000,000 to get the actual price.</summary>
    /// <summary>Use for displaying strikethrough original price.</summary>
    [JsonPropertyName("fullPriceMicrosAndroid")]
    public string? FullPriceMicrosAndroid { get; init; }
    /// <summary>Unique identifier for the offer.</summary>
    /// <summary>- iOS: Not applicable (one-time discounts not supported)</summary>
    /// <summary>- Android: offerId from ProductAndroidOneTimePurchaseOfferDetail</summary>
    [JsonPropertyName("id")]
    public string? Id { get; init; }
    /// <summary>[Android] Limited quantity information.</summary>
    /// <summary>Contains maximumQuantity and remainingQuantity.</summary>
    [JsonPropertyName("limitedQuantityInfoAndroid")]
    public LimitedQuantityInfoAndroid? LimitedQuantityInfoAndroid { get; init; }
    /// <summary>[Android] List of tags associated with this offer.</summary>
    [JsonPropertyName("offerTagsAndroid")]
    public IReadOnlyList<string>? OfferTagsAndroid { get; init; }
    /// <summary>[Android] Offer token required for purchase.</summary>
    /// <summary>Must be passed to requestPurchase() when purchasing with this offer.</summary>
    [JsonPropertyName("offerTokenAndroid")]
    public string? OfferTokenAndroid { get; init; }
    /// <summary>[Android] Percentage discount (e.g., 33 for 33% off).</summary>
    /// <summary>Only present for percentage-based discounts.</summary>
    [JsonPropertyName("percentageDiscountAndroid")]
    public int? PercentageDiscountAndroid { get; init; }
    /// <summary>[Android] Pre-order details if this is a pre-order offer.</summary>
    /// <summary>Available in Google Play Billing Library 8.1.0+</summary>
    [JsonPropertyName("preorderDetailsAndroid")]
    public PreorderDetailsAndroid? PreorderDetailsAndroid { get; init; }
    /// <summary>Numeric price value</summary>
    [JsonPropertyName("price")]
    public required double Price { get; init; }
    /// <summary>[Android] Purchase option ID for this offer.</summary>
    /// <summary>Used to identify which purchase option the user selected.</summary>
    /// <summary>Available in Google Play Billing Library 7.0+</summary>
    [JsonPropertyName("purchaseOptionIdAndroid")]
    public string? PurchaseOptionIdAndroid { get; init; }
    /// <summary>[Android] Rental details if this is a rental offer.</summary>
    [JsonPropertyName("rentalDetailsAndroid")]
    public RentalDetailsAndroid? RentalDetailsAndroid { get; init; }
    /// <summary>Type of discount offer</summary>
    [JsonPropertyName("type")]
    public required DiscountOfferType Type { get; init; }
    /// <summary>[Android] Valid time window for the offer.</summary>
    /// <summary>Contains startTimeMillis and endTimeMillis.</summary>
    [JsonPropertyName("validTimeWindowAndroid")]
    public ValidTimeWindowAndroid? ValidTimeWindowAndroid { get; init; }
}

/// <summary>iOS DiscountOffer (output type).</summary>
/// <summary>@deprecated Use the standardized SubscriptionOffer type instead for cross-platform compatibility.</summary>
/// <summary>@see https://openiap.dev/docs/types#subscription-offer</summary>
public sealed record DiscountOfferIOS
{
    /// <summary>Discount identifier</summary>
    [JsonPropertyName("identifier")]
    public required string Identifier { get; init; }
    /// <summary>Key identifier for validation</summary>
    [JsonPropertyName("keyIdentifier")]
    public required string KeyIdentifier { get; init; }
    /// <summary>Cryptographic nonce</summary>
    [JsonPropertyName("nonce")]
    public required string Nonce { get; init; }
    /// <summary>Signature for validation</summary>
    [JsonPropertyName("signature")]
    public required string Signature { get; init; }
    /// <summary>Timestamp of discount offer</summary>
    [JsonPropertyName("timestamp")]
    public required double Timestamp { get; init; }
}

public sealed record EntitlementIOS
{
    [JsonPropertyName("jsonRepresentation")]
    public required string JsonRepresentation { get; init; }
    [JsonPropertyName("sku")]
    public required string Sku { get; init; }
    [JsonPropertyName("transactionId")]
    public required string TransactionId { get; init; }
}

/// <summary>External offer availability result (Android)</summary>
/// <summary>@deprecated Use BillingProgramAvailabilityResultAndroid with isBillingProgramAvailableAsync instead</summary>
/// <summary>Available in Google Play Billing Library 6.2.0+, deprecated in 8.2.0</summary>
public sealed record ExternalOfferAvailabilityResultAndroid
{
    /// <summary>Whether external offers are available for the user</summary>
    [JsonPropertyName("isAvailable")]
    public required bool IsAvailable { get; init; }
}

/// <summary>External offer reporting details (Android)</summary>
/// <summary>@deprecated Use BillingProgramReportingDetailsAndroid with createBillingProgramReportingDetailsAsync instead</summary>
/// <summary>Available in Google Play Billing Library 6.2.0+, deprecated in 8.2.0</summary>
public sealed record ExternalOfferReportingDetailsAndroid
{
    /// <summary>External transaction token for reporting external offer transactions</summary>
    [JsonPropertyName("externalTransactionToken")]
    public required string ExternalTransactionToken { get; init; }
}

/// <summary>Result of showing ExternalPurchaseCustomLink notice (iOS 18.1+).</summary>
public sealed record ExternalPurchaseCustomLinkNoticeResultIOS
{
    /// <summary>Whether the user chose to continue to external purchase</summary>
    [JsonPropertyName("continued")]
    public required bool Continued { get; init; }
    /// <summary>Optional error message if the presentation failed</summary>
    [JsonPropertyName("error")]
    public string? Error { get; init; }
}

/// <summary>Result of requesting an ExternalPurchaseCustomLink token (iOS 18.1+).</summary>
public sealed record ExternalPurchaseCustomLinkTokenResultIOS
{
    /// <summary>Optional error message if token retrieval failed</summary>
    [JsonPropertyName("error")]
    public string? Error { get; init; }
    /// <summary>The external purchase token string.</summary>
    /// <summary>Report this token to Apple&apos;s External Purchase Server API.</summary>
    [JsonPropertyName("token")]
    public string? Token { get; init; }
}

/// <summary>Result of presenting an external purchase link</summary>
public sealed record ExternalPurchaseLinkResultIOS
{
    /// <summary>Optional error message if the presentation failed</summary>
    [JsonPropertyName("error")]
    public string? Error { get; init; }
    /// <summary>Whether the user completed the external purchase flow</summary>
    [JsonPropertyName("success")]
    public required bool Success { get; init; }
}

/// <summary>Result of presenting external purchase notice sheet (iOS 17.4+)</summary>
/// <summary>Returns the token when user continues to external purchase.</summary>
public sealed record ExternalPurchaseNoticeResultIOS
{
    /// <summary>Optional error message if the presentation failed</summary>
    [JsonPropertyName("error")]
    public string? Error { get; init; }
    /// <summary>External purchase token returned when user continues (iOS 17.4+).</summary>
    /// <summary>This token should be reported to Apple&apos;s External Purchase Server API.</summary>
    /// <summary>Only present when result is Continue.</summary>
    [JsonPropertyName("externalPurchaseToken")]
    public string? ExternalPurchaseToken { get; init; }
    /// <summary>Notice result indicating user action</summary>
    [JsonPropertyName("result")]
    public required ExternalPurchaseNoticeAction Result { get; init; }
}

public abstract record FetchProductsResult;

public sealed record FetchProductsResultAll(IReadOnlyList<ProductOrSubscription>? Value) : FetchProductsResult;

public sealed record FetchProductsResultProducts(IReadOnlyList<Product>? Value) : FetchProductsResult;

public sealed record FetchProductsResultSubscriptions(IReadOnlyList<ProductSubscription>? Value) : FetchProductsResult;

/// <summary>Installment plan details for subscription offers (Android)</summary>
/// <summary>Contains information about the installment plan commitment.</summary>
/// <summary>Available in Google Play Billing Library 7.0+</summary>
public sealed record InstallmentPlanDetailsAndroid
{
    /// <summary>Committed payments count after a user signs up for this subscription plan.</summary>
    /// <summary>For example, for a monthly subscription with commitmentPaymentsCount of 12,</summary>
    /// <summary>users will be charged monthly for 12 months after signup.</summary>
    [JsonPropertyName("commitmentPaymentsCount")]
    public required int CommitmentPaymentsCount { get; init; }
    /// <summary>Subsequent committed payments count after the subscription plan renews.</summary>
    /// <summary>For example, for a monthly subscription with subsequentCommitmentPaymentsCount of 12,</summary>
    /// <summary>users will be committed to another 12 monthly payments when the plan renews.</summary>
    /// <summary>Returns 0 if the installment plan has no subsequent commitment (reverts to normal plan).</summary>
    [JsonPropertyName("subsequentCommitmentPaymentsCount")]
    public required int SubsequentCommitmentPaymentsCount { get; init; }
}

/// <summary>Limited quantity information for one-time purchase offers (Android)</summary>
/// <summary>Available in Google Play Billing Library 7.0+</summary>
public sealed record LimitedQuantityInfoAndroid
{
    /// <summary>Maximum quantity a user can purchase</summary>
    [JsonPropertyName("maximumQuantity")]
    public required int MaximumQuantity { get; init; }
    /// <summary>Remaining quantity the user can still purchase</summary>
    [JsonPropertyName("remainingQuantity")]
    public required int RemainingQuantity { get; init; }
}

/// <summary>Pending purchase update for subscription upgrades/downgrades (Android)</summary>
/// <summary>When a user initiates a subscription change (upgrade/downgrade), the new purchase</summary>
/// <summary>may be pending until the current billing period ends. This type contains the</summary>
/// <summary>details of the pending change.</summary>
/// <summary>Available in Google Play Billing Library 5.0+</summary>
public sealed record PendingPurchaseUpdateAndroid
{
    /// <summary>Product IDs for the pending purchase update.</summary>
    /// <summary>These are the new products the user is switching to.</summary>
    [JsonPropertyName("products")]
    public required IReadOnlyList<string> Products { get; init; }
    /// <summary>Purchase token for the pending transaction.</summary>
    /// <summary>Use this token to track or manage the pending purchase update.</summary>
    [JsonPropertyName("purchaseToken")]
    public required string PurchaseToken { get; init; }
}

/// <summary>Pre-order details for one-time purchase products (Android)</summary>
/// <summary>Available in Google Play Billing Library 8.1.0+</summary>
public sealed record PreorderDetailsAndroid
{
    /// <summary>Pre-order presale end time in milliseconds since epoch.</summary>
    /// <summary>This is when the presale period ends and the product will be released.</summary>
    [JsonPropertyName("preorderPresaleEndTimeMillis")]
    public required string PreorderPresaleEndTimeMillis { get; init; }
    /// <summary>Pre-order release time in milliseconds since epoch.</summary>
    /// <summary>This is when the product will be available to users who pre-ordered.</summary>
    [JsonPropertyName("preorderReleaseTimeMillis")]
    public required string PreorderReleaseTimeMillis { get; init; }
}

public sealed record PricingPhaseAndroid
{
    [JsonPropertyName("billingCycleCount")]
    public required int BillingCycleCount { get; init; }
    [JsonPropertyName("billingPeriod")]
    public required string BillingPeriod { get; init; }
    [JsonPropertyName("formattedPrice")]
    public required string FormattedPrice { get; init; }
    [JsonPropertyName("priceAmountMicros")]
    public required string PriceAmountMicros { get; init; }
    [JsonPropertyName("priceCurrencyCode")]
    public required string PriceCurrencyCode { get; init; }
    [JsonPropertyName("recurrenceMode")]
    public required int RecurrenceMode { get; init; }
}

public sealed record PricingPhasesAndroid
{
    [JsonPropertyName("pricingPhaseList")]
    public required IReadOnlyList<PricingPhaseAndroid> PricingPhaseList { get; init; }
}

public sealed record ProductAndroid : Product, ProductCommon
{
    [JsonPropertyName("currency")]
    public required string Currency { get; init; }
    [JsonPropertyName("debugDescription")]
    public string? DebugDescription { get; init; }
    [JsonPropertyName("description")]
    public required string Description { get; init; }
    /// <summary>Standardized discount offers for one-time products.</summary>
    /// <summary>Cross-platform type with Android-specific fields using suffix.</summary>
    /// <summary>@see https://openiap.dev/docs/types#discount-offer</summary>
    [JsonPropertyName("discountOffers")]
    public IReadOnlyList<DiscountOffer>? DiscountOffers { get; init; }
    [JsonPropertyName("displayName")]
    public string? DisplayName { get; init; }
    [JsonPropertyName("displayPrice")]
    public required string DisplayPrice { get; init; }
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("nameAndroid")]
    public required string NameAndroid { get; init; }
    /// <summary>One-time purchase offer details including discounts (Android)</summary>
    /// <summary>Returns all eligible offers. Available in Google Play Billing Library 7.0+</summary>
    /// <summary>@deprecated Use discountOffers instead for cross-platform compatibility.</summary>
    [JsonPropertyName("oneTimePurchaseOfferDetailsAndroid")]
    public IReadOnlyList<ProductAndroidOneTimePurchaseOfferDetail>? OneTimePurchaseOfferDetailsAndroid { get; init; }
    [JsonPropertyName("platform")]
    public IapPlatform Platform { get; init; } = IapPlatform.Android;
    [JsonPropertyName("price")]
    public double? Price { get; init; }
    /// <summary>Product-level status code indicating fetch result (Android 8.0+)</summary>
    /// <summary>OK = product fetched successfully</summary>
    /// <summary>NOT_FOUND = SKU doesn&apos;t exist</summary>
    /// <summary>NO_OFFERS_AVAILABLE = user not eligible for any offers</summary>
    /// <summary>Available in Google Play Billing Library 8.0.0+</summary>
    [JsonPropertyName("productStatusAndroid")]
    public ProductStatusAndroid? ProductStatusAndroid { get; init; }
    /// <summary>@deprecated Use subscriptionOffers instead for cross-platform compatibility.</summary>
    [JsonPropertyName("subscriptionOfferDetailsAndroid")]
    public IReadOnlyList<ProductSubscriptionAndroidOfferDetails>? SubscriptionOfferDetailsAndroid { get; init; }
    /// <summary>Standardized subscription offers.</summary>
    /// <summary>Cross-platform type with Android-specific fields using suffix.</summary>
    /// <summary>@see https://openiap.dev/docs/types#subscription-offer</summary>
    [JsonPropertyName("subscriptionOffers")]
    public IReadOnlyList<SubscriptionOffer>? SubscriptionOffers { get; init; }
    [JsonPropertyName("title")]
    public required string Title { get; init; }
    [JsonPropertyName("type")]
    public ProductType Type { get; init; } = ProductType.InApp;
}

/// <summary>One-time purchase offer details (Android).</summary>
/// <summary>Available in Google Play Billing Library 7.0+</summary>
/// <summary>@deprecated Use the standardized DiscountOffer type instead for cross-platform compatibility.</summary>
/// <summary>@see https://openiap.dev/docs/types#discount-offer</summary>
public sealed record ProductAndroidOneTimePurchaseOfferDetail
{
    /// <summary>Discount display information</summary>
    /// <summary>Only available for discounted offers</summary>
    [JsonPropertyName("discountDisplayInfo")]
    public DiscountDisplayInfoAndroid? DiscountDisplayInfo { get; init; }
    [JsonPropertyName("formattedPrice")]
    public required string FormattedPrice { get; init; }
    /// <summary>Full (non-discounted) price in micro-units</summary>
    /// <summary>Only available for discounted offers</summary>
    [JsonPropertyName("fullPriceMicros")]
    public string? FullPriceMicros { get; init; }
    /// <summary>Limited quantity information</summary>
    [JsonPropertyName("limitedQuantityInfo")]
    public LimitedQuantityInfoAndroid? LimitedQuantityInfo { get; init; }
    /// <summary>Offer ID</summary>
    [JsonPropertyName("offerId")]
    public string? OfferId { get; init; }
    /// <summary>List of offer tags</summary>
    [JsonPropertyName("offerTags")]
    public required IReadOnlyList<string> OfferTags { get; init; }
    /// <summary>Offer token for use in BillingFlowParams when purchasing</summary>
    [JsonPropertyName("offerToken")]
    public required string OfferToken { get; init; }
    /// <summary>Pre-order details for products available for pre-order</summary>
    /// <summary>Available in Google Play Billing Library 8.1.0+</summary>
    [JsonPropertyName("preorderDetailsAndroid")]
    public PreorderDetailsAndroid? PreorderDetailsAndroid { get; init; }
    [JsonPropertyName("priceAmountMicros")]
    public required string PriceAmountMicros { get; init; }
    [JsonPropertyName("priceCurrencyCode")]
    public required string PriceCurrencyCode { get; init; }
    /// <summary>Purchase option ID for this offer (Android)</summary>
    /// <summary>Used to identify which purchase option the user selected.</summary>
    /// <summary>Available in Google Play Billing Library 7.0+</summary>
    [JsonPropertyName("purchaseOptionId")]
    public string? PurchaseOptionId { get; init; }
    /// <summary>Rental details for rental offers</summary>
    [JsonPropertyName("rentalDetailsAndroid")]
    public RentalDetailsAndroid? RentalDetailsAndroid { get; init; }
    /// <summary>Valid time window for the offer</summary>
    [JsonPropertyName("validTimeWindow")]
    public ValidTimeWindowAndroid? ValidTimeWindow { get; init; }
}

public sealed record ProductIOS : Product, ProductCommon
{
    [JsonPropertyName("currency")]
    public required string Currency { get; init; }
    [JsonPropertyName("debugDescription")]
    public string? DebugDescription { get; init; }
    [JsonPropertyName("description")]
    public required string Description { get; init; }
    [JsonPropertyName("displayName")]
    public string? DisplayName { get; init; }
    [JsonPropertyName("displayNameIOS")]
    public required string DisplayNameIOS { get; init; }
    [JsonPropertyName("displayPrice")]
    public required string DisplayPrice { get; init; }
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("isFamilyShareableIOS")]
    public required bool IsFamilyShareableIOS { get; init; }
    [JsonPropertyName("jsonRepresentationIOS")]
    public required string JsonRepresentationIOS { get; init; }
    [JsonPropertyName("platform")]
    public IapPlatform Platform { get; init; } = IapPlatform.IOS;
    [JsonPropertyName("price")]
    public double? Price { get; init; }
    /// <summary>iOS 26.4+ subscription pricing terms, including billing plan metadata for</summary>
    /// <summary>monthly subscriptions with a 12-month commitment.</summary>
    [JsonPropertyName("pricingTermsIOS")]
    public IReadOnlyList<SubscriptionPricingTermsIOS>? PricingTermsIOS { get; init; }
    /// <summary>@deprecated Use subscriptionOffers instead for cross-platform compatibility.</summary>
    [JsonPropertyName("subscriptionInfoIOS")]
    public SubscriptionInfoIOS? SubscriptionInfoIOS { get; init; }
    /// <summary>Standardized subscription offers.</summary>
    /// <summary>Cross-platform type with iOS-specific fields using suffix.</summary>
    /// <summary>Note: iOS does not support one-time product discounts.</summary>
    /// <summary>@see https://openiap.dev/docs/types#subscription-offer</summary>
    [JsonPropertyName("subscriptionOffers")]
    public IReadOnlyList<SubscriptionOffer>? SubscriptionOffers { get; init; }
    [JsonPropertyName("title")]
    public required string Title { get; init; }
    [JsonPropertyName("type")]
    public ProductType Type { get; init; } = ProductType.InApp;
    [JsonPropertyName("typeIOS")]
    public required ProductTypeIOS TypeIOS { get; init; }
}

public sealed record ProductSubscriptionAndroid : ProductSubscription, ProductCommon
{
    [JsonPropertyName("currency")]
    public required string Currency { get; init; }
    [JsonPropertyName("debugDescription")]
    public string? DebugDescription { get; init; }
    [JsonPropertyName("description")]
    public required string Description { get; init; }
    /// <summary>Standardized discount offers for one-time products.</summary>
    /// <summary>Cross-platform type with Android-specific fields using suffix.</summary>
    /// <summary>@see https://openiap.dev/docs/types#discount-offer</summary>
    [JsonPropertyName("discountOffers")]
    public IReadOnlyList<DiscountOffer>? DiscountOffers { get; init; }
    [JsonPropertyName("displayName")]
    public string? DisplayName { get; init; }
    [JsonPropertyName("displayPrice")]
    public required string DisplayPrice { get; init; }
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("nameAndroid")]
    public required string NameAndroid { get; init; }
    /// <summary>One-time purchase offer details including discounts (Android)</summary>
    /// <summary>Returns all eligible offers. Available in Google Play Billing Library 7.0+</summary>
    /// <summary>@deprecated Use discountOffers instead for cross-platform compatibility.</summary>
    [JsonPropertyName("oneTimePurchaseOfferDetailsAndroid")]
    public IReadOnlyList<ProductAndroidOneTimePurchaseOfferDetail>? OneTimePurchaseOfferDetailsAndroid { get; init; }
    [JsonPropertyName("platform")]
    public IapPlatform Platform { get; init; } = IapPlatform.Android;
    [JsonPropertyName("price")]
    public double? Price { get; init; }
    /// <summary>Product-level status code indicating fetch result (Android 8.0+)</summary>
    /// <summary>OK = product fetched successfully</summary>
    /// <summary>NOT_FOUND = SKU doesn&apos;t exist</summary>
    /// <summary>NO_OFFERS_AVAILABLE = user not eligible for any offers</summary>
    /// <summary>Available in Google Play Billing Library 8.0.0+</summary>
    [JsonPropertyName("productStatusAndroid")]
    public ProductStatusAndroid? ProductStatusAndroid { get; init; }
    /// <summary>@deprecated Use subscriptionOffers instead for cross-platform compatibility.</summary>
    [JsonPropertyName("subscriptionOfferDetailsAndroid")]
    public required IReadOnlyList<ProductSubscriptionAndroidOfferDetails> SubscriptionOfferDetailsAndroid { get; init; }
    /// <summary>Standardized subscription offers.</summary>
    /// <summary>Cross-platform type with Android-specific fields using suffix.</summary>
    /// <summary>@see https://openiap.dev/docs/types#subscription-offer</summary>
    [JsonPropertyName("subscriptionOffers")]
    public required IReadOnlyList<SubscriptionOffer> SubscriptionOffers { get; init; }
    [JsonPropertyName("title")]
    public required string Title { get; init; }
    [JsonPropertyName("type")]
    public ProductType Type { get; init; } = ProductType.Subs;
}

/// <summary>Subscription offer details (Android).</summary>
/// <summary>@deprecated Use the standardized SubscriptionOffer type instead for cross-platform compatibility.</summary>
/// <summary>@see https://openiap.dev/docs/types#subscription-offer</summary>
public sealed record ProductSubscriptionAndroidOfferDetails
{
    [JsonPropertyName("basePlanId")]
    public required string BasePlanId { get; init; }
    /// <summary>Installment plan details for this subscription offer.</summary>
    /// <summary>Only set for installment subscription plans; null for non-installment plans.</summary>
    /// <summary>Available in Google Play Billing Library 7.0+</summary>
    [JsonPropertyName("installmentPlanDetails")]
    public InstallmentPlanDetailsAndroid? InstallmentPlanDetails { get; init; }
    [JsonPropertyName("offerId")]
    public string? OfferId { get; init; }
    [JsonPropertyName("offerTags")]
    public required IReadOnlyList<string> OfferTags { get; init; }
    [JsonPropertyName("offerToken")]
    public required string OfferToken { get; init; }
    [JsonPropertyName("pricingPhases")]
    public required PricingPhasesAndroid PricingPhases { get; init; }
}

public sealed record ProductSubscriptionIOS : ProductSubscription, ProductCommon
{
    [JsonPropertyName("currency")]
    public required string Currency { get; init; }
    [JsonPropertyName("debugDescription")]
    public string? DebugDescription { get; init; }
    [JsonPropertyName("description")]
    public required string Description { get; init; }
    /// <summary>@deprecated Use subscriptionOffers instead for cross-platform compatibility.</summary>
    [JsonPropertyName("discountsIOS")]
    public IReadOnlyList<DiscountIOS>? DiscountsIOS { get; init; }
    [JsonPropertyName("displayName")]
    public string? DisplayName { get; init; }
    [JsonPropertyName("displayNameIOS")]
    public required string DisplayNameIOS { get; init; }
    [JsonPropertyName("displayPrice")]
    public required string DisplayPrice { get; init; }
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("introductoryPriceAsAmountIOS")]
    public string? IntroductoryPriceAsAmountIOS { get; init; }
    [JsonPropertyName("introductoryPriceIOS")]
    public string? IntroductoryPriceIOS { get; init; }
    [JsonPropertyName("introductoryPriceNumberOfPeriodsIOS")]
    public string? IntroductoryPriceNumberOfPeriodsIOS { get; init; }
    [JsonPropertyName("introductoryPricePaymentModeIOS")]
    public required PaymentModeIOS IntroductoryPricePaymentModeIOS { get; init; }
    [JsonPropertyName("introductoryPriceSubscriptionPeriodIOS")]
    public SubscriptionPeriodIOS? IntroductoryPriceSubscriptionPeriodIOS { get; init; }
    [JsonPropertyName("isFamilyShareableIOS")]
    public required bool IsFamilyShareableIOS { get; init; }
    [JsonPropertyName("jsonRepresentationIOS")]
    public required string JsonRepresentationIOS { get; init; }
    [JsonPropertyName("platform")]
    public IapPlatform Platform { get; init; } = IapPlatform.IOS;
    [JsonPropertyName("price")]
    public double? Price { get; init; }
    /// <summary>iOS 26.4+ subscription pricing terms, including billing plan metadata for</summary>
    /// <summary>monthly subscriptions with a 12-month commitment.</summary>
    [JsonPropertyName("pricingTermsIOS")]
    public IReadOnlyList<SubscriptionPricingTermsIOS>? PricingTermsIOS { get; init; }
    /// <summary>App Store subscription group identifier for intro-offer eligibility checks.</summary>
    [JsonPropertyName("subscriptionGroupIdIOS")]
    public string? SubscriptionGroupIdIOS { get; init; }
    /// <summary>@deprecated Use subscriptionOffers for offer metadata and subscriptionGroupIdIOS for the App Store subscription group identifier.</summary>
    [JsonPropertyName("subscriptionInfoIOS")]
    public SubscriptionInfoIOS? SubscriptionInfoIOS { get; init; }
    /// <summary>Standardized subscription offers.</summary>
    /// <summary>Cross-platform type with iOS-specific fields using suffix.</summary>
    /// <summary>@see https://openiap.dev/docs/types#subscription-offer</summary>
    [JsonPropertyName("subscriptionOffers")]
    public IReadOnlyList<SubscriptionOffer>? SubscriptionOffers { get; init; }
    [JsonPropertyName("subscriptionPeriodNumberIOS")]
    public string? SubscriptionPeriodNumberIOS { get; init; }
    [JsonPropertyName("subscriptionPeriodUnitIOS")]
    public SubscriptionPeriodIOS? SubscriptionPeriodUnitIOS { get; init; }
    [JsonPropertyName("title")]
    public required string Title { get; init; }
    [JsonPropertyName("type")]
    public ProductType Type { get; init; } = ProductType.Subs;
    [JsonPropertyName("typeIOS")]
    public required ProductTypeIOS TypeIOS { get; init; }
}

public sealed record PurchaseAndroid : Purchase, PurchaseCommon
{
    [JsonPropertyName("autoRenewingAndroid")]
    public bool? AutoRenewingAndroid { get; init; }
    [JsonPropertyName("currentPlanId")]
    public string? CurrentPlanId { get; init; }
    [JsonPropertyName("dataAndroid")]
    public string? DataAndroid { get; init; }
    [JsonPropertyName("developerPayloadAndroid")]
    public string? DeveloperPayloadAndroid { get; init; }
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("ids")]
    public IReadOnlyList<string>? Ids { get; init; }
    [JsonPropertyName("isAcknowledgedAndroid")]
    public bool? IsAcknowledgedAndroid { get; init; }
    [JsonPropertyName("isAutoRenewing")]
    public required bool IsAutoRenewing { get; init; }
    /// <summary>Whether the subscription is suspended (Android)</summary>
    /// <summary>A suspended subscription means the user&apos;s payment method failed and they need to fix it.</summary>
    /// <summary>Users should be directed to the subscription center to resolve the issue.</summary>
    /// <summary>Do NOT grant entitlements for suspended subscriptions.</summary>
    /// <summary>Available in Google Play Billing Library 8.1.0+</summary>
    [JsonPropertyName("isSuspendedAndroid")]
    public bool? IsSuspendedAndroid { get; init; }
    [JsonPropertyName("obfuscatedAccountIdAndroid")]
    public string? ObfuscatedAccountIdAndroid { get; init; }
    [JsonPropertyName("obfuscatedProfileIdAndroid")]
    public string? ObfuscatedProfileIdAndroid { get; init; }
    [JsonPropertyName("packageNameAndroid")]
    public string? PackageNameAndroid { get; init; }
    /// <summary>Pending purchase update for uncommitted subscription upgrade/downgrade (Android)</summary>
    /// <summary>Contains the new products and purchase token for the pending transaction.</summary>
    /// <summary>Returns null if no pending update exists.</summary>
    /// <summary>Available in Google Play Billing Library 5.0+</summary>
    [JsonPropertyName("pendingPurchaseUpdateAndroid")]
    public PendingPurchaseUpdateAndroid? PendingPurchaseUpdateAndroid { get; init; }
    [JsonPropertyName("platform")]
    public required IapPlatform Platform { get; init; }
    [JsonPropertyName("productId")]
    public required string ProductId { get; init; }
    [JsonPropertyName("purchaseState")]
    public required PurchaseState PurchaseState { get; init; }
    [JsonPropertyName("purchaseToken")]
    public string? PurchaseToken { get; init; }
    [JsonPropertyName("quantity")]
    public required int Quantity { get; init; }
    [JsonPropertyName("signatureAndroid")]
    public string? SignatureAndroid { get; init; }
    /// <summary>Store where purchase was made</summary>
    [JsonPropertyName("store")]
    public required IapStore Store { get; init; }
    [JsonPropertyName("transactionDate")]
    public required double TransactionDate { get; init; }
    [JsonPropertyName("transactionId")]
    public string? TransactionId { get; init; }
}

public sealed record PurchaseError
{
    [JsonPropertyName("code")]
    public required ErrorCode Code { get; init; }
    [JsonPropertyName("debugMessage")]
    public string? DebugMessage { get; init; }
    [JsonPropertyName("isEmptyProductList")]
    public bool? IsEmptyProductList { get; init; }
    [JsonPropertyName("message")]
    public required string Message { get; init; }
    [JsonPropertyName("productId")]
    public string? ProductId { get; init; }
    [JsonPropertyName("productIds")]
    public IReadOnlyList<string>? ProductIds { get; init; }
    [JsonPropertyName("productType")]
    public string? ProductType { get; init; }
    [JsonPropertyName("responseCode")]
    public int? ResponseCode { get; init; }
}

public sealed record PurchaseIOS : Purchase, PurchaseCommon
{
    /// <summary>Advanced Commerce API metadata (iOS 18.4+).</summary>
    /// <summary>Present only for transactions that use the Advanced Commerce API.</summary>
    /// <summary>Contains item details, tax information, and refund data for generic SKU purchases.</summary>
    [JsonPropertyName("advancedCommerceInfoIOS")]
    public AdvancedCommerceInfoIOS? AdvancedCommerceInfoIOS { get; init; }
    [JsonPropertyName("appAccountToken")]
    public string? AppAccountToken { get; init; }
    [JsonPropertyName("appBundleIdIOS")]
    public string? AppBundleIdIOS { get; init; }
    /// <summary>iOS 26.4+ billing plan selected for this transaction.</summary>
    [JsonPropertyName("billingPlanTypeIOS")]
    public SubscriptionBillingPlanTypeIOS? BillingPlanTypeIOS { get; init; }
    /// <summary>iOS 26.4+ progress information for monthly subscriptions with a 12-month commitment.</summary>
    [JsonPropertyName("commitmentInfoIOS")]
    public TransactionCommitmentInfoIOS? CommitmentInfoIOS { get; init; }
    [JsonPropertyName("countryCodeIOS")]
    public string? CountryCodeIOS { get; init; }
    [JsonPropertyName("currencyCodeIOS")]
    public string? CurrencyCodeIOS { get; init; }
    [JsonPropertyName("currencySymbolIOS")]
    public string? CurrencySymbolIOS { get; init; }
    [JsonPropertyName("currentPlanId")]
    public string? CurrentPlanId { get; init; }
    [JsonPropertyName("environmentIOS")]
    public string? EnvironmentIOS { get; init; }
    [JsonPropertyName("expirationDateIOS")]
    public double? ExpirationDateIOS { get; init; }
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("ids")]
    public IReadOnlyList<string>? Ids { get; init; }
    [JsonPropertyName("isAutoRenewing")]
    public required bool IsAutoRenewing { get; init; }
    [JsonPropertyName("isUpgradedIOS")]
    public bool? IsUpgradedIOS { get; init; }
    [JsonPropertyName("offerIOS")]
    public PurchaseOfferIOS? OfferIOS { get; init; }
    [JsonPropertyName("originalTransactionDateIOS")]
    public double? OriginalTransactionDateIOS { get; init; }
    [JsonPropertyName("originalTransactionIdentifierIOS")]
    public string? OriginalTransactionIdentifierIOS { get; init; }
    [JsonPropertyName("ownershipTypeIOS")]
    public string? OwnershipTypeIOS { get; init; }
    [JsonPropertyName("platform")]
    public required IapPlatform Platform { get; init; }
    [JsonPropertyName("productId")]
    public required string ProductId { get; init; }
    [JsonPropertyName("purchaseState")]
    public required PurchaseState PurchaseState { get; init; }
    [JsonPropertyName("purchaseToken")]
    public string? PurchaseToken { get; init; }
    [JsonPropertyName("quantity")]
    public required int Quantity { get; init; }
    [JsonPropertyName("quantityIOS")]
    public int? QuantityIOS { get; init; }
    [JsonPropertyName("reasonIOS")]
    public string? ReasonIOS { get; init; }
    [JsonPropertyName("reasonStringRepresentationIOS")]
    public string? ReasonStringRepresentationIOS { get; init; }
    [JsonPropertyName("renewalInfoIOS")]
    public RenewalInfoIOS? RenewalInfoIOS { get; init; }
    [JsonPropertyName("revocationDateIOS")]
    public double? RevocationDateIOS { get; init; }
    [JsonPropertyName("revocationReasonIOS")]
    public string? RevocationReasonIOS { get; init; }
    /// <summary>Store where purchase was made</summary>
    [JsonPropertyName("store")]
    public required IapStore Store { get; init; }
    [JsonPropertyName("storefrontCountryCodeIOS")]
    public string? StorefrontCountryCodeIOS { get; init; }
    [JsonPropertyName("subscriptionGroupIdIOS")]
    public string? SubscriptionGroupIdIOS { get; init; }
    [JsonPropertyName("transactionDate")]
    public required double TransactionDate { get; init; }
    [JsonPropertyName("transactionId")]
    public required string TransactionId { get; init; }
    [JsonPropertyName("transactionReasonIOS")]
    public string? TransactionReasonIOS { get; init; }
    [JsonPropertyName("webOrderLineItemIdIOS")]
    public string? WebOrderLineItemIdIOS { get; init; }
}

public sealed record PurchaseOfferIOS
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("paymentMode")]
    public required string PaymentMode { get; init; }
    [JsonPropertyName("type")]
    public required string Type { get; init; }
}

public sealed record RefundResultIOS
{
    [JsonPropertyName("message")]
    public string? Message { get; init; }
    [JsonPropertyName("status")]
    public required string Status { get; init; }
}

public sealed record RenewalCommitmentInfoIOS
{
    [JsonPropertyName("commitmentAutoRenewProductId")]
    public required string CommitmentAutoRenewProductId { get; init; }
    [JsonPropertyName("commitmentAutoRenewStatus")]
    public required bool CommitmentAutoRenewStatus { get; init; }
    [JsonPropertyName("commitmentRenewalBillingPlanType")]
    public required SubscriptionBillingPlanTypeIOS CommitmentRenewalBillingPlanType { get; init; }
    [JsonPropertyName("commitmentRenewalDate")]
    public required double CommitmentRenewalDate { get; init; }
    [JsonPropertyName("commitmentRenewalPrice")]
    public required double CommitmentRenewalPrice { get; init; }
}

/// <summary>Subscription renewal information from Product.SubscriptionInfo.RenewalInfo</summary>
/// <summary>https://developer.apple.com/documentation/storekit/product/subscriptioninfo/renewalinfo</summary>
public sealed record RenewalInfoIOS
{
    [JsonPropertyName("autoRenewPreference")]
    public string? AutoRenewPreference { get; init; }
    /// <summary>iOS 26.4+ renewal commitment metadata for monthly subscriptions with a</summary>
    /// <summary>12-month commitment.</summary>
    [JsonPropertyName("commitmentInfo")]
    public RenewalCommitmentInfoIOS? CommitmentInfo { get; init; }
    /// <summary>When subscription expires due to cancellation/billing issue</summary>
    /// <summary>Possible values: &quot;VOLUNTARY&quot;, &quot;BILLING_ERROR&quot;, &quot;DID_NOT_AGREE_TO_PRICE_INCREASE&quot;, &quot;PRODUCT_NOT_AVAILABLE&quot;, &quot;UNKNOWN&quot;</summary>
    [JsonPropertyName("expirationReason")]
    public string? ExpirationReason { get; init; }
    /// <summary>Grace period expiration date (milliseconds since epoch)</summary>
    /// <summary>When set, subscription is in grace period (billing issue but still has access)</summary>
    [JsonPropertyName("gracePeriodExpirationDate")]
    public double? GracePeriodExpirationDate { get; init; }
    /// <summary>True if subscription failed to renew due to billing issue and is retrying</summary>
    /// <summary>Note: Not directly available in RenewalInfo, available in Status</summary>
    [JsonPropertyName("isInBillingRetry")]
    public bool? IsInBillingRetry { get; init; }
    [JsonPropertyName("jsonRepresentation")]
    public string? JsonRepresentation { get; init; }
    /// <summary>Product ID that will be used on next renewal (when user upgrades/downgrades)</summary>
    /// <summary>If set and different from current productId, subscription will change on expiration</summary>
    [JsonPropertyName("pendingUpgradeProductId")]
    public string? PendingUpgradeProductId { get; init; }
    /// <summary>User&apos;s response to subscription price increase</summary>
    /// <summary>Possible values: &quot;AGREED&quot;, &quot;PENDING&quot;, null (no price increase)</summary>
    [JsonPropertyName("priceIncreaseStatus")]
    public string? PriceIncreaseStatus { get; init; }
    /// <summary>iOS 26.4+ billing plan that will renew after the current period.</summary>
    [JsonPropertyName("renewalBillingPlanType")]
    public SubscriptionBillingPlanTypeIOS? RenewalBillingPlanType { get; init; }
    /// <summary>Expected renewal date (milliseconds since epoch)</summary>
    /// <summary>For active subscriptions, when the next renewal/charge will occur</summary>
    [JsonPropertyName("renewalDate")]
    public double? RenewalDate { get; init; }
    /// <summary>Offer ID applied to next renewal (promotional offer, subscription offer code, etc.)</summary>
    [JsonPropertyName("renewalOfferId")]
    public string? RenewalOfferId { get; init; }
    /// <summary>Type of offer applied to next renewal</summary>
    /// <summary>Possible values: &quot;PROMOTIONAL&quot;, &quot;SUBSCRIPTION_OFFER_CODE&quot;, &quot;WIN_BACK&quot;, etc.</summary>
    [JsonPropertyName("renewalOfferType")]
    public string? RenewalOfferType { get; init; }
    [JsonPropertyName("willAutoRenew")]
    public required bool WillAutoRenew { get; init; }
}

/// <summary>Rental details for one-time purchase products that can be rented (Android)</summary>
/// <summary>Available in Google Play Billing Library 7.0+</summary>
public sealed record RentalDetailsAndroid
{
    /// <summary>Rental expiration period in ISO 8601 format</summary>
    /// <summary>Time after rental period ends when user can still extend</summary>
    [JsonPropertyName("rentalExpirationPeriod")]
    public string? RentalExpirationPeriod { get; init; }
    /// <summary>Rental period in ISO 8601 format (e.g., P7D for 7 days)</summary>
    [JsonPropertyName("rentalPeriod")]
    public required string RentalPeriod { get; init; }
}

public abstract record RequestPurchaseResult;

public sealed record RequestPurchaseResultPurchase(Purchase? Value) : RequestPurchaseResult;

public sealed record RequestPurchaseResultPurchases(IReadOnlyList<Purchase>? Value) : RequestPurchaseResult;

public sealed record RequestVerifyPurchaseWithIapkitResult
{
    /// <summary>Whether the purchase is valid (not falsified).</summary>
    [JsonPropertyName("isValid")]
    public required bool IsValid { get; init; }
    /// <summary>The current state of the purchase.</summary>
    [JsonPropertyName("state")]
    public required IapkitPurchaseState State { get; init; }
    [JsonPropertyName("store")]
    public required IapStore Store { get; init; }
}

public sealed record SubscriptionCommitmentInfoIOS
{
    [JsonPropertyName("displayPrice")]
    public required string DisplayPrice { get; init; }
    [JsonPropertyName("period")]
    public required SubscriptionPeriodValueIOS Period { get; init; }
    [JsonPropertyName("price")]
    public required double Price { get; init; }
}

public sealed record SubscriptionInfoIOS
{
    [JsonPropertyName("introductoryOffer")]
    public SubscriptionOfferIOS? IntroductoryOffer { get; init; }
    [JsonPropertyName("pricingTerms")]
    public IReadOnlyList<SubscriptionPricingTermsIOS>? PricingTerms { get; init; }
    [JsonPropertyName("promotionalOffers")]
    public IReadOnlyList<SubscriptionOfferIOS>? PromotionalOffers { get; init; }
    [JsonPropertyName("subscriptionGroupId")]
    public required string SubscriptionGroupId { get; init; }
    [JsonPropertyName("subscriptionPeriod")]
    public required SubscriptionPeriodValueIOS SubscriptionPeriod { get; init; }
}

/// <summary>Standardized subscription discount/promotional offer.</summary>
/// <summary>Provides a unified interface for subscription offers across iOS and Android.</summary>
/// <summary></summary>
/// <summary>Both platforms support subscription offers with different implementations:</summary>
/// <summary>- iOS: Introductory offers, promotional offers with server-side signatures</summary>
/// <summary>- Android: Offer tokens with pricing phases</summary>
/// <summary></summary>
/// <summary>@see https://openiap.dev/docs/types/ios#discount-offer</summary>
/// <summary>@see https://openiap.dev/docs/types/android#subscription-offer</summary>
public sealed record SubscriptionOffer
{
    /// <summary>[Android] Base plan identifier.</summary>
    /// <summary>Identifies which base plan this offer belongs to.</summary>
    [JsonPropertyName("basePlanIdAndroid")]
    public string? BasePlanIdAndroid { get; init; }
    /// <summary>Currency code (ISO 4217, e.g., &quot;USD&quot;)</summary>
    [JsonPropertyName("currency")]
    public string? Currency { get; init; }
    /// <summary>Formatted display price string (e.g., &quot;$9.99/month&quot;)</summary>
    [JsonPropertyName("displayPrice")]
    public required string DisplayPrice { get; init; }
    /// <summary>Unique identifier for the offer.</summary>
    /// <summary>- iOS: Discount identifier from App Store Connect</summary>
    /// <summary>- Android: offerId from ProductSubscriptionAndroidOfferDetails</summary>
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    /// <summary>[Android] Installment plan details for this subscription offer.</summary>
    /// <summary>Only set for installment subscription plans; null for non-installment plans.</summary>
    /// <summary>Available in Google Play Billing Library 7.0+</summary>
    [JsonPropertyName("installmentPlanDetailsAndroid")]
    public InstallmentPlanDetailsAndroid? InstallmentPlanDetailsAndroid { get; init; }
    /// <summary>[iOS] Key identifier for signature validation.</summary>
    /// <summary>Used with server-side signature generation for promotional offers.</summary>
    [JsonPropertyName("keyIdentifierIOS")]
    public string? KeyIdentifierIOS { get; init; }
    /// <summary>[iOS] Localized price string.</summary>
    [JsonPropertyName("localizedPriceIOS")]
    public string? LocalizedPriceIOS { get; init; }
    /// <summary>[iOS] Cryptographic nonce (UUID) for signature validation.</summary>
    /// <summary>Must be generated server-side for each purchase attempt.</summary>
    [JsonPropertyName("nonceIOS")]
    public string? NonceIOS { get; init; }
    /// <summary>[iOS] Number of billing periods for this discount.</summary>
    [JsonPropertyName("numberOfPeriodsIOS")]
    public int? NumberOfPeriodsIOS { get; init; }
    /// <summary>[Android] List of tags associated with this offer.</summary>
    [JsonPropertyName("offerTagsAndroid")]
    public IReadOnlyList<string>? OfferTagsAndroid { get; init; }
    /// <summary>[Android] Offer token required for purchase.</summary>
    /// <summary>Must be passed to requestPurchase() when purchasing with this offer.</summary>
    [JsonPropertyName("offerTokenAndroid")]
    public string? OfferTokenAndroid { get; init; }
    /// <summary>Payment mode during the offer period</summary>
    [JsonPropertyName("paymentMode")]
    public PaymentMode? PaymentMode { get; init; }
    /// <summary>Subscription period for this offer</summary>
    [JsonPropertyName("period")]
    public SubscriptionPeriod? Period { get; init; }
    /// <summary>Number of periods the offer applies</summary>
    [JsonPropertyName("periodCount")]
    public int? PeriodCount { get; init; }
    /// <summary>Numeric price value</summary>
    [JsonPropertyName("price")]
    public required double Price { get; init; }
    /// <summary>[Android] Pricing phases for this subscription offer.</summary>
    /// <summary>Contains detailed pricing information for each phase (trial, intro, regular).</summary>
    [JsonPropertyName("pricingPhasesAndroid")]
    public PricingPhasesAndroid? PricingPhasesAndroid { get; init; }
    /// <summary>[iOS] Server-generated signature for promotional offer validation.</summary>
    /// <summary>Required when applying promotional offers on iOS.</summary>
    [JsonPropertyName("signatureIOS")]
    public string? SignatureIOS { get; init; }
    /// <summary>[iOS] Timestamp when the signature was generated.</summary>
    /// <summary>Used for signature validation.</summary>
    [JsonPropertyName("timestampIOS")]
    public double? TimestampIOS { get; init; }
    /// <summary>Type of subscription offer (Introductory or Promotional)</summary>
    [JsonPropertyName("type")]
    public required DiscountOfferType Type { get; init; }
}

/// <summary>iOS subscription offer details.</summary>
/// <summary>@deprecated Use the standardized SubscriptionOffer type instead for cross-platform compatibility.</summary>
/// <summary>@see https://openiap.dev/docs/types#subscription-offer</summary>
public sealed record SubscriptionOfferIOS
{
    [JsonPropertyName("displayPrice")]
    public required string DisplayPrice { get; init; }
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("paymentMode")]
    public required PaymentModeIOS PaymentMode { get; init; }
    [JsonPropertyName("period")]
    public required SubscriptionPeriodValueIOS Period { get; init; }
    [JsonPropertyName("periodCount")]
    public required int PeriodCount { get; init; }
    [JsonPropertyName("price")]
    public required double Price { get; init; }
    [JsonPropertyName("type")]
    public required SubscriptionOfferTypeIOS Type { get; init; }
}

/// <summary>Subscription period value combining unit and count.</summary>
public sealed record SubscriptionPeriod
{
    /// <summary>The period unit (day, week, month, year)</summary>
    [JsonPropertyName("unit")]
    public required SubscriptionPeriodUnit Unit { get; init; }
    /// <summary>The number of units (e.g., 1 for monthly, 3 for quarterly)</summary>
    [JsonPropertyName("value")]
    public required int Value { get; init; }
}

public sealed record SubscriptionPeriodValueIOS
{
    [JsonPropertyName("unit")]
    public required SubscriptionPeriodIOS Unit { get; init; }
    [JsonPropertyName("value")]
    public required int Value { get; init; }
}

public sealed record SubscriptionPricingTermsIOS
{
    [JsonPropertyName("billingDisplayPrice")]
    public required string BillingDisplayPrice { get; init; }
    [JsonPropertyName("billingPeriod")]
    public required SubscriptionPeriodValueIOS BillingPeriod { get; init; }
    [JsonPropertyName("billingPlanType")]
    public required SubscriptionBillingPlanTypeIOS BillingPlanType { get; init; }
    [JsonPropertyName("billingPrice")]
    public required double BillingPrice { get; init; }
    [JsonPropertyName("commitmentInfo")]
    public required SubscriptionCommitmentInfoIOS CommitmentInfo { get; init; }
    [JsonPropertyName("subscriptionOffers")]
    public IReadOnlyList<SubscriptionOffer>? SubscriptionOffers { get; init; }
}

public sealed record SubscriptionStatusIOS
{
    [JsonPropertyName("renewalInfo")]
    public RenewalInfoIOS? RenewalInfo { get; init; }
    [JsonPropertyName("state")]
    public required string State { get; init; }
}

public sealed record TransactionCommitmentInfoIOS
{
    [JsonPropertyName("billingPeriodNumber")]
    public required int BillingPeriodNumber { get; init; }
    [JsonPropertyName("commitmentExpiresDate")]
    public required double CommitmentExpiresDate { get; init; }
    [JsonPropertyName("commitmentPrice")]
    public required double CommitmentPrice { get; init; }
    [JsonPropertyName("totalBillingPeriods")]
    public required int TotalBillingPeriods { get; init; }
}

/// <summary>User Choice Billing event details (Android)</summary>
/// <summary>Fired when a user selects alternative billing in the User Choice Billing dialog</summary>
public sealed record UserChoiceBillingDetails
{
    /// <summary>Token that must be reported to Google Play within 24 hours</summary>
    [JsonPropertyName("externalTransactionToken")]
    public required string ExternalTransactionToken { get; init; }
    /// <summary>List of product IDs selected by the user</summary>
    [JsonPropertyName("products")]
    public required IReadOnlyList<string> Products { get; init; }
}

/// <summary>Valid time window for when an offer is available (Android)</summary>
/// <summary>Available in Google Play Billing Library 7.0+</summary>
public sealed record ValidTimeWindowAndroid
{
    /// <summary>End time in milliseconds since epoch</summary>
    [JsonPropertyName("endTimeMillis")]
    public required string EndTimeMillis { get; init; }
    /// <summary>Start time in milliseconds since epoch</summary>
    [JsonPropertyName("startTimeMillis")]
    public required string StartTimeMillis { get; init; }
}

public sealed record VerifyPurchaseResultAndroid : VerifyPurchaseResult
{
    [JsonPropertyName("autoRenewing")]
    public required bool AutoRenewing { get; init; }
    [JsonPropertyName("betaProduct")]
    public required bool BetaProduct { get; init; }
    [JsonPropertyName("cancelDate")]
    public double? CancelDate { get; init; }
    [JsonPropertyName("cancelReason")]
    public string? CancelReason { get; init; }
    [JsonPropertyName("deferredDate")]
    public double? DeferredDate { get; init; }
    [JsonPropertyName("deferredSku")]
    public string? DeferredSku { get; init; }
    [JsonPropertyName("freeTrialEndDate")]
    public required double FreeTrialEndDate { get; init; }
    [JsonPropertyName("gracePeriodEndDate")]
    public required double GracePeriodEndDate { get; init; }
    [JsonPropertyName("parentProductId")]
    public required string ParentProductId { get; init; }
    [JsonPropertyName("productId")]
    public required string ProductId { get; init; }
    [JsonPropertyName("productType")]
    public required string ProductType { get; init; }
    [JsonPropertyName("purchaseDate")]
    public required double PurchaseDate { get; init; }
    [JsonPropertyName("quantity")]
    public required int Quantity { get; init; }
    [JsonPropertyName("receiptId")]
    public required string ReceiptId { get; init; }
    [JsonPropertyName("renewalDate")]
    public required double RenewalDate { get; init; }
    [JsonPropertyName("term")]
    public required string Term { get; init; }
    [JsonPropertyName("termSku")]
    public required string TermSku { get; init; }
    [JsonPropertyName("testTransaction")]
    public required bool TestTransaction { get; init; }
}

/// <summary>Result from Meta Horizon verify_entitlement API.</summary>
/// <summary>Returns verification status and grant time for the entitlement.</summary>
public sealed record VerifyPurchaseResultHorizon : VerifyPurchaseResult
{
    /// <summary>Unix timestamp (seconds) when the entitlement was granted.</summary>
    [JsonPropertyName("grantTime")]
    public double? GrantTime { get; init; }
    /// <summary>Whether the entitlement verification succeeded.</summary>
    [JsonPropertyName("success")]
    public required bool Success { get; init; }
}

public sealed record VerifyPurchaseResultIOS : VerifyPurchaseResult
{
    /// <summary>Whether the receipt is valid</summary>
    [JsonPropertyName("isValid")]
    public required bool IsValid { get; init; }
    /// <summary>JWS representation</summary>
    [JsonPropertyName("jwsRepresentation")]
    public required string JwsRepresentation { get; init; }
    /// <summary>Latest transaction if available</summary>
    [JsonPropertyName("latestTransaction")]
    public Purchase? LatestTransaction { get; init; }
    /// <summary>Receipt data string</summary>
    [JsonPropertyName("receiptData")]
    public required string ReceiptData { get; init; }
}

public sealed record VerifyPurchaseWithProviderError
{
    [JsonPropertyName("code")]
    public string? Code { get; init; }
    [JsonPropertyName("message")]
    public required string Message { get; init; }
}

public sealed record VerifyPurchaseWithProviderResult
{
    /// <summary>Error details if verification failed</summary>
    [JsonPropertyName("errors")]
    public IReadOnlyList<VerifyPurchaseWithProviderError>? Errors { get; init; }
    /// <summary>IAPKit verification result</summary>
    [JsonPropertyName("iapkit")]
    public RequestVerifyPurchaseWithIapkitResult? Iapkit { get; init; }
    [JsonPropertyName("provider")]
    public required PurchaseVerificationProvider Provider { get; init; }
}

public readonly record struct VoidResult;

public sealed record WebhookEvent
{
    /// <summary>Reason for cancellation, when applicable.</summary>
    [JsonPropertyName("cancellationReason")]
    public WebhookCancellationReason? CancellationReason { get; init; }
    /// <summary>Localized currency code (ISO 4217) at event time, when available.</summary>
    [JsonPropertyName("currency")]
    public string? Currency { get; init; }
    [JsonPropertyName("environment")]
    public required WebhookEventEnvironment Environment { get; init; }
    /// <summary>When the current subscription period ends. Epoch milliseconds.</summary>
    [JsonPropertyName("expiresAt")]
    public double? ExpiresAt { get; init; }
    /// <summary>Stable identifier suitable for idempotency. Derived from the source notification</summary>
    /// <summary>UUID where the store provides one (ASN v2 `notificationUUID`, RTDN message id);</summary>
    /// <summary>otherwise hashed from the canonicalized payload.</summary>
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    /// <summary>Time the underlying event occurred at the store. Epoch milliseconds.</summary>
    [JsonPropertyName("occurredAt")]
    public required double OccurredAt { get; init; }
    [JsonPropertyName("platform")]
    public required IapPlatform Platform { get; init; }
    /// <summary>Price in micros (1/1,000,000 of the currency unit) at event time, when available.</summary>
    /// <summary>Matches Google Play&apos;s `priceAmountMicros` convention; iOS values are converted.</summary>
    [JsonPropertyName("priceAmountMicros")]
    public double? PriceAmountMicros { get; init; }
    /// <summary>Product the event pertains to. May be null for account-level events.</summary>
    [JsonPropertyName("productId")]
    public string? ProductId { get; init; }
    /// <summary>kit project that owns the subscription / purchase this event refers to.</summary>
    [JsonPropertyName("projectId")]
    public required string ProjectId { get; init; }
    /// <summary>Cross-platform purchase identity used to correlate this event with an existing</summary>
    /// <summary>purchase record. iOS: `originalTransactionId`. Android: `purchaseToken`.</summary>
    /// <summary>Null for `TestNotification` events (Apple ASN v2 / Google RTDN test</summary>
    /// <summary>payloads carry no transaction); always present for every other event type.</summary>
    [JsonPropertyName("purchaseToken")]
    public string? PurchaseToken { get; init; }
    /// <summary>Original signed payload from the store. ASN v2 events expose the JWS string;</summary>
    /// <summary>RTDN events expose the base64-decoded Pub/Sub message JSON. Provided so that</summary>
    /// <summary>consumers can independently verify or extract platform-specific fields. kit</summary>
    /// <summary>always validates this payload before emitting the event.</summary>
    [JsonPropertyName("rawSignedPayload")]
    public string? RawSignedPayload { get; init; }
    /// <summary>Time kit ingested and normalized this event. Epoch milliseconds.</summary>
    [JsonPropertyName("receivedAt")]
    public required double ReceivedAt { get; init; }
    /// <summary>When auto-renewal will charge again. Epoch milliseconds.</summary>
    [JsonPropertyName("renewsAt")]
    public double? RenewsAt { get; init; }
    [JsonPropertyName("source")]
    public required WebhookEventSource Source { get; init; }
    /// <summary>Normalized subscription state at the time of event, when the event refers to</summary>
    /// <summary>a subscription. Null for one-time purchase events.</summary>
    [JsonPropertyName("subscriptionState")]
    public SubscriptionState? SubscriptionState { get; init; }
    [JsonPropertyName("type")]
    public required WebhookEventType Type { get; init; }
}

// ============================================================================
// Input Objects
// ============================================================================

public sealed record AndroidSubscriptionOfferInput
{
    /// <summary>Product SKU</summary>
    [JsonPropertyName("sku")]
    public required string Sku { get; init; }
    /// <summary>Offer token</summary>
    [JsonPropertyName("offerToken")]
    public required string OfferToken { get; init; }
}

public sealed record DeepLinkOptions
{
    /// <summary>Android SKU to open (required on Android)</summary>
    [JsonPropertyName("skuAndroid")]
    public string? SkuAndroid { get; init; }
    /// <summary>Android package name to target (required on Android)</summary>
    [JsonPropertyName("packageNameAndroid")]
    public string? PackageNameAndroid { get; init; }
}

/// <summary>Parameters for developer billing option in purchase flow (Android)</summary>
/// <summary>Used with BillingFlowParams to enable external payments flow</summary>
/// <summary>Available in Google Play Billing Library 8.3.0+</summary>
public sealed record DeveloperBillingOptionParamsAndroid
{
    /// <summary>The billing program (should be EXTERNAL_PAYMENTS for external payments flow)</summary>
    [JsonPropertyName("billingProgram")]
    public required BillingProgramAndroid BillingProgram { get; init; }
    /// <summary>The URI where the external payment will be processed</summary>
    [JsonPropertyName("linkUri")]
    public required string LinkUri { get; init; }
    /// <summary>The launch mode for the external payment link</summary>
    [JsonPropertyName("launchMode")]
    public required DeveloperBillingLaunchModeAndroid LaunchMode { get; init; }
}

public sealed record DiscountOfferInputIOS
{
    /// <summary>Discount identifier</summary>
    [JsonPropertyName("identifier")]
    public required string Identifier { get; init; }
    /// <summary>Key identifier for validation</summary>
    [JsonPropertyName("keyIdentifier")]
    public required string KeyIdentifier { get; init; }
    /// <summary>Cryptographic nonce</summary>
    [JsonPropertyName("nonce")]
    public required string Nonce { get; init; }
    /// <summary>Signature for validation</summary>
    [JsonPropertyName("signature")]
    public required string Signature { get; init; }
    /// <summary>Timestamp of discount offer</summary>
    [JsonPropertyName("timestamp")]
    public required double Timestamp { get; init; }
}

/// <summary>Connection initialization configuration</summary>
public sealed record InitConnectionConfig
{
    /// <summary>Alternative billing mode for Android</summary>
    /// <summary>If not specified, defaults to NONE (standard Google Play billing)</summary>
    /// <summary>@deprecated Use enableBillingProgramAndroid instead.</summary>
    /// <summary>Use USER_CHOICE_BILLING for user choice billing, EXTERNAL_OFFER for alternative only.</summary>
    [JsonPropertyName("alternativeBillingModeAndroid")]
    public AlternativeBillingModeAndroid? AlternativeBillingModeAndroid { get; init; }
    /// <summary>Enable a specific billing program for Android (7.0+)</summary>
    /// <summary>When set, enables the specified billing program for external transactions.</summary>
    /// <summary>- USER_CHOICE_BILLING: User can select between Google Play or alternative (7.0+)</summary>
    /// <summary>- EXTERNAL_CONTENT_LINK: Link to external content (8.2.0+)</summary>
    /// <summary>- EXTERNAL_OFFER: External offers for digital content (8.2.0+)</summary>
    /// <summary>- EXTERNAL_PAYMENTS: Developer provided billing, Japan only (8.3.0+)</summary>
    [JsonPropertyName("enableBillingProgramAndroid")]
    public BillingProgramAndroid? EnableBillingProgramAndroid { get; init; }
}

/// <summary>Parameters for launching an external link (Android)</summary>
/// <summary>Used with launchExternalLink to initiate external offer or app install flows</summary>
/// <summary>Available in Google Play Billing Library 8.2.0+</summary>
public sealed record LaunchExternalLinkParamsAndroid
{
    /// <summary>The billing program (EXTERNAL_CONTENT_LINK or EXTERNAL_OFFER)</summary>
    [JsonPropertyName("billingProgram")]
    public required BillingProgramAndroid BillingProgram { get; init; }
    /// <summary>The external link launch mode</summary>
    [JsonPropertyName("launchMode")]
    public required ExternalLinkLaunchModeAndroid LaunchMode { get; init; }
    /// <summary>The type of the external link</summary>
    [JsonPropertyName("linkType")]
    public required ExternalLinkTypeAndroid LinkType { get; init; }
    /// <summary>The URI where the content will be accessed from</summary>
    [JsonPropertyName("linkUri")]
    public required string LinkUri { get; init; }
}

public sealed record ProductRequest
{
    [JsonPropertyName("skus")]
    public required IReadOnlyList<string> Skus { get; init; }
    [JsonPropertyName("type")]
    public ProductQueryType? Type { get; init; }
}

/// <summary>JWS promotional offer input for iOS 15+ (StoreKit 2, WWDC 2025).</summary>
/// <summary>New signature format using compact JWS string for promotional offers.</summary>
/// <summary>This provides a simpler alternative to the legacy signature-based promotional offers.</summary>
/// <summary>Back-deployed to iOS 15.</summary>
public sealed record PromotionalOfferJWSInputIOS
{
    /// <summary>The promotional offer identifier from App Store Connect</summary>
    [JsonPropertyName("offerId")]
    public required string OfferId { get; init; }
    /// <summary>Compact JWS string signed by your server.</summary>
    /// <summary>The JWS should contain the promotional offer signature data.</summary>
    /// <summary>Format: header.payload.signature (base64url encoded)</summary>
    [JsonPropertyName("jws")]
    public required string Jws { get; init; }
}

// PurchaseInput is structurally a Purchase; consumers should pass a
// Purchase instance directly. Kept as a typedef-style alias record.
public sealed record PurchaseInput(Purchase Value);

public sealed record PurchaseOptions
{
    /// <summary>Also emit results through the iOS event listeners</summary>
    [JsonPropertyName("alsoPublishToEventListenerIOS")]
    public bool? AlsoPublishToEventListenerIOS { get; init; }
    /// <summary>Limit to currently active items on iOS</summary>
    [JsonPropertyName("onlyIncludeActiveItemsIOS")]
    public bool? OnlyIncludeActiveItemsIOS { get; init; }
    /// <summary>Include suspended subscriptions in the result (Android 8.1+).</summary>
    /// <summary>Suspended subscriptions have isSuspendedAndroid=true and should NOT be granted entitlements.</summary>
    /// <summary>Users should be directed to the subscription center to resolve payment issues.</summary>
    /// <summary>Default: false (only active subscriptions are returned)</summary>
    [JsonPropertyName("includeSuspendedAndroid")]
    public bool? IncludeSuspendedAndroid { get; init; }
}

public sealed record PurchaseUpdatedListenerOptions
{
    /// <summary>iOS only. Defaults to true. When false, listener callbacks also receive</summary>
    /// <summary>StoreKit replay events for a transaction ID that was already emitted during</summary>
    /// <summary>the current connection session. Android ignores this option.</summary>
    [JsonPropertyName("dedupeTransactionIOS")]
    public bool? DedupeTransactionIOS { get; init; }
}

public sealed record RequestPurchaseAndroidProps
{
    /// <summary>List of product SKUs</summary>
    [JsonPropertyName("skus")]
    public required IReadOnlyList<string> Skus { get; init; }
    /// <summary>Obfuscated account ID</summary>
    [JsonPropertyName("obfuscatedAccountId")]
    public string? ObfuscatedAccountId { get; init; }
    /// <summary>Obfuscated profile ID</summary>
    [JsonPropertyName("obfuscatedProfileId")]
    public string? ObfuscatedProfileId { get; init; }
    /// <summary>Personalized offer flag.</summary>
    /// <summary>When true, indicates the price was customized for this user.</summary>
    [JsonPropertyName("isOfferPersonalized")]
    public bool? IsOfferPersonalized { get; init; }
    /// <summary>Offer token for one-time purchase discounts (7.0+).</summary>
    /// <summary>Pass the offerToken from oneTimePurchaseOfferDetailsAndroid or discountOffers</summary>
    /// <summary>to apply a discount offer to the purchase.</summary>
    [JsonPropertyName("offerToken")]
    public string? OfferToken { get; init; }
    /// <summary>Developer billing option parameters for external payments flow (8.3.0+).</summary>
    /// <summary>When provided, the purchase flow will show a side-by-side choice between</summary>
    /// <summary>Google Play Billing and the developer&apos;s external payment option.</summary>
    [JsonPropertyName("developerBillingOption")]
    public DeveloperBillingOptionParamsAndroid? DeveloperBillingOption { get; init; }
}

public sealed record RequestPurchaseIosProps
{
    /// <summary>Product SKU</summary>
    [JsonPropertyName("sku")]
    public required string Sku { get; init; }
    /// <summary>Auto-finish transaction (dangerous)</summary>
    [JsonPropertyName("andDangerouslyFinishTransactionAutomatically")]
    public bool? AndDangerouslyFinishTransactionAutomatically { get; init; }
    /// <summary>App account token for user tracking</summary>
    [JsonPropertyName("appAccountToken")]
    public string? AppAccountToken { get; init; }
    /// <summary>Purchase quantity</summary>
    [JsonPropertyName("quantity")]
    public int? Quantity { get; init; }
    /// <summary>Promotional offer to apply (subscriptions only, ignored for one-time purchases).</summary>
    /// <summary>iOS only supports promotional offers for auto-renewable subscriptions.</summary>
    [JsonPropertyName("withOffer")]
    public DiscountOfferInputIOS? WithOffer { get; init; }
    /// <summary>Advanced commerce data token (iOS 15+).</summary>
    /// <summary>Used with StoreKit 2&apos;s Product.PurchaseOption.custom API for passing</summary>
    /// <summary>campaign tokens, affiliate IDs, or other attribution data.</summary>
    /// <summary>The data is formatted as JSON: {&quot;signatureInfo&quot;: {&quot;token&quot;: &quot;&lt;value&gt;&quot;}}</summary>
    [JsonPropertyName("advancedCommerceData")]
    public string? AdvancedCommerceData { get; init; }
}

public sealed record RequestPurchaseProps
{
    [JsonPropertyName("requestPurchase")]
    public RequestPurchasePropsByPlatforms? RequestPurchase { get; init; }

    [JsonPropertyName("requestSubscription")]
    public RequestSubscriptionPropsByPlatforms? RequestSubscription { get; init; }

    [JsonPropertyName("type")]
    public required ProductQueryType Type { get; init; }

    [JsonPropertyName("useAlternativeBilling")]
    public bool? UseAlternativeBilling { get; init; }
}

/// <summary>Platform-specific purchase request parameters.</summary>
/// <summary></summary>
/// <summary>Note: &quot;Platforms&quot; refers to the SDK/OS level (apple, google), not the store.</summary>
/// <summary>- apple: Always targets App Store</summary>
/// <summary>- google: Targets Play Store by default, Horizon when built with horizon flavor,</summary>
/// <summary>  or Fire OS when built with amazon flavor</summary>
/// <summary>  (determined at build time, not runtime)</summary>
public sealed record RequestPurchasePropsByPlatforms
{
    /// <summary>Apple-specific purchase parameters</summary>
    [JsonPropertyName("apple")]
    public RequestPurchaseIosProps? Apple { get; init; }
    /// <summary>Google-specific purchase parameters</summary>
    [JsonPropertyName("google")]
    public RequestPurchaseAndroidProps? Google { get; init; }
    /// <summary>@deprecated Use apple instead</summary>
    [JsonPropertyName("ios")]
    public RequestPurchaseIosProps? IOS { get; init; }
    /// <summary>@deprecated Use google instead</summary>
    [JsonPropertyName("android")]
    public RequestPurchaseAndroidProps? Android { get; init; }
}

public sealed record RequestSubscriptionAndroidProps
{
    /// <summary>List of subscription SKUs</summary>
    [JsonPropertyName("skus")]
    public required IReadOnlyList<string> Skus { get; init; }
    /// <summary>Obfuscated account ID</summary>
    [JsonPropertyName("obfuscatedAccountId")]
    public string? ObfuscatedAccountId { get; init; }
    /// <summary>Obfuscated profile ID</summary>
    [JsonPropertyName("obfuscatedProfileId")]
    public string? ObfuscatedProfileId { get; init; }
    /// <summary>Personalized offer flag.</summary>
    /// <summary>When true, indicates the price was customized for this user.</summary>
    [JsonPropertyName("isOfferPersonalized")]
    public bool? IsOfferPersonalized { get; init; }
    /// <summary>Purchase token for upgrades/downgrades</summary>
    [JsonPropertyName("purchaseToken")]
    public string? PurchaseToken { get; init; }
    /// <summary>Replacement mode for subscription changes</summary>
    /// <summary>@deprecated Use subscriptionProductReplacementParams instead for item-level replacement (8.1.0+)</summary>
    [JsonPropertyName("replacementMode")]
    public int? ReplacementMode { get; init; }
    /// <summary>Subscription offers</summary>
    [JsonPropertyName("subscriptionOffers")]
    public IReadOnlyList<AndroidSubscriptionOfferInput>? SubscriptionOffers { get; init; }
    /// <summary>Product-level replacement parameters (8.1.0+)</summary>
    /// <summary>Use this instead of replacementMode for item-level replacement</summary>
    [JsonPropertyName("subscriptionProductReplacementParams")]
    public SubscriptionProductReplacementParamsAndroid? SubscriptionProductReplacementParams { get; init; }
    /// <summary>Developer billing option parameters for external payments flow (8.3.0+).</summary>
    /// <summary>When provided, the purchase flow will show a side-by-side choice between</summary>
    /// <summary>Google Play Billing and the developer&apos;s external payment option.</summary>
    [JsonPropertyName("developerBillingOption")]
    public DeveloperBillingOptionParamsAndroid? DeveloperBillingOption { get; init; }
}

public sealed record RequestSubscriptionIosProps
{
    [JsonPropertyName("sku")]
    public required string Sku { get; init; }
    [JsonPropertyName("andDangerouslyFinishTransactionAutomatically")]
    public bool? AndDangerouslyFinishTransactionAutomatically { get; init; }
    [JsonPropertyName("appAccountToken")]
    public string? AppAccountToken { get; init; }
    [JsonPropertyName("quantity")]
    public int? Quantity { get; init; }
    /// <summary>Promotional offer to apply for subscription purchases.</summary>
    /// <summary>Requires server-signed offer with nonce, timestamp, keyId, and signature.</summary>
    [JsonPropertyName("withOffer")]
    public DiscountOfferInputIOS? WithOffer { get; init; }
    /// <summary>Win-back offer to apply (iOS 18+)</summary>
    /// <summary>Used to re-engage churned subscribers with a discount or free trial.</summary>
    /// <summary>The offer is available when the customer is eligible and can be discovered</summary>
    /// <summary>via StoreKit Message (automatic) or subscription offer APIs.</summary>
    [JsonPropertyName("winBackOffer")]
    public WinBackOfferInputIOS? WinBackOffer { get; init; }
    /// <summary>JWS promotional offer (iOS 15+, WWDC 2025).</summary>
    /// <summary>New signature format using compact JWS string for promotional offers.</summary>
    /// <summary>Back-deployed to iOS 15.</summary>
    [JsonPropertyName("promotionalOfferJWS")]
    public PromotionalOfferJWSInputIOS? PromotionalOfferJws { get; init; }
    /// <summary>Billing plan to use when purchasing an annual subscription that offers</summary>
    /// <summary>monthly billing with a 12-month commitment (iOS 26.4+).</summary>
    [JsonPropertyName("billingPlanType")]
    public SubscriptionBillingPlanTypeIOS? BillingPlanType { get; init; }
    /// <summary>Compact JWS string for overriding introductory offer eligibility</summary>
    /// <summary>(iOS 15+, WWDC 2025). When nil, the system determines eligibility.</summary>
    /// <summary>Generate the JWS on your server and pass it to StoreKit&apos;s</summary>
    /// <summary>introductoryOfferEligibility(compactJWS:) purchase option.</summary>
    [JsonPropertyName("compactJWS")]
    public string? CompactJws { get; init; }
    /// <summary>Advanced commerce data token (iOS 15+).</summary>
    /// <summary>Used with StoreKit 2&apos;s Product.PurchaseOption.custom API for passing</summary>
    /// <summary>campaign tokens, affiliate IDs, or other attribution data.</summary>
    /// <summary>The data is formatted as JSON: {&quot;signatureInfo&quot;: {&quot;token&quot;: &quot;&lt;value&gt;&quot;}}</summary>
    [JsonPropertyName("advancedCommerceData")]
    public string? AdvancedCommerceData { get; init; }
}

/// <summary>Platform-specific subscription request parameters.</summary>
/// <summary></summary>
/// <summary>Note: &quot;Platforms&quot; refers to the SDK/OS level (apple, google), not the store.</summary>
/// <summary>- apple: Always targets App Store</summary>
/// <summary>- google: Targets Play Store by default, Horizon when built with horizon flavor,</summary>
/// <summary>  or Fire OS when built with amazon flavor</summary>
/// <summary>  (determined at build time, not runtime)</summary>
public sealed record RequestSubscriptionPropsByPlatforms
{
    /// <summary>Apple-specific subscription parameters</summary>
    [JsonPropertyName("apple")]
    public RequestSubscriptionIosProps? Apple { get; init; }
    /// <summary>Google-specific subscription parameters</summary>
    [JsonPropertyName("google")]
    public RequestSubscriptionAndroidProps? Google { get; init; }
    /// <summary>@deprecated Use apple instead</summary>
    [JsonPropertyName("ios")]
    public RequestSubscriptionIosProps? IOS { get; init; }
    /// <summary>@deprecated Use google instead</summary>
    [JsonPropertyName("android")]
    public RequestSubscriptionAndroidProps? Android { get; init; }
}

public sealed record RequestVerifyPurchaseWithIapkitAmazonProps
{
    /// <summary>Amazon Appstore user id returned by PurchaseResponse.getUserData().getUserId().</summary>
    [JsonPropertyName("userId")]
    public string? UserId { get; init; }
    /// <summary>Amazon Appstore receipt id returned by PurchaseResponse.getReceipt().getReceiptId().</summary>
    [JsonPropertyName("receiptId")]
    public required string ReceiptId { get; init; }
    /// <summary>Use Amazon RVS Cloud Sandbox for App Tester receipts.</summary>
    [JsonPropertyName("sandbox")]
    public bool? Sandbox { get; init; }
}

public sealed record RequestVerifyPurchaseWithIapkitAppleProps
{
    /// <summary>The JWS token returned with the purchase response.</summary>
    [JsonPropertyName("jws")]
    public required string Jws { get; init; }
}

public sealed record RequestVerifyPurchaseWithIapkitGoogleProps
{
    /// <summary>The token provided to the user&apos;s device when the product or subscription was purchased.</summary>
    [JsonPropertyName("purchaseToken")]
    public required string PurchaseToken { get; init; }
}

/// <summary>Platform-specific verification parameters for IAPKit.</summary>
/// <summary></summary>
/// <summary>- apple: Verifies via App Store (JWS token)</summary>
/// <summary>- google: Verifies via Play Store (purchase token)</summary>
/// <summary>- amazon: Verifies via Amazon Appstore RVS (userId + receiptId)</summary>
public sealed record RequestVerifyPurchaseWithIapkitProps
{
    /// <summary>API key used for the Authorization header (Bearer {apiKey}).</summary>
    [JsonPropertyName("apiKey")]
    public string? ApiKey { get; init; }
    /// <summary>Apple App Store verification parameters.</summary>
    [JsonPropertyName("apple")]
    public RequestVerifyPurchaseWithIapkitAppleProps? Apple { get; init; }
    /// <summary>Google Play Store verification parameters.</summary>
    [JsonPropertyName("google")]
    public RequestVerifyPurchaseWithIapkitGoogleProps? Google { get; init; }
    /// <summary>Amazon Appstore verification parameters.</summary>
    [JsonPropertyName("amazon")]
    public RequestVerifyPurchaseWithIapkitAmazonProps? Amazon { get; init; }
}

/// <summary>Product-level subscription replacement parameters (Android)</summary>
/// <summary>Used with setSubscriptionProductReplacementParams in BillingFlowParams.ProductDetailsParams</summary>
/// <summary>Available in Google Play Billing Library 8.1.0+</summary>
public sealed record SubscriptionProductReplacementParamsAndroid
{
    /// <summary>The old product ID that needs to be replaced</summary>
    [JsonPropertyName("oldProductId")]
    public required string OldProductId { get; init; }
    /// <summary>The replacement mode for this product change</summary>
    [JsonPropertyName("replacementMode")]
    public required SubscriptionReplacementModeAndroid ReplacementMode { get; init; }
}

/// <summary>Apple App Store verification parameters.</summary>
/// <summary>Used for server-side receipt validation via App Store Server API.</summary>
public sealed record VerifyPurchaseAppleOptions
{
    /// <summary>Product SKU to validate</summary>
    [JsonPropertyName("sku")]
    public required string Sku { get; init; }
}

/// <summary>Google Play Store verification parameters.</summary>
/// <summary>Used for server-side receipt validation via Google Play Developer API.</summary>
/// <summary></summary>
/// <summary>⚠️ SECURITY: Contains sensitive tokens (accessToken, purchaseToken). Do not log or persist this data.</summary>
public sealed record VerifyPurchaseGoogleOptions
{
    /// <summary>Product SKU to validate</summary>
    [JsonPropertyName("sku")]
    public required string Sku { get; init; }
    /// <summary>Android package name (e.g., com.example.app)</summary>
    [JsonPropertyName("packageName")]
    public required string PackageName { get; init; }
    /// <summary>Purchase token from the purchase response.</summary>
    /// <summary>⚠️ Sensitive: Do not log this value.</summary>
    [JsonPropertyName("purchaseToken")]
    public required string PurchaseToken { get; init; }
    /// <summary>Google OAuth2 access token for API authentication.</summary>
    /// <summary>⚠️ Sensitive: Do not log this value.</summary>
    [JsonPropertyName("accessToken")]
    public required string AccessToken { get; init; }
    /// <summary>Whether this is a subscription purchase (affects API endpoint used)</summary>
    [JsonPropertyName("isSub")]
    public bool? IsSub { get; init; }
}

/// <summary>Meta Horizon (Quest) verification parameters.</summary>
/// <summary>Used for server-side entitlement verification via Meta&apos;s S2S API.</summary>
/// <summary>POST https://graph.oculus.com/$APP_ID/verify_entitlement</summary>
/// <summary></summary>
/// <summary>⚠️ SECURITY: Contains sensitive token (accessToken). Do not log or persist this data.</summary>
public sealed record VerifyPurchaseHorizonOptions
{
    /// <summary>The SKU for the add-on item, defined in Meta Developer Dashboard</summary>
    [JsonPropertyName("sku")]
    public required string Sku { get; init; }
    /// <summary>The user ID of the user whose purchase you want to verify</summary>
    [JsonPropertyName("userId")]
    public required string UserId { get; init; }
    /// <summary>Access token for Meta API authentication (OC|$APP_ID|$APP_SECRET or User Access Token).</summary>
    /// <summary>⚠️ Sensitive: Do not log this value.</summary>
    [JsonPropertyName("accessToken")]
    public required string AccessToken { get; init; }
}

/// <summary>Platform-specific purchase verification parameters.</summary>
/// <summary></summary>
/// <summary>- apple: Verifies via App Store Server API</summary>
/// <summary>- google: Verifies via Google Play Developer API</summary>
/// <summary>- horizon: Verifies via Meta&apos;s S2S API (verify_entitlement endpoint)</summary>
public sealed record VerifyPurchaseProps
{
    /// <summary>Apple App Store verification parameters.</summary>
    [JsonPropertyName("apple")]
    public VerifyPurchaseAppleOptions? Apple { get; init; }
    /// <summary>Google Play Store verification parameters.</summary>
    [JsonPropertyName("google")]
    public VerifyPurchaseGoogleOptions? Google { get; init; }
    /// <summary>Meta Horizon (Quest) verification parameters.</summary>
    [JsonPropertyName("horizon")]
    public VerifyPurchaseHorizonOptions? Horizon { get; init; }
}

public sealed record VerifyPurchaseWithProviderProps
{
    [JsonPropertyName("provider")]
    public required PurchaseVerificationProvider Provider { get; init; }
    [JsonPropertyName("iapkit")]
    public RequestVerifyPurchaseWithIapkitProps? Iapkit { get; init; }
}

/// <summary>Win-back offer input for iOS 18+ (StoreKit 2)</summary>
/// <summary>Win-back offers are used to re-engage churned subscribers.</summary>
/// <summary>The offer is automatically presented via StoreKit Message when eligible,</summary>
/// <summary>or can be applied programmatically during purchase.</summary>
public sealed record WinBackOfferInputIOS
{
    /// <summary>The win-back offer ID from App Store Connect</summary>
    [JsonPropertyName("offerId")]
    public required string OfferId { get; init; }
}

// ============================================================================
// Root Operations
// ============================================================================

/// <summary>GraphQL root mutation operations.</summary>
public interface MutationResolver
{
    /// <summary>Acknowledge a non-consumable purchase. Required within 3 days or Google auto-refunds.</summary>
    /// <summary>See: https://openiap.dev/docs/apis/android/acknowledge-purchase-android</summary>
    Task<bool> AcknowledgePurchaseAndroidAsync(string purchaseToken);

    /// <summary>Present the refund request sheet (iOS 15+). See also Features → Refund.</summary>
    /// <summary>See: https://openiap.dev/docs/apis/ios/begin-refund-request-ios</summary>
    Task<string?> BeginRefundRequestIOSAsync(string sku);

    /// <summary>Check whether alternative billing is available for the user. Step 1 of the alternative billing flow.</summary>
    /// <summary></summary>
    /// <summary>Returns true if available, false otherwise.</summary>
    /// <summary>Throws OpenIapError.NotPrepared if billing client not ready.</summary>
    /// <summary>See: https://openiap.dev/docs/apis/android/check-alternative-billing-availability-android</summary>
    Task<bool> CheckAlternativeBillingAvailabilityAndroidAsync();

    /// <summary>Clear pending transactions in the queue (sandbox helper).</summary>
    /// <summary>See: https://openiap.dev/docs/apis/ios/clear-transaction-ios</summary>
    Task<bool> ClearTransactionIOSAsync();

    /// <summary>Consume a consumable purchase so it can be re-bought.</summary>
    /// <summary>See: https://openiap.dev/docs/apis/android/consume-purchase-android</summary>
    Task<bool> ConsumePurchaseAndroidAsync(string purchaseToken);

    /// <summary>Create a reporting token for an alternative billing flow. Step 3 of the alternative billing flow.</summary>
    /// <summary>Must be called AFTER successful payment in your payment system.</summary>
    /// <summary>Token must be reported to Google Play backend within 24 hours.</summary>
    /// <summary></summary>
    /// <summary>Returns token string, or null if creation failed.</summary>
    /// <summary>Throws OpenIapError.NotPrepared if billing client not ready.</summary>
    /// <summary>See: https://openiap.dev/docs/apis/android/create-alternative-billing-token-android</summary>
    Task<string?> CreateAlternativeBillingTokenAndroidAsync();

    /// <summary>Create the reporting payload Google requires after a Developer-Provided Billing transaction (Play Billing 8.3.0+).</summary>
    /// <summary>Replaces the deprecated createExternalOfferReportingDetailsAsync API.</summary>
    /// <summary></summary>
    /// <summary>Returns external transaction token needed for reporting external transactions.</summary>
    /// <summary>Throws OpenIapError.NotPrepared if billing client not ready.</summary>
    /// <summary>See: https://openiap.dev/docs/apis/android/create-billing-program-reporting-details-android</summary>
    Task<BillingProgramReportingDetailsAndroid> CreateBillingProgramReportingDetailsAndroidAsync(BillingProgramAndroid program);

    /// <summary>Open the platform&apos;s subscription management UI.</summary>
    /// <summary>See: https://openiap.dev/docs/apis/deep-link-to-subscriptions</summary>
    Task<string> DeepLinkToSubscriptionsAsync(DeepLinkOptions? options = null);

    /// <summary>Close the store connection and release resources.</summary>
    /// <summary>See: https://openiap.dev/docs/apis/end-connection</summary>
    Task<bool> EndConnectionAsync();

    /// <summary>Complete a transaction after server-side verification. Required on Android within 3 days.</summary>
    /// <summary>See: https://openiap.dev/docs/apis/finish-transaction</summary>
    Task<string> FinishTransactionAsync(PurchaseInput purchase, bool? isConsumable = null);

    /// <summary>Initialize the store connection. Call before any IAP API.</summary>
    /// <summary>See: https://openiap.dev/docs/apis/init-connection</summary>
    Task<bool> InitConnectionAsync(InitConnectionConfig? config = null);

    /// <summary>Check whether a billing program (e.g., External Payments) is available for the current user.</summary>
    /// <summary>Replaces the deprecated isExternalOfferAvailableAsync API.</summary>
    /// <summary></summary>
    /// <summary>Available in Google Play Billing Library 8.2.0+.</summary>
    /// <summary>Returns availability result with isAvailable flag.</summary>
    /// <summary>Throws OpenIapError.NotPrepared if billing client not ready.</summary>
    /// <summary>See: https://openiap.dev/docs/apis/android/is-billing-program-available-android</summary>
    Task<BillingProgramAvailabilityResultAndroid> IsBillingProgramAvailableAndroidAsync(BillingProgramAndroid program);

    /// <summary>Launch an external content/offer link from inside the Billing Programs flow (Play Billing 8.2.0+).</summary>
    /// <summary>Replaces the deprecated showExternalOfferInformationDialog API.</summary>
    /// <summary></summary>
    /// <summary>Shows Play Store dialog and optionally launches external URL.</summary>
    /// <summary>Throws OpenIapError.NotPrepared if billing client not ready.</summary>
    /// <summary>See: https://openiap.dev/docs/apis/android/launch-external-link-android</summary>
    Task<bool> LaunchExternalLinkAndroidAsync(LaunchExternalLinkParamsAndroid @params);

    /// <summary>Show the App Store offer code redemption sheet.</summary>
    /// <summary>See: https://openiap.dev/docs/apis/ios/present-code-redemption-sheet-ios</summary>
    Task<bool> PresentCodeRedemptionSheetIOSAsync();

    /// <summary>Present an external purchase link, StoreKit External (iOS 16+).</summary>
    /// <summary>See: https://openiap.dev/docs/apis/ios/present-external-purchase-link-ios</summary>
    Task<ExternalPurchaseLinkResultIOS> PresentExternalPurchaseLinkIOSAsync(string url);

    /// <summary>Present the external purchase notice sheet (iOS 17.4+).</summary>
    /// <summary>Uses ExternalPurchase.presentNoticeSheet() which returns a token when the user continues.</summary>
    /// <summary>Reference: https://developer.apple.com/documentation/storekit/externalpurchase/presentnoticesheet()</summary>
    /// <summary>See: https://openiap.dev/docs/apis/ios/present-external-purchase-notice-sheet-ios</summary>
    Task<ExternalPurchaseNoticeResultIOS> PresentExternalPurchaseNoticeSheetIOSAsync();

    /// <summary>Initiate a purchase or subscription flow; rely on events for final state.</summary>
    /// <summary>See: https://openiap.dev/docs/apis/request-purchase</summary>
    Task<RequestPurchaseResult?> RequestPurchaseAsync(RequestPurchaseProps @params);

    /// <summary>Buy the currently promoted product.</summary>
    /// <summary></summary>
    /// <summary>@deprecated Use promotedProductListenerIOS to receive the productId,</summary>
    /// <summary>then call requestPurchase with that SKU instead. In StoreKit 2,</summary>
    /// <summary>promoted products can be purchased directly via the standard purchase flow.</summary>
    /// <summary>See: https://openiap.dev/docs/apis/ios/request-purchase-on-promoted-product-ios</summary>
    Task<bool> RequestPurchaseOnPromotedProductIOSAsync();

    /// <summary>Restore non-consumable and active subscription purchases.</summary>
    /// <summary>See: https://openiap.dev/docs/apis/restore-purchases</summary>
    Task<string> RestorePurchasesAsync();

    /// <summary>Display Google&apos;s alternative billing information dialog. Step 2 of the alternative billing flow.</summary>
    /// <summary>Must be called BEFORE processing payment in your payment system.</summary>
    /// <summary></summary>
    /// <summary>Returns true if user accepted, false if user canceled.</summary>
    /// <summary>Throws OpenIapError.NotPrepared if billing client not ready.</summary>
    /// <summary>See: https://openiap.dev/docs/apis/android/show-alternative-billing-dialog-android</summary>
    Task<bool> ShowAlternativeBillingDialogAndroidAsync();

    /// <summary>Present the disclosure sheet required before linking out via ExternalPurchaseCustomLink (iOS 18.1+).</summary>
    /// <summary>Call this after a deliberate customer interaction before linking out to external purchases.</summary>
    /// <summary>Reference: https://developer.apple.com/documentation/storekit/externalpurchasecustomlink/shownotice(type:)</summary>
    /// <summary>See: https://openiap.dev/docs/apis/ios/show-external-purchase-custom-link-notice-ios</summary>
    Task<ExternalPurchaseCustomLinkNoticeResultIOS> ShowExternalPurchaseCustomLinkNoticeIOSAsync(ExternalPurchaseCustomLinkNoticeTypeIOS noticeType);

    /// <summary>Present the manage-subscriptions sheet and return changed purchases (iOS 15+).</summary>
    /// <summary>See: https://openiap.dev/docs/apis/ios/show-manage-subscriptions-ios</summary>
    Task<IReadOnlyList<PurchaseIOS>> ShowManageSubscriptionsIOSAsync();

    /// <summary>Force sync transactions with the App Store (iOS 15+).</summary>
    /// <summary>See: https://openiap.dev/docs/apis/ios/sync-ios</summary>
    Task<bool> SyncIOSAsync();

    /// <summary>Deprecated. Validate purchase receipts with the configured providers — use verifyPurchase instead.</summary>
    /// <summary>See: https://openiap.dev/docs/features/validation#verify-purchase</summary>
    Task<VerifyPurchaseResult> ValidateReceiptAsync(VerifyPurchaseProps options);

    /// <summary>Verify a purchase against your own backend. Returns a platform-specific</summary>
    /// <summary>variant of VerifyPurchaseResult — VerifyPurchaseResultIOS exposes isValid</summary>
    /// <summary>+ receipt/JWS metadata, VerifyPurchaseResultAndroid carries Play Store</summary>
    /// <summary>receipt fields (no isValid), and VerifyPurchaseResultHorizon uses success.</summary>
    /// <summary>Inspect the concrete variant before reading fields.</summary>
    /// <summary>See: https://openiap.dev/docs/features/validation#verify-purchase</summary>
    Task<VerifyPurchaseResult> VerifyPurchaseAsync(VerifyPurchaseProps options);

    /// <summary>Verify via a managed provider without standing up your own server. The</summary>
    /// <summary>PurchaseVerificationProvider enum currently exposes only IAPKit; platform</summary>
    /// <summary>availability may differ by implementation.</summary>
    /// <summary>See: https://openiap.dev/docs/features/validation#verify-purchase-with-provider</summary>
    Task<VerifyPurchaseWithProviderResult> VerifyPurchaseWithProviderAsync(VerifyPurchaseWithProviderProps options);
}

/// <summary>GraphQL root query operations.</summary>
public interface QueryResolver
{
    /// <summary>Check eligibility for the external purchase notice sheet (iOS 17.4+).</summary>
    /// <summary>Uses ExternalPurchase.canPresent.</summary>
    /// <summary>See: https://openiap.dev/docs/apis/ios/can-present-external-purchase-notice-ios</summary>
    Task<bool> CanPresentExternalPurchaseNoticeIOSAsync();

    /// <summary>Get the user&apos;s current entitlement for a product, using StoreKit 2 (iOS 15+).</summary>
    /// <summary>See: https://openiap.dev/docs/apis/ios/current-entitlement-ios</summary>
    Task<PurchaseIOS?> CurrentEntitlementIOSAsync(string sku);

    /// <summary>Fetch products or subscriptions from the store.</summary>
    /// <summary>See: https://openiap.dev/docs/apis/fetch-products</summary>
    Task<FetchProductsResult> FetchProductsAsync(ProductRequest @params);

    /// <summary>Get details of all currently active subscriptions (filters by subscriptionIds when provided).</summary>
    /// <summary>See: https://openiap.dev/docs/apis/get-active-subscriptions</summary>
    Task<IReadOnlyList<ActiveSubscription>> GetActiveSubscriptionsAsync(IReadOnlyList<string>? subscriptionIds = null);

    /// <summary>List every StoreKit transaction (finished + unfinished) for the current user.</summary>
    /// <summary>Requires the SK2ConsumableTransactionHistory Info.plist key in the host app</summary>
    /// <summary>for finished consumables to be included (iOS 18+).</summary>
    /// <summary>Unlike getAvailablePurchases, always returns the iOS-specific PurchaseIOS shape.</summary>
    /// <summary>See: https://openiap.dev/docs/apis/ios/get-all-transactions-ios</summary>
    Task<IReadOnlyList<PurchaseIOS>> GetAllTransactionsIOSAsync();

    /// <summary>Fetch the app transaction (iOS 16+).</summary>
    /// <summary>See: https://openiap.dev/docs/apis/ios/get-app-transaction-ios</summary>
    Task<AppTransaction?> GetAppTransactionIOSAsync();

    /// <summary>List active purchases for the current user.</summary>
    /// <summary>See: https://openiap.dev/docs/apis/get-available-purchases</summary>
    Task<IReadOnlyList<Purchase>> GetAvailablePurchasesAsync(PurchaseOptions? options = null);

    /// <summary>Fetch a token for Apple&apos;s External Purchase Server reporting API (iOS 18.1+).</summary>
    /// <summary>Use this token to report transactions made through ExternalPurchaseCustomLink.</summary>
    /// <summary>Reference: https://developer.apple.com/documentation/storekit/externalpurchasecustomlink/token(for:)</summary>
    /// <summary>See: https://openiap.dev/docs/apis/ios/get-external-purchase-custom-link-token-ios</summary>
    Task<ExternalPurchaseCustomLinkTokenResultIOS> GetExternalPurchaseCustomLinkTokenIOSAsync(ExternalPurchaseCustomLinkTokenTypeIOS tokenType);

    /// <summary>List unfinished StoreKit transactions in the queue.</summary>
    /// <summary>See: https://openiap.dev/docs/apis/ios/get-pending-transactions-ios</summary>
    Task<IReadOnlyList<PurchaseIOS>> GetPendingTransactionsIOSAsync();

    /// <summary>Read the App Store-promoted product, if any (iOS 11+).</summary>
    /// <summary>See: https://openiap.dev/docs/apis/ios/get-promoted-product-ios</summary>
    Task<ProductIOS?> GetPromotedProductIOSAsync();

    /// <summary>Get base64-encoded receipt data (legacy validation).</summary>
    /// <summary>See: https://openiap.dev/docs/apis/ios/get-receipt-data-ios</summary>
    Task<string?> GetReceiptDataIOSAsync();

    /// <summary>Return the user&apos;s storefront country code.</summary>
    /// <summary>See: https://openiap.dev/docs/apis/get-storefront</summary>
    Task<string> GetStorefrontAsync();

    /// <summary>Deprecated. Get the current App Store storefront country code — use cross-platform getStorefront instead.</summary>
    /// <summary>See: https://openiap.dev/docs/apis/ios/get-storefront-ios</summary>
    Task<string> GetStorefrontIOSAsync();

    /// <summary>Return the JWS string for a transaction (StoreKit 2).</summary>
    /// <summary>See: https://openiap.dev/docs/apis/ios/get-transaction-jws-ios</summary>
    Task<string?> GetTransactionJwsIOSAsync(string sku);

    /// <summary>Check whether the user has any active subscription.</summary>
    /// <summary>See: https://openiap.dev/docs/apis/has-active-subscriptions</summary>
    Task<bool> HasActiveSubscriptionsAsync(IReadOnlyList<string>? subscriptionIds = null);

    /// <summary>Check eligibility for the custom-link variant of external purchase (iOS 18.1+).</summary>
    /// <summary>Returns true if the app can use custom external purchase links.</summary>
    /// <summary>Reference: https://developer.apple.com/documentation/storekit/externalpurchasecustomlink/iseligible</summary>
    /// <summary>See: https://openiap.dev/docs/apis/ios/is-eligible-for-external-purchase-custom-link-ios</summary>
    Task<bool> IsEligibleForExternalPurchaseCustomLinkIOSAsync();

    /// <summary>Check intro-offer eligibility for a subscription group.</summary>
    /// <summary>See: https://openiap.dev/docs/apis/ios/is-eligible-for-intro-offer-ios</summary>
    Task<bool> IsEligibleForIntroOfferIOSAsync(string groupId);

    /// <summary>Check whether a transaction&apos;s JWS verification passed (StoreKit 2).</summary>
    /// <summary>See: https://openiap.dev/docs/apis/ios/is-transaction-verified-ios</summary>
    Task<bool> IsTransactionVerifiedIOSAsync(string sku);

    /// <summary>Get the latest verified transaction for a product, using StoreKit 2.</summary>
    /// <summary>See: https://openiap.dev/docs/apis/ios/latest-transaction-ios</summary>
    Task<PurchaseIOS?> LatestTransactionIOSAsync(string sku);

    /// <summary>Get subscription status objects from StoreKit 2 (iOS 15+).</summary>
    /// <summary>See: https://openiap.dev/docs/apis/ios/subscription-status-ios</summary>
    Task<IReadOnlyList<SubscriptionStatusIOS>> SubscriptionStatusIOSAsync(string sku);

    /// <summary>Deprecated. Legacy App Store receipt validation — use verifyPurchase instead.</summary>
    /// <summary>See: https://openiap.dev/docs/apis/ios/validate-receipt-ios</summary>
    Task<VerifyPurchaseResultIOS> ValidateReceiptIOSAsync(VerifyPurchaseProps options);
}

/// <summary>GraphQL root subscription operations.</summary>
public interface SubscriptionResolver
{
    /// <summary>Fires when a user selects developer billing in the External Payments flow (Android only)</summary>
    /// <summary>Triggered when the user chooses to pay via the developer&apos;s external payment option</summary>
    /// <summary>instead of Google Play Billing in the side-by-side choice dialog.</summary>
    /// <summary>Contains the externalTransactionToken needed to report the transaction.</summary>
    /// <summary>Available in Google Play Billing Library 8.3.0+</summary>
    Task<DeveloperProvidedBillingDetailsAndroid> DeveloperProvidedBillingAndroidAsync();

    /// <summary>Fires when the App Store surfaces a promoted product (iOS only)</summary>
    Task<string> PromotedProductIOSAsync();

    /// <summary>Fires when a purchase fails or is cancelled</summary>
    Task<PurchaseError> PurchaseErrorAsync();

    /// <summary>Fires when a purchase completes successfully or a pending purchase resolves</summary>
    /// <summary>Options can opt iOS listeners into duplicate StoreKit transaction replays</summary>
    /// <summary>for diagnostics; default listeners receive one event per transaction ID</summary>
    /// <summary>during a single connection session.</summary>
    Task<Purchase> PurchaseUpdatedAsync(PurchaseUpdatedListenerOptions? options = null);

    /// <summary>Fires when an active subscription enters a billing-issue state that needs user action</summary>
    /// <summary>(payment method failed, card expired, etc.). Cross-platform unification:</summary>
    /// <summary></summary>
    /// <summary>- iOS 18+: delivered via StoreKit 2 `Message.Reason.billingIssue`.</summary>
    /// <summary>- Android (Play flavor, Billing 8.1+): emitted when `isSuspended == true` is first detected</summary>
    /// <summary>  on a previously healthy subscription. Requires Google Play Billing Library 8.1.0 or newer.</summary>
    /// <summary>- Android (Horizon flavor): NOT emitted. The Horizon Billing Compatibility SDK implements</summary>
    /// <summary>  the Play Billing 7.0 API surface which does not expose a suspended-subscription signal.</summary>
    /// <summary></summary>
    /// <summary>Listeners should not assume the event will fire on every store. Direct users to the</summary>
    /// <summary>platform subscription management UI (`deepLinkToSubscriptions`) to resolve the issue.</summary>
    Task<Purchase> SubscriptionBillingIssueAsync();

    /// <summary>Fires when a user selects alternative billing in the User Choice Billing dialog (Android only)</summary>
    /// <summary>Only triggered when the user selects alternative billing instead of Google Play billing</summary>
    Task<UserChoiceBillingDetails> UserChoiceBillingAndroidAsync();
}
