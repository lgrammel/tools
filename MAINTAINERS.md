# Maintainers

## Release Guide

This repo uses Changesets to version and publish the package workspaces.

1. Make sure every user-facing package change has a changeset:

   ```bash
   pnpm changeset
   ```

2. Run the full release flow:

   ```bash
   pnpm release:full
   ```

   This verifies the workspace, applies pending changesets, shows the version diff for review, commits the version changes, publishes packages, and pushes the release commit and tags.

Manual release steps:

1. Before releasing, verify the workspace:

   ```bash
   pnpm install
   pnpm typecheck
   pnpm build
   ```

2. Apply the pending changesets. This updates package versions, changelogs, and removes consumed changeset files:

   ```bash
   pnpm version
   ```

3. Review and commit the version changes:

   ```bash
   git diff
   git add .
   git commit -m "Version packages"
   ```

4. Publish from a clean working tree:

   ```bash
   pnpm release
   ```

5. Push the release commit and tags:

   ```bash
   git push --follow-tags
   ```

Packages publish publicly to npm. Example workspaces are ignored by Changesets and are not released.
