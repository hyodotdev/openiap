using OpenIap;
using OpenIap.Maui;
using OpenIap.Maui.Example.Utils;

namespace OpenIap.Maui.Example.Pages;

// verifyAppOwnership returns the store's evidence that this install came from it.
public partial class AppOwnershipPage : ContentPage
{
    public AppOwnershipPage()
    {
        InitializeComponent();
    }

    private async void OnCheckClicked(object sender, EventArgs e)
    {
        var projectNumber = CloudProjectNumberEntry.Text?.Trim() ?? string.Empty;
        var requestHash = RequestHashEntry.Text?.Trim() ?? string.Empty;
        ResultLabel.IsVisible = true;
        if (string.IsNullOrEmpty(projectNumber) != string.IsNullOrEmpty(requestHash))
        {
            ResultLabel.Text = $"Error: {ErrorCode.DeveloperError.ToJson()}\nEnter both Google Cloud project number and Request hash, or leave both empty.";
            return;
        }
        var google = string.IsNullOrEmpty(projectNumber) ? null : new PlayIntegrityParamsAndroid
        {
            CloudProjectNumber = projectNumber,
            RequestHash = requestHash,
        };
        CheckButton.IsEnabled = false;
        CloudProjectNumberEntry.IsEnabled = false;
        RequestHashEntry.IsEnabled = false;
        CheckButton.Text = "Checking...";
        ResultLabel.Text = string.Empty;
        try
        {
            var result = await OpenIapClient.Query.VerifyAppOwnershipAsync(new VerifyAppOwnershipProps { Google = google });
            ResultLabel.Text =
                $"Status: {result.Status.ToJson()}\n" +
                $"Store ID: {result.StoreId}\n" +
                $"Reason: {result.Reason?.ToJson() ?? "none"}\n" +
                $"Signed AppTransaction length: {result.SignedAppTransactionIOS?.Length ?? 0}\n" +
                $"Integrity token length: {result.IntegrityTokenAndroid?.Length ?? 0}";
        }
        catch (OpenIapException error)
        {
            ResultLabel.Text = $"Error: {error.Error.Code.ToJson()}\n{ErrorUtils.ExtractErrorMessage(error)}";
        }
        catch (Exception error)
        {
            ResultLabel.Text = $"App ownership failed: {ErrorUtils.ExtractErrorMessage(error)}";
        }
        finally
        {
            CheckButton.IsEnabled = true;
            CloudProjectNumberEntry.IsEnabled = true;
            RequestHashEntry.IsEnabled = true;
            CheckButton.Text = "Check app ownership";
        }
    }
}
