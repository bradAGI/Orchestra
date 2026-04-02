# 🔒 Binary Protection System

> **Why this exists:** This repository was growing too large due to accidentally committed binary files. This protection system prevents that from happening again.

## 🛡️ Protection Layers

Our repository has **4 layers** of protection against binary file commits:

### 1. 📋 Enhanced .gitignore
- Comprehensive patterns for all binary types
- Orchestra-specific binary patterns
- Sensitive file patterns (`.env`, `.key`, etc.)
- Platform-specific files (`.DS_Store`, `Thumbs.db`)

### 2. ⚙️ Git Attributes (.gitattributes)
- Forces certain patterns to never be tracked
- Prevents `git add -f` from overriding .gitignore
- Ensures text files are handled correctly

### 3. 🔍 Pre-commit Hook
- **Most Important:** Actively blocks commits with binary files
- Runs automatically before every `git commit`
- Provides helpful error messages and solutions
- **Cannot be bypassed** without deliberate action

### 4. 🤖 CI/CD Protection (GitHub Actions)
- Final safety net in continuous integration
- Scans entire repository on every push/PR
- Warns about large files and missing .gitignore patterns

## 🚫 What Gets Blocked

### Critical Orchestra Binaries
```
orchestrd*           # Backend binary
orchestra-dash*      # TUI binary
apps/backend/orchestrd*
apps/tui/orchestra*
```

### General Binaries
```
*.exe, *.bin, *.dll, *.so, *.dylib
*.a, *.o, *.out
*.db, *.sqlite*
```

### Sensitive Files
```
.env*
*.key, *.pem, *.p12
*secret*, *credential*, *password*
*token*
```

## ✅ How to Work With This System

### Building Binaries (Normal Development)
```bash
# Backend
cd apps/backend
go build -o orchestrd ./cmd/orchestra/

# TUI  
cd apps/tui
go build -o orchestra-dash .

# These binaries are automatically ignored ✅
```

### If You Get Blocked
When you try to commit and see this error:

```
🚫 COMMIT BLOCKED - BINARY FILES DETECTED!
❌ apps/backend/orchestrd (Orchestra binary)
```

**Solutions:**

1. **Remove from staging:**
   ```bash
   git reset HEAD apps/backend/orchestrd
   ```

2. **Verify it's in .gitignore:**
   ```bash
   grep orchestrd .gitignore  # Should show matches
   ```

3. **Commit your other changes:**
   ```bash
   git commit -m "Your changes"
   ```

### Adding Large Assets (If Really Needed)

If you genuinely need to commit a large file:

1. **First, ask yourself:** Does this really belong in git?
2. **Consider alternatives:** Can it be downloaded/generated?
3. **Use Git LFS:** For truly necessary large files
   ```bash
   git lfs track "*.large-asset"
   git add .gitattributes
   git add your-large-file
   git commit
   ```

### Updating Protection Patterns

If you need to add new protection patterns:

1. **Update .gitignore:** Add new patterns
2. **Update .gitattributes:** Add `-filter` for critical files
3. **Update pre-commit hook:** Add to the pattern arrays
4. **Test locally:**
   ```bash
   # Try committing a test binary
   echo "test" > test.exe
   git add test.exe
   git commit -m "test"  # Should be blocked
   rm test.exe
   ```

## 🆘 Emergency Override (Use Sparingly!)

If you absolutely must bypass protection:

```bash
# Temporary disable pre-commit hook
git commit --no-verify -m "Emergency commit"

# Re-enable immediately after
# (Hook is automatically re-enabled)
```

**⚠️ Warning:** Only use `--no-verify` in genuine emergencies. The protection is there for good reasons!

## 🔧 Maintenance

### Check Protection Status
```bash
# Verify .gitignore has key patterns
grep -E "(orchestrd|\*.exe|\.env)" .gitignore

# Check if pre-commit hook is executable
ls -la .git/hooks/pre-commit

# Test the hook manually
.git/hooks/pre-commit
```

### Update Protection System
```bash
# If you update the protection system, test it:
echo "test" > test-binary.exe
git add test-binary.exe
git commit -m "test"  # Should be blocked
git reset HEAD test-binary.exe
rm test-binary.exe
```

## 📊 Impact

This protection system prevents:
- ❌ Repository bloat (was 2.9GB, now ~100MB smaller)
- ❌ Slow clone times
- ❌ Accidental secret commits
- ❌ Binary file conflicts in merges
- ❌ Platform-specific executable issues

## 🤝 Team Guidelines

1. **Always build binaries locally** - never commit them
2. **Check your commits** before pushing
3. **Update .gitignore** when adding new binary types
4. **Report issues** with protection system if too restrictive
5. **Don't use `--no-verify`** unless absolutely necessary

## 🆘 Getting Help

If the protection system blocks something it shouldn't:

1. **Check if it's really needed in git**
2. **Update .gitignore** if it should be ignored
3. **Contact the team** if you're unsure
4. **Create an issue** if the protection is too aggressive

---

**Remember:** This system exists to keep our repository fast and clean for everyone! 🚀