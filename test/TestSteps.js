sap.ui.define([
	"jquery.sap.global",
	"sap/ui/test/gherkin/StepDefinitions",
	"sap/ui/test/Opa5",
	"sap/ui/test/actions/Press",
	"sap/ui/test/actions/EnterText"
], function ($, StepDefinitions, Opa5, Press, EnterText) {
	"use strict";

	var oOpa5 = new Opa5();

	var Steps = StepDefinitions.extend("GherkinWithOPA5.Steps", {

		//register steps
		init: function () {

			//start application
			this.register(/^I have started the app$/i, function () {
				oOpa5.iStartMyAppInAFrame(sap.ui.require.toUrl("pnp/blockandreplace/webapp/index.html"));
			});

			//check attributes for card confirm have rendered
			this.register(/^I can see attributes for card confirm$/i, function () {
				oOpa5.waitFor({
					controlType: "sap.m.Input",
					errorMessage: "Couldn't see input fields to make entries for card confirm"
				});
			});

			//enter firstname, surname, e-mail, mobile number and ID
			this.register(/^I enter (\S+), (\S+), (\S+), (\S+)$/i, function (sFirstName, sSurName, sMobileNumber, sIDNumber, Given, When, Then) {
				Given.onCardConfirm.iInputFirstName(sFirstName);
				Given.onCardConfirm.iInputSurname(sSurName);
				Given.onCardConfirm.iInputMobilePhoneNumber(sMobileNumber);
				Given.onCardConfirm.iInputIDNumber(sIDNumber);
			});

			//click on 'next step' button
			this.register(/^I click on the next step button$/i,
				function (Given, When, Then) {
					When.onCardConfirm.iClickOnNextStep();
				});

			//I see a loyalty card for action
			this.register(/^I see a loyalty card for action$/i,
				function (Given, When, Then) {
					Then.onCardConfirm.iCanSeeACardForAction();
				});

		},

		//close the test results log
		closeApplication: function () {
			$.sap.log.info("Closing application");
		}

	});

	//module API
	return Steps;

});