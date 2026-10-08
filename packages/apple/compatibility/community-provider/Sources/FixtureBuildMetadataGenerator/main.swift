import Foundation

let args = CommandLine.arguments
let data = try Data(contentsOf: URL(fileURLWithPath: args[1]))
let versions = try JSONDecoder().decode([String: String].self, from: data)
guard let core = versions["apple"], let client = versions["clientProtocol"],
      [core, client].allSatisfy({ $0.range(of: #"^\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?(?:\+[A-Za-z0-9.-]+)?$"#, options: .regularExpression) != nil }) else {
    fatalError("Provider build requires complete native and Client Protocol versions")
}
try """
enum FixtureBuildVersion {
    static let core = "\(core)"
    static let clientProtocol = "\(client)"
}
""".write(toFile: args[2], atomically: true, encoding: .utf8)
