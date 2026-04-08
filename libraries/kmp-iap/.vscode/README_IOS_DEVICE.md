# Running Example App on iOS Device

## Prerequisites

1. **Xcode**: Make sure you have Xcode installed from the App Store
2. **Apple Developer Account**: You need at least a free Apple Developer account
3. **iOS Device**: iPhone or iPad connected via USB
4. **Trust**: Your device must trust your computer

## VS Code Launch Options

We provide three ways to run the example app on your iOS device:

### 1. iOS Device (Automated)
- Uses `xcodebuild` to build and deploy directly
- Select "iOS Device" from the Run and Debug panel
- Requires proper code signing setup

### 2. iOS Device (Open in Xcode)
- Opens the project in Xcode for manual run
- Select "iOS Device (Open in Xcode)" from the Run and Debug panel
- Best for first-time setup or when you need to fix signing issues

### 3. iOS Simulator
- Runs on the iOS Simulator
- Select "iOS Simulator" from the Run and Debug panel
- No code signing required

## First Time Setup

1. Connect your iOS device via USB
2. Unlock your device
3. Trust this computer when prompted on your device
4. Run "iOS Device (Open in Xcode)" launcher
5. In Xcode:
   - Select your device from the device list
   - Go to Signing & Capabilities tab
   - Select your team (or add your Apple ID)
   - Fix any signing issues
6. Run the app from Xcode (Cmd+R)
7. On your device: Go to Settings > General > Device Management and trust your developer certificate

## Troubleshooting

### Xcode Token/Credentials Error
If you see "Invalid credentials in keychain" or "missing Xcode-Token" error:

1. Open Xcode manually
2. Go to Xcode → Settings → Accounts
3. Sign out from your Apple ID
4. Sign in again with your Apple ID
5. Make sure your team is selected
6. Try running the script again

Alternative solution:
- Use "iOS Device (Open in Xcode)" launcher instead
- This opens Xcode where you can fix signing issues directly

### "No iOS device connected"
- Make sure your device is connected via USB
- Check that your device is unlocked
- Verify the device trusts your computer

### Code signing errors
- Open in Xcode and fix signing issues
- Make sure you have a development team selected
- For free accounts, you may need to change the bundle identifier

### "Could not launch app"
- The app might still be installed on your device
- Try tapping the app icon on your device
- Check Settings > General > Device Management to trust the developer

### Build failures
- Clean the build: `cd example && ./gradlew clean`
- Delete derived data in Xcode
- Restart Xcode and try again

## Tips

- Use "iOS Device (Open in Xcode)" for the first run to set up code signing
- Once set up, use "iOS Device" for faster builds
- Keep your device unlocked during the build process
- Enable "Automatically manage signing" in Xcode for easier setup