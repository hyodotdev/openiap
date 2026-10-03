import PackagePlugin

@main
struct FixtureBuildMetadata: BuildToolPlugin {
    func createBuildCommands(context: PluginContext, target: Target) throws -> [Command] {
        let versions = context.package.directory.appending("../../../../openiap-versions.json")
        let output = context.pluginWorkDirectory.appending("FixtureBuildVersion.swift")
        return [.buildCommand(
            displayName: "Freeze provider build versions",
            executable: try context.tool(named: "FixtureBuildMetadataGenerator").path,
            arguments: [versions.string, output.string],
            inputFiles: [versions], outputFiles: [output]
        )]
    }
}
