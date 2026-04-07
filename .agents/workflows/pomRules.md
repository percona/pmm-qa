---
description: Steps to create POM
---

# Locators & Discovery

- PREFER existing POM locators/helpers over rediscovery.
- Focus inside Grafana? Use `grafanaIframe()`.
- Priority: `getByTestId` > `getByRole` > `getByLabel` > `getByPlaceholder`.
- AVOID: `nth()`, `first()`, `last()`.
- Missing locators? Do EXACTLY ONE DOM capture pass. Update POM immediately.

# Code Structure

- Path: `e2e_tests/pages/[pageName].page.ts`
- Extend: `BasePage`. Import: `pmmTest` from `@fixtures/pmmTest`.
- Property order: `url`, `builders`, `buttons`, `elements`, `inputs`, `messages`.
- Locators MUST be class properties.
- Methods MUST be arrow functions. Wrap critical actions in `pmmTest.step`.
- Keep methods tightly scoped and logically named.

# Template

```typescript
import BasePage from "./base.page";
import pmmTest from "@fixtures/pmmTest";

export default class TemplatePage extends BasePage {
  url = "";
  builders = {};
  buttons = {};
  elements = {};
  inputs = {};
  messages = {};
}
```

# Hand-off

- DO NOT scan DOM again if the POM handles locators.
- Reply ONLY `Done` when finished. NO extra info.
