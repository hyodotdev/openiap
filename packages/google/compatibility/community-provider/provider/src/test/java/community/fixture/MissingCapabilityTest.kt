package community.fixture

import dev.hyo.openiap.conformance.StoreCapability

class MissingCapabilityTest : FixtureConformanceTest() {
    override suspend fun triggerCapability(capability: StoreCapability) {
        if (capability == StoreCapability.SubscriptionBillingIssue) error("Declared capability is unimplemented")
        super.triggerCapability(capability)
    }
}
