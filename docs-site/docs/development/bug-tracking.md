---
sidebar_position: 6
---

# Bug Tracking

The Photo Management Platform uses `BUGS.md` in the project root to systematically track and manage known issues, bugs, and their resolution status.

## Purpose

- **Centralized Issue Tracking**: All bugs documented in one place
- **Resolution History**: Track fixes with dates and solutions
- **Priority Management**: Triage issues by importance
- **Knowledge Base**: Reference for similar issues in the future

## Structure

The BUGS.md file is organized into sections:

### 🔴 Open Issues
Current bugs that need fixing, organized by component:
- Mobile App issues
- API/Backend issues
- Infrastructure issues

### ✅ Recently Fixed
Bugs that have been resolved, including:
- Fix date
- Solution description
- Files affected

### 🟡 Known Limitations
Features that are partially implemented or have known constraints.

## Bug Documentation Format

When documenting a bug, include:

```markdown
### Bug Title
- **Description**: Clear description of the issue
- **Steps to Reproduce**: How to trigger the bug
- **Expected Behavior**: What should happen
- **Actual Behavior**: What actually happens
- **Error Messages**: Any error text or logs
- **Priority**: High/Medium/Low
- **Workaround**: Temporary solution if available
- **Files Affected**: Which files are involved
```

## Example Entry

```markdown
### Face Images API 404 Error
- **Description**: FacesScreen trying to fetch person images returns 404 error
- **Error**: `error fetching person images: 404 FacesScreen.tsx`
- **Endpoint**: `/api/persons/{id}/images` - endpoint should exist but returns 404
- **Priority**: High
- **Workaround**: None currently
- **Files Affected**: `FacesScreen.tsx`, `persons.ts` API route
```

## Workflow

1. **Discovery**: When a bug is found, immediately add to "Open Issues"
2. **Triage**: Assign priority based on impact
3. **Fix**: Implement solution
4. **Document**: Move to "Recently Fixed" with date and solution
5. **Archive**: After verification, consider moving to ACHIEVEMENTS.md

## Integration with Other Docs

- **TODO.md**: For planned features and improvements
- **ACHIEVEMENTS.md**: For completed work and milestones
- **BUGS.md**: For issue tracking and resolution

## Best Practices

1. **Document Immediately**: Add bugs as soon as they're discovered
2. **Be Specific**: Include exact error messages and reproduction steps
3. **Update Status**: Move bugs between sections as work progresses
4. **Include Context**: Note which version/commit introduced the issue
5. **Link Related Issues**: Reference related bugs or features

## Mobile App Specific Issues

Common categories:
- Navigation issues
- API integration errors
- UI/UX problems
- Performance issues
- Platform-specific bugs (iOS vs Android)

## API/Backend Specific Issues

Common categories:
- Endpoint errors (404, 500)
- Data consistency issues
- Performance bottlenecks
- Integration failures (CompreFace, etc.)

## Viewing the Bug List

The current bug list is always available at:
```
/path/to/project/BUGS.md
```

Check this file regularly during development to stay aware of known issues and their status.