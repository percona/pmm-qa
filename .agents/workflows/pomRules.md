---
description: Steps to create POM
---

## Creating a new POM:

# STRICT Rules
--------------------------
- Do not reference any files when creating a POM.
- Capture DOM once. Do not repeat.
- Prefer locators in this order:
   - getByTestId -> getByRole -> getByPlaceHolder.
- If element in iframe use grafanaIframe().

# POM rules:
--------------------------
- Path: e2e_tests/pages/[pageName].page.ts
- Import pmmTest from @fixtures/pmmTest
- Class extends BasePage
- Properties order:
  - url, builders, buttons, elements, inputs, messages
- All locators as class properties
- Arrow functions for methods
- Use pmmTest.step to wrap steps wherever necessary inside methods.

# Template
--------------------
import BasePage from './base.page';
import pmmTest from '@fixtures/pmmTest;

export default class TemplatePage extends BasePage {
  builders = {};
  buttons = {};
  elements = {};
  inputs = {};
  messages = {};

Do not re-scan DOM after writing POM.
Do not explain after creating POM. Just say `Done`.