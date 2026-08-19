import { describe, expect, it } from "vitest";
import {
  EMAIL_SIGN_IN_CLOSES_AT,
  EMAIL_SIGN_IN_CLOSES_ON as SERVER_CLOSES_ON,
  isEmailSignInOpen as serverIsOpen,
} from "../../convex/authWindow";
import {
  EMAIL_SIGN_IN_CLOSES_ON as CLIENT_CLOSES_ON,
  isEmailSignInOpen as clientIsOpen,
} from "./constants";

describe("email sign-in cutoff mirror", () => {
  it("agrees with the server on the date", () => {
    expect(CLIENT_CLOSES_ON).toBe(SERVER_CLOSES_ON);
  });

  it("agrees with the server on every boundary", () => {
    for (const t of [
      Date.UTC(2026, 8, 29),
      Date.UTC(2026, 8, 30),
      EMAIL_SIGN_IN_CLOSES_AT,
      EMAIL_SIGN_IN_CLOSES_AT + 1,
      Date.UTC(2026, 9, 1),
    ]) {
      expect(clientIsOpen(t)).toBe(serverIsOpen(t));
    }
  });
});
