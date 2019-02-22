sap.ui.define([
	"sap/ui/test/Opa5",
	"sap/ui/test/actions/Press",
	"sap/ui/test/actions/EnterText"
], function (Opa5, Press, EnterText, OPABaseClass) {
	"use strict";

	Opa5.createPageObjects({

		//for card confirmation
		onCardConfirm: {

			//actions
			actions: {
				iInputFirstName: function (sFirstName) {
					return this.waitFor({
						id: "inputFirstName",
						viewName: "pnp.blockandreplace.view.BlockReplace",
						actions: new EnterText({
							text: sFirstName
						}),
						errorMessage: "Was not able to find the control with the id inputFirstName"
					});
				},
				iInputSurname: function (sSurname) {
					return this.waitFor({
						id: "inputSurname",
						viewName: "pnp.blockandreplace.view.BlockReplace",
						actions: new EnterText({
							text: sSurname
						}),
						errorMessage: "Was not able to find the control with the id inputSurname"
					});
				},
				iInputMobilePhoneNumber: function (sMobilePhoneNumber) {
					return this.waitFor({
						id: "inputMobileNumber",
						viewName: "pnp.blockandreplace.view.BlockReplace",
						actions: new EnterText({
							text: sMobilePhoneNumber
						}),
						errorMessage: "Was not able to find the control with the id inputMobilePhoneNumber"
					});
				},
				iInputIDNumber: function (sIDNumber) {
					return this.waitFor({
						id: "inputIDNumber",
						viewName: "pnp.blockandreplace.view.BlockReplace",
						actions: new EnterText({
							text: sIDNumber
						}),
						errorMessage: "Was not able to find the control with the id inputIDNumber"
					});
				},
				iClickOnNextStep: function () {
					return this.waitFor({
						id: /wizstepConfirmCard-nextButton/,
						viewName: "pnp.blockandreplace.view.BlockReplace",
						actions: new Press(),
						errorMessage: "Couldn't go to the next step"
					});
				}

			},
			assertions: {
				iCanSeeACardForAction: function () {
					return this.waitFor({
						id: "__tile0",
						success: function (oTile) {
							Opa5.assert.ok(true, "All good");
						},
						errorMessage: "Couldn't see a card for action"
					});
				}
			}
		}
	});
});