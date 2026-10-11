---
name: github-labels
description: Apply relevant repository labels to OpenIAP issues, Discussions and pull requests when creating or updating them, or when the user requests labeling.
---

# GitHub Labels

Read and apply the canonical
[GitHub Labels policy](../../../knowledge/internal/06-git-deployment.md#github-labels).
It owns label selection, relevance, count limits and the issue/PR/Discussion API
choices. Keep those rules there rather than duplicating them in this skill.

Read the target's content and existing labels, choose the useful set, apply it
within the user's authorized scope, and read back the labels before reporting
completion. When creating or updating an artifact, run this alongside its
existing workflow. Labeling does not authorize a new issue, Discussion or PR,
changes to unrelated artifacts, or replacement of their content.
