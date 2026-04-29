import { convexAuth } from "@convex-dev/auth/server";
import {
  ResendOTPEmailEn,
  ResendOTPEmailKo,
  ResendOTPEmailJa,
} from "./ResendOTP";
import GitHub, { type GitHubProfile } from "@auth/core/providers/github";
import { api, internal } from "./_generated/api";

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
      // Check if user exists with the same email
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

      // Find existing user by email via an internal query typed against
      // our project's data model (which exposes the `email` index on
      // `users`). The auth library types `ctx.db` as AnyDataModel, so we
      // go through `ctx.runQuery` to use the indexed lookup.
      const existingUser = await ctx.runQuery(
        internal.users.internal.findByEmail,
        { email },
      );

      if (existingUser) {
        // User exists - update auth user
        const userId = existingUser._id;

        await ctx.db.patch(userId, {
          name: profileName ?? existingUser.name,
          image: profileImage ?? existingUser.image,
        });

        // Create or update user profile
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

      // Gate: new email-OTP signups are not allowed. As of 2026-04 we
      // only accept new accounts via GitHub OAuth; the Resend OTP
      // provider stays live only so the ~110 existing email-only
      // users can keep logging in while we phase it out. If the UI
      // gate (AuthModal → canSignInWithEmail) is bypassed somehow,
      // this server-side guard rejects the signup before a user row
      // is created. OAuth providers (github) are exempt — that's the
      // path we want new users on.
      const providerId = args.provider.id;
      const isResendProvider = providerId.startsWith("resend-otp");
      if (isResendProvider) {
        throw new Error(
          "New email signups are disabled. Please sign in with GitHub instead.",
        );
      }

      // No existing user by email - try to patch the linked auth account
      // user if one was provided. If the linked user doc was deleted (e.g.
      // during a dev-time wipe) fall through and create a fresh user so
      // the OAuth flow can complete instead of throwing "Update on
      // nonexistent document ID".
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

      // Create new user
      const userId = await ctx.db.insert("users", {
        email,
        emailVerificationTime: Date.now(),
        name: profileName,
        image: profileImage,
      });

      // Create user profile
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

// Re-export from the generated API
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
