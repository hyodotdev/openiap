---
name: link-sponsor
description: "Link a GitHub sponsorship of OpenIAP to the IAPKit organization it pays for, so that organization gets no sponsorship requests and sees the sponsorship on its Usage page, or remove the link when the sponsorship ends. Use when Hyo says a company sponsored or stopped sponsoring, forwards a reply naming its sponsoring account, or asks to check sponsor links."
---

# Link Sponsor

IAPKit sends no sponsorship requests to an organization while a GitHub
sponsorship is linked to it (`packages/kit/convex/sponsorship`). Nothing links
or unlinks on its own: Hyo says when a sponsorship starts or ends, and this
skill does the rest.

## Authority

This skill holds the one production write that the Production Data Guardrail in
`AGENTS.md` allows: `sponsorship/internal:setSponsorshipLink` with `--prod`,
run after Hyo confirms the organization and the GitHub account in the
conversation. Every other step is a read. Never run another production
mutation, and never copy organization names or member details into files,
commits, or GitHub.

## 1. Find the sponsorship

Hyo's `gh` login reads it; the token stays on this machine. One request lists
every sponsorship, newest first, and marks the ones GitHub counts as current:

```bash
gh api graphql -f query='{organization(login:"hyodotdev"){current:sponsorshipsAsMaintainer(first:100,activeOnly:true,includePrivate:true,orderBy:{field:CREATED_AT,direction:DESC}){nodes{sponsorEntity{... on User{login} ... on Organization{login}}}} all:sponsorshipsAsMaintainer(first:100,activeOnly:false,includePrivate:true,orderBy:{field:CREATED_AT,direction:DESC}){totalCount nodes{sponsorEntity{__typename ... on User{login databaseId} ... on Organization{login databaseId}} tier{monthlyPriceInDollars isOneTime}}}}}' --jq '.data.organization as $o | "total=\($o.all.totalCount)", (($o.current.nodes | map(.sponsorEntity.login)) as $now | $o.all.nodes[] | [(if (.sponsorEntity.login | IN($now[])) then "current" else "past" end), .sponsorEntity.__typename, .sponsorEntity.login, .sponsorEntity.databaseId, .tier.monthlyPriceInDollars, (if .tier.isOneTime then "one-time" else "monthly" end)] | @tsv)'
```

Take the account Hyo named and note its login, numeric id, amount, and whether
it is one-time. A monthly sponsorship must be `current`; a `past` monthly one
has ended. A one-time payment always shows as `past`, so link it when Hyo says
it is the one. The newest 100 hold any sponsorship that just started; when
`total` is over 100 and the account is not listed, page the `all` connection
with `after:` before concluding it is missing. An account that is not there
cannot be linked: say so and stop. A written arrangement outside GitHub
Sponsors still goes through `markSponsored`, which Hyo runs.

## 2. Find the organization

From `packages/kit`:

```bash
npx convex run --prod sponsorship/internal:listLinkCandidates '{}'
```

It lists the organizations that received a sponsorship email or already have a
link, with name, slug, stage, last MRR, and the link. Pass
`'{"slug":"<slug>"}'` to add an organization Hyo names that is not listed.
Match on what Hyo said and the email thread; when more than one organization
could fit, list them and ask.

## 3. Confirm

Show Hyo one line each: the GitHub account (type, login, amount), the
organization (name, slug), and any link it replaces. Wait for a clear yes for
this pair; a yes for another pair does not carry over.

## 4. Link or remove

```bash
npx convex run --prod sponsorship/internal:setSponsorshipLink '{"organizationId":"<organization id>","sponsor":{"login":"<login>","githubId":<numeric id>,"monthlyUsd":<amount>,"isOneTime":<true for one-time, else false>}}'
```

Linking again replaces the earlier link, which is also how a tier change is
recorded. When Hyo says the sponsorship ended, or the pair was wrong, pass
`"sponsor":null`: the link goes, and the organization is back on the normal
sponsorship email schedule.

## 5. Verify and report

Run `listLinkCandidates` again and check the organization shows the link, or
no longer does. Tell Hyo in a line or two what changed.
