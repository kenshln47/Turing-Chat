# Original User Request



## Initial Request — 2026-06-13T08:35:34Z



# Teamwork Project Prompt — Draft



> Status: Ready for launch — awaiting user approval

> Goal: Craft prompt → get user approval → delegate to teamwork_preview



Implement robust Markdown rendering and code syntax highlighting within the `@turing-chat/react` UI components.



Working directory: f:/code/idont know

Integrity mode: development



## Requirements



### R1. Render Markdown Content

Modify the `MessageBubble` component (or create a sub-component) inside `packages/react` to parse and render Markdown text correctly using `react-markdown` instead of displaying raw text.



### R2. Add Syntax Highlighting

Use `react-syntax-highlighter` to provide rich syntax highlighting for any code blocks parsed by `react-markdown`.



### R3. Add "Copy Code" Functionality

Inject a "Copy Code" button in the header of each rendered code block. The button should visually indicate success upon clicking and copy the underlying code string to the user's clipboard.



## Acceptance Criteria



### Functional

- [ ] `packages/react/package.json` includes the necessary dependencies (`react-markdown`, `react-syntax-highlighter`, and their types).

- [ ] AI assistant messages that contain markdown (e.g., headers, lists, bold text) render as proper HTML elements.

- [ ] Code blocks render using `react-syntax-highlighter`.

- [ ] The "Copy Code" button successfully writes the code snippet to the clipboard.



### Verification

- [ ] The entire monorepo builds successfully (`pnpm build`).

- [ ] The `examples/nextjs-chat` application starts successfully and visual inspection/testing of the UI confirms markdown and the copy button function properly.

