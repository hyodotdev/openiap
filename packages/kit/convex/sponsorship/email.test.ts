import { describe, expect, it } from "vitest";

import { sponsorshipEmail } from "./email";

describe("sponsorshipEmail", () => {
  it("tells an organization that already sponsors how to stop the emails", () => {
    for (const stage of ["advisory", "request"] as const) {
      const email = sponsorshipEmail(stage, "Acme", 9_200, 0);
      const line =
        "Already sponsoring on GitHub? Reply with the sponsoring account";
      expect(email.text).toContain(line);
      expect(email.html).toContain(line);
    }
  });
});
