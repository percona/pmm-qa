---
name: codeceptjs-migration
description: AIOnly CodeceptJS->Playwright migration+post-migration audit.
---

# CodeceptJS->PlaywrightAI

MODE:AIOnly;Output<=8Lines!UserRequestsDetails(DoDReportExemptFrom8LineLimit).
REF:ActualCodeceptSourceUnder`codeceptjs-e2e/`=SourceOfTruth;MandatoryPostMigrationSideBySideAudit.

## Scope

Folders:`tests/<category>/*_test.js`->`e2e_tests/tests/<category>/*.test.ts`.
POMs:`tests/pages/`->`e2e_tests/pages/<category>/*.page.ts`.
APIs:`tests/pages/api/`->`e2e_tests/api/*.api.ts`.
Aliases:`@fixtures/*`,`@helpers/*`,`@pages/*`,`@api/*`,`@components/*`,`@interfaces/*`.
LoadThis:`references/mappings.md`+`references/examples-test.md`+`references/examples-pom.md`;ReadTheActualCodeceptSourceTest+ItsPOMs/CustomStepsWhenMigratingOrAuditing.

## Rules

OmitSkippedOnly?SkippedANDCommentedOut.
MigratedTestsNoComments.
Hooks:`Before`->`pmmTest.beforeEach`;`After`->`pmmTest.afterEach`.
DataDriven->TSArray+`for...of`;InjectLoopVarsIntoTitleString.
Tags->PreserveExactInTitle:`pmmTest('Title @tag',...)`.
Retries->DoNotMigrate`.retry(N)`;CIHandles.
MirrorOriginalLogic/Flow/AssertionsStrictly;DoNotInventCoverage.
BestFitTarget:BeforeCreatingAnyNewPlaywrightTestFile,ReadSourceBehavior+`context.md`§4Inventory;PlaceScenariosInExisting`e2e_tests`FileWhenPage/Feature/Hook/FixtureMatch(e.g.helpPageScenarios→`helpCenter.test.ts`,Nav→`navigation.test.ts`).CreateNew`*.test.ts`OnlyWhenNoSuitableFileExists;RecordActualTargetInTracker.
SourceRenameOnDone:AfterLiveRunPASS,`git mv``codeceptjs-e2e/tests/<path>/<name>_test.js`→`<name>_migrated.js`(SameDir).CodeceptCIUses`tests/**/*_test.js`(`pr.codecept.js`);`_migrated.js`ExcludedFromWorkflows.KeepOriginalAsReference.
InstructionsBranch=`PMM-7-codeceptjs-migration`(ReadTracker+Skills;PushTracker+DocsHere).PRBase=`main`.PRScope=`e2e_tests/**`+CodeceptRenameOnly;No`.cursor/**`InTestPRs.BranchMigratePRsFrom`main`NotPMM-7.

## File Mutation Rules

PreferEditOverWrite:NEVERUse`Write`OnExistingPOM,Helper,OrTestFileToAddFunctionality.Use`Edit`ToSurgicallyInsertNewMembers,Methods,OrProperties.
PreservationAudit:BeforeCompletingAFileUpdate,VerifyThatStandaloneProperties(Constants,ErrorMessages,OrConfigStrings)ThatWereInTheOriginalFileAreStillPresent.
NoAccidentalSimplification:EnsureExistingMethodsAreNotReplacedByASimplerVersionUnlessTheMigrationExplicitlyRequiresALogicChange.
DiffVerification:AfterAnyMultiLine`Edit`,VerifyTheSurroundingContextToEnsureTheFileStructure(Brackets,Imports,ClassDefinitions)RemainsIntact.
ReadImmediateEdit:AlwaysReadTargetBlockImmediatelyBeforeEditToAvoidNewline/IndentationMismatches.
UseAnchorStrings:TargetUniqueSingleLines(e.g.PropertyStart)ToMinimizeMatchFailures.
SafeMergeFallback:IfEditFailsTwice->ReadEntireFile->MergeLogic->WriteEntireFile->ReadVerify.


## Custom Step Resolution

NoInlining:DoNotInlineLogicOf`custom_steps.js`IntoTestFiles.
Mapping:MapCustomStepsToTheirNewEquivalentsIn`@helpers`Or`@components`.
Discovery:IfCustomStepNotIn`mappings.md`,Read`codeceptjs-e2e/tests/custom_steps.js`ToDetermineLogicBeforeMigrating.

## Polling & Wait Logic

DeleteManualLoops:ReplaceManualWhileLoops(e.g.`asyncWaitFor`,`verifyInvisible`)WithPlaywrightNativeAssertions.
`verifyInvisible`->`expect(locator).toBeHidden({timeout})`.
`asyncWaitFor`->`expect.poll(async()->{...},{timeout})`.

## POM/Locators

URLsInPOMOnly.
LocatorsUse:`getByTestId`,`getByRole`,`locator`;`$foo`->`getByTestId('foo')`.
`locate().find()`->Chained`.locator()`.
UseExisting`e2e_tests`POMShape:`urls`,`elements`,`buttons`,`inputs`,etc.
RegisterNewPOMFixturesIn`pmmTest.ts`.
POMsExtend`BasePage`.
BrokenLocatorFix:TraceOnFailureFirst(`npx playwright show-trace`);MCPFallbackOnlyIfTraceInsufficient(SharedDocsUnder`.agents/workflows/`:pmmLogin+mcpRules);PreserveSameElementSemantics.

## API/Waits

APIPaths->`e2e_tests/helpers/apiEndpoints.ts`;APIClasses->`e2e_tests/api/*.api.ts`;RegisterIn`e2e_tests/api/api.ts`.
PreferAutoWait. Explicit`I.wait()`Only->TimeoutsEnum(e.g.`Timeouts.TEN_SECONDS`).

## Interactions/Assertions

Input->`locator.clear()`Then`.fill()`;Never`.evaluate()`ToClear.
`I.see`->`toContainText`;`I.seeElement`->`toBeVisible`.

## Lint

ArrowFunctionsOnly;NoTraditional`function`.
NumericSeparators:`30_000`.
FileNamesCamelCase.
No`.skip()`;NoCommentedTests.
ESLintDisableCommentsRequireReason;UseOnlyWhenNeeded.

## Workflow
SkepticalPipeline:
1. Analysis:ReadSourceTest->IdentifyAllCalls->ListCustomSteps.
2. Mapping:Use`references/mappings.md`+`references/examples-test.md`ToMapEveryCallToPlaywrightEquivalent.
3. Implementation:GenerateCodeUsing`references/examples-pom.md`AsArchitecturalGuide.
4. SkepticalAudit:ActAsSkepticalQA->SearchFor3PotentialBugs/LogicLoss->RefuteFindings.
5. FinalDoD:OutputChecklist->Verdict->Report.

## CriticalAuditGate

BehaviorPreservationIsNonNegotiable:MigratedTestMUSTReproduceSourceExactly->SameFlow,Setup/Cleanup(Before/After),EveryAssertion+ItsSemantics,DataDrivenIterations,Tags,LocatorTargets.NoAdded/Removed/Weakened/"Improved"Coverage.NoInventedWaits/Shortcuts.FaithfulMappingImpossible->Stop+ReportInsteadOfApproximate.
BeforeFinalCompareOriginalCodeceptTestVsMigratedPlaywrightLineByLineForBehavior.NotEnoughContext->ReadMoreTargetedFiles.
PASSOnlyWhenNoUnexplainedLogicLoss,NoMissingAssertions,NoChangedSetup/Cleanup,NoLocatorSemanticsDrift.
ConfidenceGate:EmitExplicitConfidence%.DoNotExecute/LiveRunUntilConfidence>95%WithZeroUnexplainedDiscrepancies.<=95%->DoNotRun;IterateMigrationOrReportGaps+Stop.

## Definition of Done (DoD)

AMigrationIsNOTCompleteUntilTheFollowingSequenceIsExplicitlyOutputted:

1. **Audit Checklist**: ALineByLineChecklistMatchingThe`CriticalAuditGate`Criteria.
2. **Verdict**: AClear`PASS`Or`FAIL`BasedOnTheChecklist.
3. **Final Report**: TheStructuredSummaryContaining:
   - Files Changed
   - Validation Run (e.g., "TS Compile: Pass", "Lint: Pass")
   - Discrepancies (Must be "None" for a PASS)
   - Confidence % (Must be >95% before any live run; otherwise Verdict=FAIL/needs-review, do not execute)
     FailureToProvideThisExactSequenceIsAViolationOfTheSkill'sOperationalProtocol.

## Search

TargetedReadsOnly;AvoidRepoWideSearchUnlessTargetUnknown.
