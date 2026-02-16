---
name: deploy
description: Merge v1 into main and push to deploy via GitHub Pages
disable-model-invocation: true
---

# Deploy Primal Chase to Production

This skill deploys the game from the `v1` development branch to the `main` branch, which serves GitHub Pages at primalchase.com.

## Procedure

Follow these steps exactly. If any step fails, STOP immediately, explain the failure to the user, and ensure you return to the `v1` branch before finishing.

### Step 1: Pre-flight Checks

Run these three checks. ALL must pass before proceeding.

1. **Verify current branch is v1:**
   Run `git branch --show-current`.
   - If the current branch is NOT `v1`, STOP and tell the user: "You are on branch [X], not v1. Switch to v1 and try again."

2. **Verify no uncommitted changes to tracked files:**
   Run `git diff --quiet HEAD`.
   - If it exits non-zero (there are staged or unstaged changes to tracked files), STOP and show `git status` output. Tell the user: "There are uncommitted changes to tracked files. Commit or stash before deploying."
   - Untracked files (shown as `??` in git status) are fine and should NOT block the deploy.

3. **Verify v1 is up to date with remote:**
   Run `git fetch origin v1` then `git rev-list HEAD..origin/v1 --count`.
   - If the count is greater than 0, WARN the user: "Your local v1 is [N] commits behind origin/v1. You may want to pull first." Ask if they want to continue anyway.
   - If the fetch fails, WARN but continue (the user may be offline).

Tell the user: "Pre-flight checks passed. Deploying v1 to main..."

### Step 2: Merge and Push

Run these commands sequentially. Stop at the first failure.

1. **Switch to main:**
   Run `git checkout main`.
   - If this fails, STOP and explain the error. You are still on v1, so no recovery needed.

2. **Pull latest main:**
   Run `git pull origin main`.
   - If this fails, STOP and explain the error. Run `git checkout v1` to return to dev branch.

3. **Merge v1 into main:**
   Run `git merge v1 --no-edit`.
   - If there are merge conflicts, STOP immediately. Tell the user: "Merge conflicts detected. Resolve them manually, then complete the merge." Run `git merge --abort` to undo the merge, then run `git checkout v1` to return to dev branch. List the conflicting files if visible in the output.
   - NEVER force push. NEVER use `--force` or `-f` flags.

4. **Push main to origin:**
   Run `git push origin main`.
   - If this fails, STOP and explain the error. Run `git checkout v1` to return to dev branch. Do NOT force push.

### Step 3: Return to Dev Branch

Run `git checkout v1` to switch back to the development branch. This step is mandatory -- always return to v1 regardless of success or failure in Step 2.

### Step 4: Confirm

Tell the user:

- Deploy is complete. The `v1` branch has been merged into `main` and pushed to origin.
- GitHub Pages will rebuild the site at primalchase.com. This typically takes 1-2 minutes to propagate.
- The analytics dashboard at primalchase.com/stats/ will also be updated if any dashboard changes were included.
- You are back on the `v1` branch.

## Rules

- NEVER force push (`--force`, `-f`). If a normal push fails, stop and explain.
- NEVER skip pre-flight checks. All three must run.
- NEVER try to auto-resolve merge conflicts. Stop and let the user handle it.
- ALWAYS return to the `v1` branch when finished, whether the deploy succeeded or failed.
- NEVER amend commits or rewrite history on main.
- Do NOT run the simulation or update any files as part of this skill. This is a deploy-only operation.
