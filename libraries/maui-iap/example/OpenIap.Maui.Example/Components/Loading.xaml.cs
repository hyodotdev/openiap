namespace OpenIap.Maui.Example.Components;

public partial class Loading : ContentView
{
    public static readonly BindableProperty MessageProperty = BindableProperty.Create(
        nameof(Message), typeof(string), typeof(Loading), "Connecting to Store...",
        propertyChanged: OnMessageChanged);

    public string Message
    {
        get => (string)GetValue(MessageProperty);
        set => SetValue(MessageProperty, value);
    }

    public Loading()
    {
        InitializeComponent();
    }

    private static void OnMessageChanged(BindableObject bindable, object oldValue, object newValue)
    {
        if (bindable is Loading loading && newValue is string text)
        {
            loading.MessageLabel.Text = text;
        }
    }
}
