# Ship an Onyx update in one command. Run from an up-to-date main.
#
#   make release                          patch:  1.0.0 -> 1.0.1
#   make release BUMP=minor               minor:  1.0.0 -> 1.1.0
#   make release BUMP=major               major:  1.0.0 -> 2.0.0
#   make release NOTES="What changed"     custom notes (default: GitHub writes them from merged PRs)
#
#   make publish    re-run the build + publish for the current version (e.g. after a failed build)
#   make check      only run the pre-flight checks
#
# Installed copies of Onyx pick the release up on their next launch.

BUMP ?= patch
NOTES ?=
KEY ?= $(HOME)/.tauri/onyx.key

export PATH := $(HOME)/.cargo/bin:$(PATH)
export ONYX_SIGNING_KEY_PATH := $(KEY)

VERSION = $(shell node -p "require('./package.json').version")

.PHONY: release publish check

release: check
	@case "$(BUMP)" in patch|minor|major) ;; *) echo "BUMP must be patch, minor or major."; exit 1 ;; esac
	@npm version $(BUMP) --no-git-tag-version >/dev/null
	@git add package.json && git add -u package-lock.json
	@git commit -q -m "Release $$(node -p "require('./package.json').version")"
	@git push -q origin main
	@echo "Bumped to $$(node -p "require('./package.json').version") and pushed. Building and publishing..."
	@$(MAKE) --no-print-directory publish

publish:
	@echo "Publishing Onyx $(VERSION)"
	@node scripts/release.mjs $(if $(NOTES),--notes "$(NOTES)")
	@echo "Done. Onyx $(VERSION) is live: https://github.com/sinennn/onyx/releases/tag/v$(VERSION)"

check:
	@test "$$(git branch --show-current)" = main || { echo "Switch to main first (git switch main)."; exit 1; }
	@test -z "$$(git status --porcelain)" || { echo "Commit or stash your changes first."; exit 1; }
	@git fetch -q origin main
	@test "$$(git rev-parse HEAD)" = "$$(git rev-parse origin/main)" || { echo "main is not in sync with GitHub. Run git pull (or push) first."; exit 1; }
	@test -f "$(KEY)" || { echo "Signing key not found at $(KEY). Restore your backup or set KEY=/path/to/onyx.key."; exit 1; }
	@gh auth status >/dev/null 2>&1 || { echo "Log in to GitHub first: gh auth login"; exit 1; }
	@command -v cargo >/dev/null || { echo "Rust is not installed (expected cargo in ~/.cargo/bin)."; exit 1; }
	@rustup target list --installed | grep -q aarch64-apple-darwin || rustup target add aarch64-apple-darwin
	@rustup target list --installed | grep -q x86_64-apple-darwin || rustup target add x86_64-apple-darwin
	@echo "Ready to release (current version $(VERSION))."
