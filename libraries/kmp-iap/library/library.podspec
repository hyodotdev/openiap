Pod::Spec.new do |spec|
    spec.name                     = 'library'
    gradle_properties_file = File.join(File.dirname(__FILE__), '..', 'gradle.properties')
    unless File.exist?(gradle_properties_file)
        raise 'kmp-iap: missing gradle.properties'
    end
    library_version = File.read(gradle_properties_file)
        .lines
        .find { |line| line.start_with?('libraryVersion=') }
        &.split('=', 2)
        &.last
        &.strip
    if library_version.to_s.empty?
        raise "kmp-iap: 'libraryVersion' missing in gradle.properties"
    end
    spec.version                  = library_version
    spec.homepage                 = 'https://github.com/hyodotdev/openiap/tree/main/libraries/kmp-iap'
    spec.source                   = { :git => 'https://github.com/hyodotdev/openiap.git', :tag => "kmp-iap-#{library_version}" }
    spec.authors                  = { 'Hyo Dev' => 'hyo@hyo.dev' }
    spec.license                  = { :type => 'Apache-2.0', :file => '../LICENSE' }
    spec.summary                  = 'Kotlin Multiplatform OpenIAP library'
    spec.vendored_frameworks      = 'build/cocoapods/framework/library.framework'
    spec.libraries                = 'c++'
    spec.ios.deployment_target    = '15.0'
    require 'json'
    openiap_versions_file = File.join(File.dirname(__FILE__), '..', 'openiap-versions.json')
    unless File.exist?(openiap_versions_file)
        raise 'kmp-iap: missing openiap-versions.json'
    end
    openiap_versions = JSON.parse(File.read(openiap_versions_file))
    openiap_apple_version = openiap_versions['apple']
    if openiap_apple_version.to_s.empty?
        raise "kmp-iap: 'apple' version missing in openiap-versions.json"
    end
    spec.dependency 'openiap', openiap_apple_version
    if !Dir.exist?('build/cocoapods/framework/library.framework') || Dir.empty?('build/cocoapods/framework/library.framework')
        raise "

        Kotlin framework 'library' doesn't exist yet, so a proper Xcode project can't be generated.
        'pod install' should be executed after running ':generateDummyFramework' Gradle task:

            ./gradlew :library:generateDummyFramework

        Alternatively, proper pod installation is performed during Gradle sync in the IDE (if Podfile location is set)"
    end
    spec.xcconfig = {
        'ENABLE_USER_SCRIPT_SANDBOXING' => 'NO',
    }
    spec.pod_target_xcconfig = {
        'KOTLIN_PROJECT_PATH' => ':library',
        'PRODUCT_MODULE_NAME' => 'library',
    }
    spec.script_phases = [
        {
            :name => 'Build library',
            :execution_position => :before_compile,
            :shell_path => '/bin/sh',
            :script => <<-SCRIPT
                if [ "YES" = "$OVERRIDE_KOTLIN_BUILD_IDE_SUPPORTED" ]; then
                  echo "Skipping Gradle build task invocation due to OVERRIDE_KOTLIN_BUILD_IDE_SUPPORTED environment variable set to \"YES\""
                  exit 0
                fi
                set -ev
                REPO_ROOT="$PODS_TARGET_SRCROOT"
                "$REPO_ROOT/../gradlew" -p "$REPO_ROOT" $KOTLIN_PROJECT_PATH:syncFramework \
                    -Pkotlin.native.cocoapods.platform=$PLATFORM_NAME \
                    -Pkotlin.native.cocoapods.archs="$ARCHS" \
                    -Pkotlin.native.cocoapods.configuration="$CONFIGURATION"
            SCRIPT
        }
    ]

end
