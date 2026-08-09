# Git Safety & History Preservation Rules

## 🛡️ How to Avoid Overwriting History in Future Work
If you ever need to preserve historical commits from other contributors when pushing refactored work:

1. **Clone the Original History**: Always run `git clone <repo_url>` first rather than running `git init` in an un-tracked folder.
2. **Never Force-Push (`--force`) to `main`**: Use standard `git push origin main` or work on feature branches (`git checkout -b refactor/remediation`) and open a Pull Request. That way, Git safely appends your new commits on top of the contributors' existing commit history.

**CRITICAL RULE**: NEVER perform `git push --force` or `git push -f` to `main`/`master` branches under any circumstances.
