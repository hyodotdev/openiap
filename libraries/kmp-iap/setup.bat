@echo off
setlocal enabledelayedexpansion

:: KMP IAP Setup Script for Windows
:: This script helps set up the development environment

echo 🚀 Setting up KMP IAP development environment...

:: Check if Java exists
java -version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Java is required but not installed. Aborting.
    exit /b 1
)

echo ✅ Java found
java -version 2>&1 | findstr "version"

:: Create local.properties if it doesn't exist
if not exist "local.properties" (
    echo 📝 Creating local.properties from template...
    copy "local.properties.template" "local.properties" >nul
    echo ⚠️  Please edit local.properties with your actual values
) else (
    echo ✅ local.properties already exists
)

:: Check if GPG is available
gpg --version >nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ GPG found
    gpg --version | findstr "gpg"
    
    :: Check if GPG key exists
    gpg --list-secret-keys | findstr "sec" >nul
    if %errorlevel% equ 0 (
        echo ✅ GPG secret keys found
    ) else (
        echo ⚠️  No GPG secret keys found. See gpg-key-spec.md for setup instructions
    )
    
    :: Create GPG key file if it doesn't exist
    if not exist "gpg_key_content.gpg" (
        echo 📝 Creating gpg_key_content.gpg from template...
        copy "gpg_key_content.gpg.template" "gpg_key_content.gpg" >nul
        echo ⚠️  Please replace gpg_key_content.gpg with your actual GPG private key
    ) else (
        echo ✅ gpg_key_content.gpg already exists
    )
) else (
    echo ⚠️  GPG not found. Install GPG for signing releases (optional for development)
)

:: Check Android SDK
if defined ANDROID_HOME (
    echo ✅ Android SDK found at %ANDROID_HOME%
) else if defined ANDROID_SDK_ROOT (
    echo ✅ Android SDK found at %ANDROID_SDK_ROOT%
) else if exist "%LOCALAPPDATA%\Android\Sdk" (
    echo ✅ Android SDK found at default location
    echo 💡 Consider setting ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk
) else if exist "%USERPROFILE%\AppData\Local\Android\Sdk" (
    echo ✅ Android SDK found at default location
    echo 💡 Consider setting ANDROID_HOME=%USERPROFILE%\AppData\Local\Android\Sdk
) else (
    echo ⚠️  Android SDK not found. Install Android Studio or set sdk.dir in local.properties
)

:: Test Gradle wrapper
echo 🔨 Testing Gradle build...
gradlew.bat --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Gradle wrapper failed
    exit /b 1
)
echo ✅ Gradle wrapper works

:: Try building the library
echo 🏗️  Building library...
gradlew.bat :library:build -q
if %errorlevel% neq 0 (
    echo ❌ Library build failed
    echo 💡 Check the error messages above and ensure all dependencies are available
    exit /b 1
)
echo ✅ Library builds successfully

echo.
echo 🎉 Setup complete!
echo.
echo Next steps:
echo 1. Edit local.properties with your Maven Central and GPG credentials (for publishing)
echo 2. Replace gpg_key_content.gpg with your actual GPG private key (for signing)
echo 3. Open the project in VS Code to use the configured launch tasks
echo 4. Run 'gradlew.bat :example:run' to test the example application
echo.
echo 📚 Documentation:
echo    - Development setup: docs\SETUP.md
echo    - Release guide: docs\RELEASE.md
echo    - GPG configuration: gpg-key-spec.md

pause