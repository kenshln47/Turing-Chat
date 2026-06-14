# E2E Test Suite Readiness: Markdown & Syntax Highlighting



This document details the testing framework setup and E2E test suite written for the `MessageBubble` component in `@turing-chat/react`.



## How to Run the Test Suite



To run the tests, execute the following command from the project root:



```bash

pnpm --filter @turing-chat/react test

```



Or run `pnpm test` inside the `packages/react` directory.



To run the tests in watch mode:



```bash

pnpm --filter @turing-chat/react test:watch

```



## Feature Checklist (N = 3)



The E2E test suite verifies the following three key features:



- [ ] **Markdown Rendering**: Inline elements (bold, italic, inline code) and multi-line structures.

- [ ] **Syntax Highlighting**: Pre/code blocks rendering, language headers, syntax styling.

- [ ] **Copy Code Button**: Clipboard copy behavior, success state updates, legacy browser fallback, and layout alignment.



## Test Distribution by Tier



The test suite consists of **38 test cases** structured across 4 distinct Tiers:



### Tier 1 - Feature Coverage (15 test cases)

- **Markdown Rendering (5)**:

  - Plain text rendering

  - Bold text (`<strong>` tag)

  - Italic text (`<em>` tag)

  - Inline code (`<code>` tag)

  - Consecutive inline formatting

- **Syntax Highlighting (5)**:

  - Basic code block structure (`<pre>` tag)

  - Language tag detection and header display

  - Code content inside `<pre><code>` hierarchy

  - Highlighting styles and custom monospace classes

  - Plain code blocks without language tag

- **Copy Code Button (5)**:

  - Button visibility on non-empty content

  - `navigator.clipboard.writeText` triggers on click

  - Verification of button label/state transition to "Copied!"

  - Timer-based state reversion back to normal after a delay

  - Button exclusion for empty messages



### Tier 2 - Boundary & Corner Cases (15 test cases)

- **Markdown Rendering (5)**:

  - Unmatched formatting markers

  - Empty markers (`****`, `**`) handling without crashing

  - Multi-line rendering with line breaks (`<br>`)

  - Special HTML characters (`<`, `>`, `&`) escaping safety

  - Nested formatting (`***bold italic***`) support

- **Syntax Highlighting (5)**:

  - Empty code blocks

  - Leading/trailing newlines in code blocks

  - Markdown syntax rendering as literal text inside code blocks

  - Language tags with symbols/numbers (e.g. `c++`, `react-jsx`)

  - Extremely large/long code blocks rendering without crash

- **Copy Code Button (5)**:

  - Multiline code copying preservation of indentation and whitespace

  - Legacy fallback using `document.execCommand` when clipboard API is unavailable

  - Clipboard write rejection graceful handling

  - Rapid click handling

  - Role-based position alignment (user vs assistant)



### Tier 3 - Cross-Feature Interactions (3 test cases)

- Prevents rendering of markdown formatting inside a syntax-highlighted code block (literal code)

- Copies raw markdown string instead of rendered HTML representation

- Ensures active streaming state does not interfere with copying or syntax highlighting of already received chunks



### Tier 4 - Real-World Application Scenarios (5 test cases)

- Complex assistant response containing text, python code blocks, and lists

- System instruction rendering with mixed inline code and bold formatting

- Active streaming of code blocks with dynamic updates

- Mixed markdown tables, lists, and code blocks simulating LLM output

- Malformed/unfinished code block segments handling without crashing

