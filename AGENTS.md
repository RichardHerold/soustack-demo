# Agent Guidelines for Soustack Demo

This document provides guidance for AI agents working on this codebase.

## Core Principle: Preserve UI Unless Explicitly Requested

**The UI in this project is intentionally designed and should NOT be modified unless the user explicitly requests UI changes.**

## Protected Areas

The following areas require explicit user permission before modification:

### UI Components
- `src/app/page.tsx` - Main application page
- `src/components/RecipeCard.tsx` - Recipe display component
- Any new UI components

### Styling
- `src/app/globals.css` - Global styles
- `src/app/footer-styles.css` - Footer-specific styles
- Any CSS/styling files

### Visual Elements
- Text content, labels, headings
- Button text and placeholders
- Layout structure and component hierarchy
- Colors, spacing, typography
- Logo sizes and positioning
- Icons and visual indicators

## What Agents Can Do Freely

### Backend Logic
- Improve API route logic (`src/app/api/**`)
- Enhance error handling
- Add validation
- Optimize data processing
- Fix bugs in business logic

### Code Quality
- Refactor code structure (preserving exact output)
- Improve TypeScript types
- Add comments and documentation
- Fix linting errors
- Optimize performance

### Functionality (Non-UI)
- Add new features that don't change existing UI
- Improve data normalization
- Enhance API responses
- Add utility functions

## When UI Changes Are Requested

If the user explicitly asks for UI modifications:

1. **Confirm the scope**: Understand exactly what UI changes are desired
2. **Show a plan**: Summarize what will change before implementing
3. **Preserve functionality**: Ensure existing features continue to work
4. **Test thoroughly**: Verify the changes don't break existing behavior

## Examples

### ❌ Don't Do This (Without Permission)
```
User: "Fix the error handling"
Agent: *Changes button text from "Convert" to "Submit"* ❌
```

### ✅ Do This Instead
```
User: "Fix the error handling"
Agent: *Improves error handling logic without changing UI* ✅
```

### ✅ This Is Fine
```
User: "Update the button text to say 'Submit'"
Agent: *Changes button text as requested* ✅
```

## Recent Context

A previous commit (ed8cca35) made unwanted UI changes including:
- Logo size and capitalization changes
- Header text modifications
- Button text changes
- Layout restructuring
- Footer additions

These changes were reverted. The current UI should be preserved unless explicitly requested to change.

## Questions?

When in doubt:
1. Ask the user if UI changes are desired
2. Show what you plan to change
3. Get confirmation before proceeding
