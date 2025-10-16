import SwiftUI

struct InstructionCard: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                Image(systemName: "info.circle")
                    .foregroundColor(AppColors.primary)
                Text("How it works")
                    .font(.headline)
                Spacer()
            }
            
            VStack(alignment: .leading, spacing: 12) {
                InstructionRow(
                    number: "1",
                    text: "Tap the 'Redeem Offer Code' button above"
                )
                
                InstructionRow(
                    number: "2", 
                    text: "Enter your offer code in the native iOS sheet"
                )
                
                InstructionRow(
                    number: "3",
                    text: "Follow the prompts to complete redemption"
                )
                
                InstructionRow(
                    number: "4",
                    text: "Your purchase will be automatically applied"
                )
            }
        }
        .padding()
        .background(AppColors.cardBackground)
        .cornerRadius(12)
        .shadow(radius: 2)
        .padding(.horizontal)
    }
}

