import SwiftUI

struct ContentView: View {
    var body: some View {
        NavigationView {
            HomeScreen()
        }
        .navigationViewStyle(.stack)
    }
}

#Preview {
    ContentView()
}