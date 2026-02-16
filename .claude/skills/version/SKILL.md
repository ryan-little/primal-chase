---
name: version
description: Version bump workflow — analyzes changes, recommends version type, updates version references, and optionally deploys
disable-model-invocation: true
---

# Version Bump Workflow

This skill analyzes recent changes, recommends a version bump type, and updates all version references in the codebase after user confirmation.

## Step 1: Analyze Changes Since Last Version

Determine the current version by reading the version badge in `index.html` (search for `id="version-badge"`).

Then analyze what has changed since the last version tag or deploy by running:

```bash
git log main..HEAD --oneline
```

Categorize the changes:

- **Features**: New functionality, new game mechanics, new screens, new content systems
- **Bugfixes**: Bug fixes, layout fixes, typo corrections
- **Chores**: Config changes, tooling, documentation, refactoring with no behavior change
- **Balance**: Tuning numbers in config.js, simulation updates

## Step 2: Recommend Version Type

Based on the changes, recommend one of:

| Type | When to Use | Example |
|------|-------------|---------|
| **Minor** (v1.X.0) | New features, significant content additions, new game systems, visual overhauls | v1.7 -> v1.8 |
| **Patch** (v1.X.Y) | Bug fixes, small tweaks, balance-only changes, chore work | v1.7.0 -> v1.7.1 |

Guidelines:
- If there are ANY new features, recommend minor
- If it is ONLY bugfixes/balance/chores, recommend patch
- A mix of features + fixes = minor (fixes get bundled into the feature release)

Present the recommendation to the user with:
1. The current version
2. The recommended new version
3. A brief summary of why (list the key changes grouped by category)
4. Both version options so they can override your recommendation

Ask the user to confirm which version to use. Do NOT proceed until they confirm.

## Step 3: Update Version References

Once the user confirms the version number, update these locations:

1. **Version badge in index.html:**
   Find `<div id="version-badge">vX.Y.Z</div>` and update the version string.

2. **Current status in CLAUDE.md:**
   Find the `**Current status:**` line in the Project Overview section and update the version number.

3. **Version history in memory:**
   Read the version history file at `/Users/ryan/.claude/projects/-Users-ryan-Desktop-Projects-PrimalChase/memory/version-history.md`.
   Add a new section at the end following the existing format:
   ```
   ### VX.Y — Short Title
   - Bullet points of what changed
   ```
   For the short title, write a concise summary of the release theme (e.g., "Difficulty System & Dashboard Overhaul").
   For bullet points, summarize the key changes from the git log analysis in Step 1.

4. **MEMORY.md status line:**
   Update the version status line in `/Users/ryan/.claude/projects/-Users-ryan-Desktop-Projects-PrimalChase/memory/MEMORY.md` to reflect the new version number and status.

## Step 4: Commit

Stage and commit the version bump changes with the message format:

```
chore: bump version to vX.Y.Z
```

Only stage files that were modified in this skill (index.html, CLAUDE.md). Do not stage unrelated changes.

## Step 5: Offer Deploy

Ask the user: "Version bumped to vX.Y.Z. Would you like to deploy now?"

- If yes: invoke the `/deploy` skill
- If no: tell them they can run `/deploy` later when ready
