import SwiftUI

struct AppColors {
    static let primary = Color.blue
    static let secondary = Color.purple 
    static let success = Color.green
    static let warning = Color.orange
    static let error = Color.red
    static let background = Color(UIColor.systemGroupedBackground)
    
    // Card background that adapts to dark/light mode
    static let cardBackground = Color(UIColor.secondarySystemGroupedBackground)
    
    // Primary text that adapts to dark/light mode  
    static let primaryText = Color.primary
    
    // Secondary text that adapts to dark/light mode
    static let secondaryText = Color.secondary
}