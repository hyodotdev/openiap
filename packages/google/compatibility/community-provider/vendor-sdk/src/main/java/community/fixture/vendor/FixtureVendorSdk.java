package community.fixture.vendor;

public final class FixtureVendorSdk {
    public static String productDescription() {
        return "Transitive vendor SDK with JVM date " + new kotlinx.datetime.LocalDate(2024, 1, 2);
    }

    private FixtureVendorSdk() {}
}
