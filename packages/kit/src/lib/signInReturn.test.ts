// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";

import {
  clearSignInReturn,
  rememberSignInReturn,
  takeSignInReturn,
} from "./signInReturn";

const PATH = "/oauth/authorize?client_id=x&state=s";

beforeEach(() => sessionStorage.clear());

describe("sign-in return", () => {
  it("hands back an approval page once", () => {
    rememberSignInReturn(PATH);
    expect(takeSignInReturn()).toBe(PATH);
    expect(takeSignInReturn()).toBeNull();
  });

  it("accepts the CLI page too", () => {
    rememberSignInReturn("/cli/authorize?user_code=ABC");
    expect(takeSignInReturn()).toBe("/cli/authorize?user_code=ABC");
  });

  it("drops an old note after an hour", () => {
    rememberSignInReturn(PATH);
    expect(takeSignInReturn(Date.now() + 60 * 60 * 1000)).toBeNull();
  });

  it("never returns to another page", () => {
    rememberSignInReturn("https://evil.example/oauth/authorize?x");
    expect(takeSignInReturn()).toBeNull();
    rememberSignInReturn("/hyo-dev/project/app/apikeys");
    expect(takeSignInReturn()).toBeNull();
    rememberSignInReturn("/oauth/authorized/elsewhere?x");
    expect(takeSignInReturn()).toBeNull();
    rememberSignInReturn("/oauth/authorizeX");
    expect(takeSignInReturn()).toBeNull();
    sessionStorage.setItem("iapkit.signInReturn", "not json");
    expect(takeSignInReturn()).toBeNull();
  });

  it("forgets the note once sign-in succeeds", () => {
    rememberSignInReturn(PATH);
    clearSignInReturn();
    expect(takeSignInReturn()).toBeNull();
  });
});
