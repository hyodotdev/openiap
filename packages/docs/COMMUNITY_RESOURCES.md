# Community Resource Contributions

The [Community Resources page](https://openiap.dev/community-resources) is a
curated library of third-party knowledge about OpenIAP and the implementations
built on its specification. Official OpenIAP updates are presented separately
from this community-maintained collection.

Thank you to every developer, writer, speaker, and team who shares practical
OpenIAP knowledge. These contributions help people discover the ecosystem and
learn from one another.

Third-party resources may target an older release, API, store policy, or a
different audience. They can become outdated. Readers should verify critical
implementation details against the current OpenIAP and platform documentation.

## What belongs here

Good submissions include:

- third-party tutorials and independent articles
- company engineering posts with practical OpenIAP implementation details
- conference talks and videos
- useful community discussions
- official ecosystem documentation that references an OpenIAP implementation
- valuable non-English resources with accurate language metadata

Please do not submit:

- spam, SEO farms, copied content, or low-quality generated articles
- generic in-app purchase content that does not meaningfully discuss an OpenIAP
  implementation
- advertisements for unrelated commercial products
- duplicate cross-posts of the same resource
- OpenIAP's own announcements unless they provide necessary historical context

Resources that discuss a commercial or competing IAP service are eligible only
when an OpenIAP implementation is also covered in a meaningful way. This page
is not a general service-comparison directory.

## Add a resource

Open [`src/lib/communityResources.ts`](src/lib/communityResources.ts) on
GitHub, add one entry to `COMMUNITY_RESOURCES`, and submit the change as a pull
request. `OFFICIAL_OPENIAP_RESOURCES` is reserved for sources maintained by
OpenIAP. Use an existing community entry as the schema reference and follow
these rules:

1. Store each URL once and use multiple `ecosystems` tags when it spans modules.
2. Use a neutral summary and never imply an endorsement or partnership.
3. Set `sourceKind` precisely: official ecosystem documentation, company
   engineering, independent content, or an individual community voice.
4. Include the original author and organization only when the source confirms
   them.
5. Add accurate language metadata. English is the initial default; future
   non-English additions should ship with a visible language filter.
6. Add a verified `publishedAt` date in `YYYY-MM-DD` format. Use the original
   publication date when available. For sources that only expose an update or
   submission date, set `dateLabel` to `Updated` or `Submitted`.
7. Do not add view counts or other metrics that will become stale.

Before opening a pull request, run the docs format check, typecheck, and build
described in [`README.md`](README.md).

If you prefer to introduce your work before editing the library, share it in
the [community resources discussion](https://github.com/hyodotdev/openiap/discussions/349).
