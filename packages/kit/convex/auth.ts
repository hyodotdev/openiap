import { convexAuth } from "@convex-dev/auth/server";
import {
  ResendOTPEmailEn,
  ResendOTPEmailKo,
  ResendOTPEmailJa,
} from "./ResendOTP";
import GitHub, { type GitHubProfile } from "@auth/core/providers/github";
import { api, internal } from "./_generated/api";
import {
  assertEmailSignInWindowOpen,
  assertLegacyEmailAccount,
  isResendProviderId,
} from "./authWindow";

const CustomAuth = convexAuth({
  providers: [
    ResendOTPEmailEn,
    ResendOTPEmailKo,
    ResendOTPEmailJa,
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID!,
      clientSecret: process.env.AUTH_GITHUB_SECRET!,
      profile(profile) {
        return {
          id: profile.id.toString(),
          name: profile.name ?? undefined,
          email: profile.email,
          image: profile.avatar_url,
          login: profile.login,
        };
      },
    }),
  ],
  callbacks: {
    async createOrUpdateUser(ctx, args) {
      assertEmailSignInWindowOpen(args.provider.id);

      const email = args.profile.email;
      const profileName =
        typeof args.profile.name === "string" ? args.profile.name : undefined;
      const profileImage =
        typeof args.profile.image === "string" ? args.profile.image : undefined;
      if (!email) {
        // Our providers always supply an email, so this is an unexpected
        // configuration. Fall back to the linked auth account user if there
        // is one; otherwise we have no stable user identity to return.
        if (args.existingUserId) {
          return args.existingUserId;
        }
        throw new Error(
          "Cannot create or update user: sign-in profile is missing an email.",
        );
      }

      // The auth library types ctx.db as AnyDataModel, which hides the
      // `email` index, so the lookup goes through runQuery.
      const existingUser = await ctx.runQuery(
        internal.users.internal.findByEmail,
        { email },
      );

      if (existingUser) {
        // The UI gate (canSignInWithEmail) mirrors this; the boundary enforces it.
        if (isResendProviderId(args.provider.id)) {
          assertLegacyEmailAccount(
            args.provider.id,
            await ctx.runQuery(internal.users.internal.hasLegacyEmailAccount, {
              userId: existingUser._id,
            }),
          );
        }

        const userId = existingUser._id;

        await ctx.db.patch(userId, {
          name: profileName ?? existingUser.name,
          image: profileImage ?? existingUser.image,
        });

        const isGitHub = args.provider.id === "github";

        const githubProfile = isGitHub
          ? (args.profile as GitHubProfile)
          : undefined;
        const githubUsername = githubProfile?.login;

        await ctx.runMutation(api.userProfiles.mutation.createOrUpdateProfile, {
          userId,
          email,
          name: profileName ?? existingUser.name ?? undefined,
          loginMethod: args.provider.id,
          isGitHub,
          ...(githubUsername ? { githubUsername } : {}),
        });

        return userId;
      }

      // New accounts are GitHub-only since 2026-04; Resend OTP stays only for
      // the ~110 existing email-only users (see authWindow.ts). Rejected here,
      // before a user row exists, in case the AuthModal gate
      // (canSignInWithEmail) is bypassed.
      const providerId = args.provider.id;
      const isResendProvider = isResendProviderId(providerId);
      if (isResendProvider) {
        throw new Error(
          "New email signups are disabled. Please sign in with GitHub instead.",
        );
      }

      // The linked account's user may be gone (e.g. a dev wipe), and patching
      // it would throw "Update on nonexistent document ID".
      if (args.existingUserId) {
        const linkedUser = await ctx.db.get(args.existingUserId);
        if (linkedUser) {
          await ctx.db.patch(args.existingUserId, {
            email,
            emailVerificationTime: Date.now(),
          });
          return args.existingUserId;
        }
        // Stale auth account — fall through to insert a new user below.
      }

      const userId = await ctx.db.insert("users", {
        email,
        emailVerificationTime: Date.now(),
        name: profileName,
        image: profileImage,
      });

      const isGitHub = args.provider.id === "github";

      const githubProfile = isGitHub
        ? (args.profile as GitHubProfile)
        : undefined;
      const githubUsername = githubProfile?.login;

      await ctx.runMutation(api.userProfiles.mutation.createOrUpdateProfile, {
        userId,
        email,
        name: profileName,
        loginMethod: args.provider.id,
        isGitHub,
        ...(githubUsername ? { githubUsername } : {}),
      });

      return userId;
    },
  },
});

export const { auth, signIn, signOut, store } = CustomAuth;

import { query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const loggedInUser = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }
    const user = await ctx.db.get(userId);
    if (!user) {
      return null;
    }
    return user;
  },
});
