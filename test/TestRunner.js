sap.ui.require([
	"jquery.sap.global",
	"sap/ui/test/gherkin/opa5TestHarness",
	"testrunner/TestSteps",
	"testrunner/OPAPageConfirmCard"
], function ($, opa5TestHarness, TestSteps) {
	"use strict";

	opa5TestHarness.test({
		featurePath: "testrunner.ConfirmCard",
		steps: TestSteps
	});

});