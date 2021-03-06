sap.ui.define([
	"pnp/blockandreplace/controller/Base.controller",
	"sap/ui/model/json/JSONModel"
], function (BaseController, JSONModel) {
	"use strict";

	return BaseController.extend("pnp.blockandreplace.controller.BlockReplace", {

		//initialization
		onInit: function () {

			//instantiate view model and set to view
			this.oViewModel = new JSONModel({
				btnContinueWoStatusChangeVisible: false,
				btnToggleCardStatusVisible: false,
				bCardValidationFailed: false,
				btnReplaceCardEnabled: false,
				isOldUI5Version: false,
				bCardConfirmed: false,
				busyDelay: 0,
				busy: false
			});
			this.setModel(this.oViewModel, "ViewModel");

			//get resource bundle
			this.oResourceBundle = this.getResourceBundle();

			//prepare message handling
			this.oMessageStrip = this.byId("msMessageStrip");
			if (this.oMessageStrip) {
				this.oMessageStrip.setVisible(false);
			}

			//attach to display event for survey detail
			this.getRouter().getTarget("BlockReplace").attachDisplay(this.onDisplay, this);

			//initiate interaction with message manager	
			this.oMessageProcessor = new sap.ui.core.message.ControlMessageProcessor();
			this.oMessageManager = sap.ui.getCore().getMessageManager();
			this.oMessageManager.registerMessageProcessor(this.oMessageProcessor);

			//keep track of wizard control
			this.oBlockReplaceWizard = this.getView().byId("wizBlockReplace");

			//keep track of OData model
			this.oLoyaltyModel = this.getOwnerComponent().getModel("LoyaltyModel");
			this.setModel(this.oLoyaltyModel, "LoyaltyModel");

			//indicate whether we're running on old UI5 version
			var oUI5VersionInfo = sap.ui.getVersionInfo();
			if (/^1.[01234]/.test(oUI5VersionInfo.version)) {

				//keep track that app is running on old UI5 version
				this.getModel("ViewModel").setProperty("/isOldUI5Version", true);

				//load one time pin component the old way
				this.loadOneTimePinComponentForOldUI5Version();

			}

		},

		//event handler for view display
		onDisplay: function () {

			//hide message strip 
			this.oMessageStrip.setVisible(false);

			//remove all messages from the message manager
			this.oMessageManager.removeAllMessages();

			//get card confirmation wizard step instance
			var oConfirmCardWizStep = this.getView().byId("wizstepConfirmCard");

			//cancel wizard progress that may exist from previous execution
			this.oBlockReplaceWizard.discardProgress(oConfirmCardWizStep);

			//invalidate card confirm wizard step
			this.oBlockReplaceWizard.invalidateStep(oConfirmCardWizStep);

			//create object with loyalty card query attributes
			var oLoyaltyCardQuery = {
				LoyaltyCardID: "",
				IDNumber: "",
				IDType: ""
			};

			//initialize view model properties
			this.getModel("ViewModel").setProperty("/bCardConfirmed", false);
			this.getModel("ViewModel").setProperty("/bCardValidationFailed", false);
			this.getModel("ViewModel").setProperty("/btnReplaceCardEnabled", false);
			this.getModel("ViewModel").setProperty("/btnScanConfirmCardVisible", true);
			this.getModel("ViewModel").setProperty("/btnScanReplaceCardVisible", true);
			this.getModel("ViewModel").setProperty("/inputReplacementCardIDEnabled", true);
			this.getModel("ViewModel").setProperty("/btnToggleCardStatusVisible", true);
			this.getModel("ViewModel").setProperty("/btnToggleCardStatusEmphasized", true);
			this.getModel("ViewModel").setProperty("/btnContinueWoStatusChangeVisible", false);

			//set loyalty card query model to view
			this.oLoyaltyCardConfirmModel = new JSONModel(oLoyaltyCardQuery);
			this.setModel(this.oLoyaltyCardConfirmModel, "LoyaltyCardConfirmModel");

			//set loyalty card tracker model to view
			this.oLoyaltyCardTrackerModel = new JSONModel({
				"LoyaltyCards": []
			});
			this.setModel(this.oLoyaltyCardTrackerModel, "LoyaltyCardTrackerModel");

			//set card confirmation form to editable
			this.setFormInputControlsEnabled([this.getView().byId("formConfirmCardAttributes")], true);

			//set card confirmation action controls to enabled
			this.setFormActionControlsEnabled([this.getView().byId("formConfirmCardAttributes")], true);

			//set SA ID type as selected ID type
			this.getView().byId("cboxIdentificationType").setSelectedKey("Z00002");

			//set replacement card ID to null
			this.getView().byId("inputReplacementCardID").setValue(null);

			//bind view to object instance
			this.getView().bindElement({
				model: "LoyaltyCardConfirmModel",
				path: "/"
			}, {});

		},

		//event handler for card confirmation form liveChange event
		onCardConfirmLiveChange: function (oEvent) {

			//hidde message strip as it might have be visible after card action
			this.oMessageStrip.setVisible(false);

			//get card confirmation wizard step instance
			var oConfirmCardWizStep = this.getView().byId("wizstepConfirmCard");

			//previously confirmed card attributes are being invalidated
			if (this.getModel("ViewModel").getProperty("/bCardConfirmed")) {
				this.getModel("ViewModel").setProperty("/bCardValidationFailed", true);
				this.oBlockReplaceWizard.invalidateStep(oConfirmCardWizStep);
			}

			//cancel wizard progress
			if (this.oBlockReplaceWizard.getProgress() > 1) {
				this.oBlockReplaceWizard.discardProgress(oConfirmCardWizStep);
			}

			//invalidate card confirm wizard step where incorrect input present
			if (this.hasIncorrectInput([this.getView().byId("formConfirmCardAttributes")], oEvent.getSource())) {
				this.oBlockReplaceWizard.invalidateStep(oConfirmCardWizStep);
			}

			//confirm card against backend when all input correct, not previously failed to validate and ID type not passport
			if (!this.hasIncorrectInput([this.getView().byId("formConfirmCardAttributes")], oEvent.getSource()) &&
				this.getView().byId("cboxIdentificationType").getSelectedKey() !== "Z00003" &&
				!this.getModel("ViewModel").getProperty("/bCardValidationFailed")) {
				this.confirmCard();
			}

		},

		/**
		 * Checks if there is any wrong inputs that can not be saved.
		 * @private
		 */
		hasInvalidInput: function (aForms, oControl) {

			//local data declaration
			var aInvalidFormFields = [];

			//validate form input
			aForms.forEach(function (oForm) {

				//get all form fields
				var aFormFields = this.getFormInputFields(oForm);

				//reduce validation to requested control where applicable
				if (oControl) {
					var aFormFieldsTmp = aFormFields;
					aFormFields = [];
					for (var i = 0; i < aFormFieldsTmp.length; i = i + 1) {
						if (aFormFieldsTmp[i].oControl === oControl) {
							aFormFields.push(aFormFieldsTmp[i]);
							break;
						}
					}

				}

				//card confirm form
				if (/formConfirmCardAttributes/.test(oForm.getId())) {

					//for each field on this form
					aFormFields.forEach(function (oFormField) {

						//by field
						switch (oFormField.sId) {

							//loyalty card ID
						case "inputLoyaltyCardID":

							//check whether entered loyalty card number is valid
							if (!this.isValidLoyaltyCardID(oFormField.oControl.getValue())) {
								oFormField.oControl.setValueState(sap.ui.core.ValueState.Error);
								oFormField.oControl.setValueStateText(this.oResourceBundle.getText("messageInvalidInputLoyaltyCardID"));
								oFormField.sInvalidInputMessage = this.oResourceBundle.getText("messageInvalidInputDetected");
								aInvalidFormFields.push(oFormField);
							}
							break;

							//phone number
						case "inputMobileNumber":

							//check telephone number contains only digits after stripping all non numeric content
							if (!this.isValidPhoneNumber(oFormField.oControl.getValue())) {
								oFormField.oControl.setValueState(sap.ui.core.ValueState.Error);
								oFormField.oControl.setValueStateText(this.oResourceBundle.getText("messageInvalidInputPhoneNumber"));
								oFormField.sInvalidInputMessage = this.oResourceBundle.getText("messageInvalidInputDetected");
								aInvalidFormFields.push(oFormField);
							}
							break;

							//SA ID number
						case "inputIDNumber":

							//only if ID type is SA ID number
							if (this.getView().byId("cboxIdentificationType").getSelectedKey() === "Z00002") {

								//check entered number is a SA ID number
								if (!this.isValidSAIDNumber(oFormField.oControl.getValue())) {
									oFormField.oControl.setValueState(sap.ui.core.ValueState.Error);
									oFormField.oControl.setValueStateText(this.oResourceBundle.getText("messageInvalidInputSAIDNumber"));
									oFormField.sInvalidInputMessage = this.oResourceBundle.getText("messageInvalidInputDetected");
									aInvalidFormFields.push(oFormField);
								}

							}

							//only if ID type is passport number
							if (this.getView().byId("cboxIdentificationType").getSelectedKey() === "Z00003") {

								//check entered number is a valid passport number
								if (!this.isValidPassportNumber(oFormField.oControl.getValue())) {
									oFormField.oControl.setValueState(sap.ui.core.ValueState.Error);
									oFormField.oControl.setValueStateText(this.oResourceBundle.getText("messageInvalidInputPassportNumber"));
									oFormField.sInvalidInputMessage = this.oResourceBundle.getText("messageInvalidInputDetected");
									aInvalidFormFields.push(oFormField);
								}

							}
							break;

							//email address
						case "inputEMailAddress":

							//check whether e-mail account entered is valid
							if (!this.isValidEMailAddress(oFormField.oControl.getValue())) {
								oFormField.oControl.setValueState(sap.ui.core.ValueState.Error);
								oFormField.oControl.setValueStateText(this.oResourceBundle.getText("messageInvalidInputEMailAddress"));
								oFormField.sInvalidInputMessage = this.oResourceBundle.getText("messageInvalidInputDetected");
								aInvalidFormFields.push(oFormField);
							}
							break;

							//unvalidated fields
						default:
							break;
						}

					}.bind(this));

				}

				//card replace form
				if (/formReplaceCard/.test(oForm.getId())) {

					//for each field on this form
					aFormFields.forEach(function (oFormField) {

						//by field
						switch (oFormField.sId) {

							//replacement card ID
						case "inputReplacementCardID":

							//check whether entered replacement card number is valid
							if (!this.isValidLoyaltyCardID(oFormField.oControl.getValue())) {
								oFormField.oControl.setValueState(sap.ui.core.ValueState.Error);
								oFormField.oControl.setValueStateText(this.oResourceBundle.getText("messageInvalidInputLoyaltyCardID"));
								oFormField.sInvalidInputMessage = this.oResourceBundle.getText("messageInvalidInputDetected");
								aInvalidFormFields.push(oFormField);
							}

							//ensure replacement card and blocked card are not identical
							var oBlockedCard = this.getView().getBindingContext("LoyaltyModel").getObject();
							if (oBlockedCard.LoyaltyCardID === oFormField.oControl.getValue()) {
								oFormField.oControl.setValueState(sap.ui.core.ValueState.Error);
								oFormField.oControl.setValueStateText(this.oResourceBundle.getText("messageReplacementCardIDSameAsBlocked"));
								oFormField.sInvalidInputMessage = this.oResourceBundle.getText("messageInvalidInputDetected");
								aInvalidFormFields.push(oFormField);
							}
							break;

							//unvalidated fields
						default:
							break;
						}

					}.bind(this));

				}

			}.bind(this));

			//feedback to caller
			return aInvalidFormFields;

		},

		/**
		 * Checks for error messages bound in model
		 * @private
		 */
		hasErrorMessages: function () {

			//to be implemented in extension controller derived from base controller
			return false;

		},

		//confirm card against backend
		confirmCard: function () {

			//hide message strip 
			this.oMessageStrip.setVisible(false);

			//remove all messages from the message manager
			this.oMessageManager.removeAllMessages();

			//set view to busy
			this.getModel("ViewModel").setProperty("/isViewBusy", true);

			//get confirm card wizard step
			var oConfirmCardWizStep = this.getView().byId("wizstepConfirmCard");

			//get provided card attributes for confirmation
			var oLoyaltyCardConfirm = this.getView().getBindingContext("LoyaltyCardConfirmModel").getObject();

			//confirm card with provided attributes
			this.getModel("LoyaltyModel").callFunction("/confirmCard", {

				//url paramters
				urlParameters: {
					"LoyaltyCardID": oLoyaltyCardConfirm.LoyaltyCardID,
					"IDNumber": this.getView().byId("inputIDNumber").getValue(),
					"IDType": oLoyaltyCardConfirm.IDType
				},

				//on receipt of card confirmation results
				success: function (oData, oResponse) {

					//require further user decision where more than one card
					if (oData.results.length > 1) {

						//adopt array of cards to card confirmation model
						this.getModel("LoyaltyCardConfirmModel").setProperty("/LoyaltyCards", oData.results);

						//create a popover to select a card from the list of cards
						var oCardSelectPopover = sap.ui.xmlfragment("pnp.blockandreplace.fragment.CardSelectPopover", this);
						oCardSelectPopover.attachAfterClose(function () {
							oCardSelectPopover.destroy();
						});
						this.getView().addDependent(oCardSelectPopover);

						//keep track of the fact that card details are confirmed
						this.getModel("ViewModel").setProperty("/bCardConfirmed", true);

						//view is no longer busy
						this.getModel("ViewModel").setProperty("/isViewBusy", false);

						// delay because addDependent will do a async rerendering 
						var oInputLoyaltyCardID = this.getView().byId("inputLoyaltyCardID");
						jQuery.sap.delayedCall(0, this, function () {
							oCardSelectPopover.openBy(oInputLoyaltyCardID);
						});

						//no further processing here
						return;

					}

					//set confirmed loyalty card
					this.setConfirmedLoyaltyCard(oData.results[0]);

				}.bind(this),

				//error callback function
				error: function (oError) {

					//invalidate card confirm step
					this.oBlockReplaceWizard.invalidateStep(oConfirmCardWizStep);

					//discard wizard progress
					this.oBlockReplaceWizard.discardProgress(oConfirmCardWizStep);

					//render OData error response
					this.renderODataErrorResponse(oError, "messageCardConfirmFailed");

					//keep track of the fact that card details are confirmed
					this.getModel("ViewModel").setProperty("/bCardConfirmed", false);

					//keep track of the fact that card validation has succeeded
					this.getModel("ViewModel").setProperty("/bCardValidationFailed", true);

					//set view to no longer busy
					this.getModel("ViewModel").setProperty("/isViewBusy", false);

				}.bind(this)

			});

		},

		//set confirmed loyalty card
		setConfirmedLoyaltyCard: function (oLoyaltyCard) {

			//local data declaration
			var aMeansOfCommunication = [];

			//get confirm card wizard step
			var oConfirmCardWizStep = this.getView().byId("wizstepConfirmCard");

			//validate card confirm wizard step
			this.oBlockReplaceWizard.validateStep(oConfirmCardWizStep);

			//keep track of the fact that card details are confirmed
			this.getModel("ViewModel").setProperty("/bCardConfirmed", true);

			//keep track of the fact that card validation has succeeded
			this.getModel("ViewModel").setProperty("/bCardValidationFailed", false);

			//adopt selected card into UI
			this.getModel("LoyaltyCardConfirmModel").setProperty("/LoyaltyCardID", oLoyaltyCard.LoyaltyCardID);

			//keep track of loyalty member personal details
			this.getModel("LoyaltyCardConfirmModel").setProperty("/MemberName", oLoyaltyCard.MemberName);
			this.getModel("LoyaltyCardConfirmModel").setProperty("/MemberSurname", oLoyaltyCard.MemberSurname);

			//set value state of loyalty card ID input to none
			this.getView().byId("inputLoyaltyCardID").setValueState(sap.ui.core.ValueState.None);

			//create object path for confirmed loyalty card
			var sLoyaltyCardPath = "/" + this.getModel("LoyaltyModel").createKey("LoyaltyCards", {
				LoyaltyCardID: oLoyaltyCard.LoyaltyCardID
			});

			//set binding context to confirmed loyalty card
			this.oLoyaltyModel.createBindingContext(sLoyaltyCardPath, null, {}, function (oLoyaltyCardContext) {

				//set new binding context
				this.getView().setBindingContext(oLoyaltyCardContext, "LoyaltyModel");

				//get access to loyalty card object
				oLoyaltyCard = oLoyaltyCardContext.getObject();

				//prepare view for appropriate card action
				switch (oLoyaltyCard.CardStatus) {

					//card is currently 'Active'
				case "Active":
					this.getModel("ViewModel").setProperty("/toggleCardStatusButtonText", this.getResourceBundle().getText("textButtonBlockCard"));
					this.getModel("ViewModel").setProperty("/btnContinueWoStatusChangeVisible", false);
					break;

					//card is currently 'Blocked'
				case "Blocked":
					this.getModel("ViewModel").setProperty("/toggleCardStatusButtonText", this.getResourceBundle().getText("textButtonUnblockCard"));
					this.getModel("ViewModel").setProperty("/btnContinueWoStatusChangeVisible", true);
					break;

				}

				//construct array of means of communication to deliver OTP
				if (oLoyaltyCard.MobilePhoneNumber) {
					aMeansOfCommunication.push({
						"MoCID": "0",
						"MoCValue": oLoyaltyCard.MobilePhoneNumber,
						"MoCValueText": "SMS to " + oLoyaltyCard.MobilePhoneNumber
					});
				}

				//eMail address is available for OTP delivery
				if (oLoyaltyCard.EMailAddress) {
					aMeansOfCommunication.push({
						"MoCID": "1",
						"MoCValue": oLoyaltyCard.EMailAddress,
						"MoCValueText": "eMail to " + oLoyaltyCard.EMailAddress
					});
				}

				//no further processing here if no means of communication available
				if (aMeansOfCommunication.length === 0) {

					//invalidate card confirm wizard step
					this.oBlockReplaceWizard.invalidateStep(oConfirmCardWizStep);

					//message handling: missing means of communication
					this.sendStripMessage(this.getResourceBundle().getText("messageMissingMoCForOTPDelivery"), sap.ui.core.MessageType.Warning);

					//view is no longer busy
					this.getModel("ViewModel").setProperty("/isViewBusy", false);

					//no further processing here
					return;

				}

				//provide input to One Time Pin component
				if (this.oOneTimePinComponent) {

					//initialize One Time Pin delivery
					this.oOneTimePinComponent.initializeForOTPDelivery();

					//set means of communication how to deliver OTP
					this.oOneTimePinComponent.setMeansOfCommunication(aMeansOfCommunication);

					//set One Time Purpose
					this.oOneTimePinComponent.setOTPPurpose("Block & Replace");

				}

				//view is no longer busy
				this.getModel("ViewModel").setProperty("/isViewBusy", false);

				//go to verify One Time Pin wizard step
				this.oBlockReplaceWizard.nextStep();

			}.bind(this));

		},

		//on completion of card confirmation wizard step
		completeWizstepConfirmCard: function (oEvent) {

			//set card confirmation form to no longer editable
			this.setFormInputControlsEnabled([this.getView().byId("formConfirmCardAttributes")], false);

			//set card confirmation action controls to no longer enabled
			this.setFormActionControlsEnabled([this.getView().byId("formConfirmCardAttributes")], false);

			//set barcode scanner button to no longer visible
			this.getModel("ViewModel").setProperty("/btnScanConfirmCardVisible", false);

		},

		//on completion of card action wizard step
		completeWizstepCardAction: function (oEvent) {

			//set status toggle button to invisible
			this.getModel("ViewModel").setProperty("/btnToggleCardStatusVisible", false);
			this.getModel("ViewModel").setProperty("/btnContinueWoStatusChangeVisible", false);

			//hide message strip as it might have be visible after card action
			this.oMessageStrip.setVisible(false);

		},

		//on completion of replace card wizard step
		completeWizstepReplaceCard: function (oEvent) {

			//set card replace form to no longer editable
			this.setFormInputControlsEnabled([this.getView().byId("formReplaceCard")], false);

			//set card replace action controls to no longer enabled
			this.setFormActionControlsEnabled([this.getView().byId("formReplaceCard")], false);

			//set barcode scanner button for replace card to no longer visible
			this.getModel("ViewModel").setProperty("/btnScanReplaceCardVisible", false);

		},

		//continue without card status change
		continueWithoutCardStatusChange: function () {

			//get card action wizard step instance
			var oCardActionWizStep = this.getView().byId("wizstepCardAction");

			//set 'Replace card' as next step
			oCardActionWizStep.setNextStep(this.getView().byId("wizstepReplaceCard"));

			//get loyalty card acted on in current state
			var oLoyaltyCard = this.getView().getBindingContext("LoyaltyModel").getObject();

			//track this loyalty card
			var oLoyaltyCardTrackerModel = this.getModel("LoyaltyCardTrackerModel");
			oLoyaltyCardTrackerModel.setProperty("/LoyaltyCards", [oLoyaltyCard]);

			//validate card action wizard step
			this.oBlockReplaceWizard.validateStep(oCardActionWizStep);

			//go to verify One Time Pin wizard step
			this.oBlockReplaceWizard.nextStep();

		},

		//toggle loyalty card status
		toggleCardStatus: function () {

			//get loyalty card instance
			var oLoyaltyCard = this.getView().getBindingContext("LoyaltyModel").getObject();

			//depending on current status
			switch (oLoyaltyCard.CardStatus) {

				//card is currently 'Active'
			case "Active":

				//update card to 'Blocked' status
				this.updateCardStatus("Blocked");
				break;

				//card is currently 'Blocked'	
			case "Blocked":

				//update card to 'Active' status
				this.updateCardStatus("Active");
				break;
			}

		},

		//block loyalty card
		updateCardStatus: function (sCardStatus) {

			//remove all messages from the message manager
			this.oMessageManager.removeAllMessages();

			//set view to busy
			this.getModel("ViewModel").setProperty("/isViewBusy", true);

			//get card action wizard step
			var oCardActionWizStep = this.getView().byId("wizstepCardAction");

			//get binding context
			var oLoyaltyCard = this.getView().getBindingContext("LoyaltyModel").getObject();

			//Create object path for an existing OData model instance
			var sLoyaltyCardPath = "/" + this.getModel("LoyaltyModel").createKey("LoyaltyCards", {
				LoyaltyCardID: oLoyaltyCard.LoyaltyCardID
			});

			//set loyalty card to blocked
			this.oLoyaltyModel.setProperty(sLoyaltyCardPath + '/CardStatus', sCardStatus);

			//submit changes made to model content
			this.oLoyaltyModel.submitChanges({

				//update success handler
				success: function (oData, oResponse) {

					//inspect batchResponses for errors and visualize
					if (this.hasODataBatchErrorResponse(oData.__batchResponses)) {

						//reset loyalty card status change
						this.getModel("LoyaltyModel").resetChanges();

						//no further processing
						return;

					}

					//set status toggle button to invisible
					this.getModel("ViewModel").setProperty("/btnToggleCardStatusVisible", false);
					this.getModel("ViewModel").setProperty("/btnContinueWoStatusChangeVisible", false);

					//get loyalty card acted on in current state
					oLoyaltyCard = this.getView().getBindingContext("LoyaltyModel").getObject();

					//track this loyalty card
					var oLoyaltyCardTrackerModel = this.getModel("LoyaltyCardTrackerModel");
					oLoyaltyCardTrackerModel.setProperty("/LoyaltyCards", [oLoyaltyCard]);

					//set next action and next step
					switch (sCardStatus) {

						//card was activated, proceed to finish	
					case "Active":

						//set 'Replace card' as next step
						oCardActionWizStep.setNextStep(this.getView().byId("wizstepFinishUp"));

						break;

						//card was blocked, proceed to replace
					case "Blocked":

						//set 'Replace card' as next step
						oCardActionWizStep.setNextStep(this.getView().byId("wizstepReplaceCard"));

						break;
					}

					//validate card action wizard step
					this.oBlockReplaceWizard.validateStep(oCardActionWizStep);

					//message handling: updated successfully
					this.sendStripMessage(this.getResourceBundle().getText("messageCardUpdateSuccessful"), sap.ui.core.MessageType.Success);

					//set view to no longer busy
					this.getModel("ViewModel").setProperty("/isViewBusy", false);

					//go to next ('finish up' or 'replace card') wizard step 
					this.oBlockReplaceWizard.nextStep();

				}.bind(this),

				//error handler callback function
				error: function (oError) {

					//reset loyalty card status change
					this.getModel("LoyaltyModel").resetChanges();

					//render OData error response
					this.renderODataErrorResponse(oError, "messageCardUpdateFailed");

				}.bind(this)

			});

		},

		//replace loyalty card
		replaceCard: function () {

			//remove all messages from the message manager
			this.oMessageManager.removeAllMessages();

			//set view to busy
			this.getModel("ViewModel").setProperty("/isViewBusy", true);

			//get loyalty card to be replaced
			var oLoyaltyCard = this.getView().getBindingContext("LoyaltyModel").getObject();

			//get replace card wizard step
			var oReplaceCardWizStep = this.getView().byId("wizstepReplaceCard");

			//keep track of 'this'
			var that = this;

			//confirm card is eligible to be replacement card
			this.getModel("LoyaltyModel").callFunction("/replaceCard", {

				//url paramters
				urlParameters: {
					"LoyaltyCardID": oLoyaltyCard.LoyaltyCardID,
					"ReplacementCardID": this.getView().byId("inputReplacementCardID").getValue()
				},

				//on receipt of card confirmation results
				success: function (oData, oResponse) {

					//inspect batchResponses for errors and visualize
					if (this.hasODataBatchErrorResponse(oData.__batchResponses)) {

						//no further processing here
						return;

					}

					//Create object path for OData model instance of replacement card
					var sLoyaltyCardPath = "/" + this.getModel("LoyaltyModel").createKey("LoyaltyCards", {
						LoyaltyCardID: this.getView().byId("inputReplacementCardID").getValue()
					});

					//get currently tracked loyalty cards
					var oLoyaltyCardTrackerModel = this.getModel("LoyaltyCardTrackerModel");
					var aTrackedLoyaltyCards = oLoyaltyCardTrackerModel.getProperty("/LoyaltyCards");

					//indicate card replacement relationship
					aTrackedLoyaltyCards[0].isPredecessor = true;

					//Get OData model instance of replacement card in current state
					oLoyaltyCard = this.getModel("LoyaltyModel").getProperty(sLoyaltyCardPath);

					//add replaced card to tracked cards model
					aTrackedLoyaltyCards.push(oLoyaltyCard);
					oLoyaltyCardTrackerModel.setProperty("/LoyaltyCards", aTrackedLoyaltyCards);

					//disable 'replace card' button and replacement card input field
					this.getModel("ViewModel").setProperty("/btnReplaceCardEnabled", false);
					this.getModel("ViewModel").setProperty("/inputReplacementCardIDEnabled", false);

					//validate card action wizard step
					this.oBlockReplaceWizard.validateStep(oReplaceCardWizStep);

					//message handling: updated successfully
					this.sendStripMessage(this.getResourceBundle().getText("messageCardUpdateSuccessful"), sap.ui.core.MessageType.Success);

					//set view to no longer busy
					this.getModel("ViewModel").setProperty("/isViewBusy", false);

					//go to Finish Up wizard step
					this.oBlockReplaceWizard.nextStep();

				}.bind(this),

				//error callback function
				error: function (oError) {

					//render OData error response
					this.renderODataErrorResponse(oError, "messageCardUpdateFailed");

				}.bind(this)

			});

		},

		//user chooses to finsih with replace
		onPressDoneWithoutReplaceButton: function () {

			//remove all messages from the message manager
			this.oMessageManager.removeAllMessages();

			//get replace card wizard step
			var oReplaceCardWizStep = this.getView().byId("wizstepReplaceCard");

			//disable 'replace card' button and replacement card input field
			this.getModel("ViewModel").setProperty("/btnReplaceCardEnabled", false);
			this.getModel("ViewModel").setProperty("/inputReplacementCardIDEnabled", false);

			//validate card action wizard step
			this.oBlockReplaceWizard.validateStep(oReplaceCardWizStep);

			//go to Finish Up wizard step
			this.oBlockReplaceWizard.nextStep();

		},

		//on change of requested next action
		onNextActionChange: function (oEvent) {

			//get card action wizard step
			var oCardActionWizStep = this.getView().byId("wizstepCardAction");

			//depending on selected next action
			switch (oEvent.getParameter("selectedItem").getKey()) {

				//replace card
			case "1":

				//set 'Replace card' as next step
				oCardActionWizStep.setNextStep(this.getView().byId("wizstepReplaceCard"));
				break;

				//finish up
			case "2":

				//set 'Finish up' as next step
				oCardActionWizStep.setNextStep(this.getView().byId("wizstepFinishUp"));
				break;

			}

		},

		//event handler for replacement card ID entry
		onReplaceCardLiveChange: function (oEvent) {

			//hidde message strip as it might have be visible after card action
			this.oMessageStrip.setVisible(false);

			//get card replace wizard step instance
			var oReplaceCardWizStep = this.getView().byId("wizstepReplaceCard");

			//invalidate card replace wizard step where incorrect input present
			if (this.hasIncorrectInput([this.getView().byId("formReplaceCard")], oEvent.getSource())) {
				this.oBlockReplaceWizard.invalidateStep(oReplaceCardWizStep);
			}

			//check replacement card input and toggle enabled state of 'replace card' button
			if (!this.hasIncorrectInput([this.getView().byId("formReplaceCard")], oEvent.getSource())) {
				this.getModel("ViewModel").setProperty("/btnReplaceCardEnabled", true);
			} else {
				this.getModel("ViewModel").setProperty("/btnReplaceCardEnabled", false);
			}

		},

		//on completion of block and replace card wizard
		onPressBlockReplaceWizardFinishButton: function () {

			//reset and restart wizard for block and replace
			this.getRouter().getTarget("BlockReplace").display();

		},

		//adopt selected card as card to be acted on
		onPressCardSelectDialogListItem: function (oEvent) {

			//close popover
			sap.ui.getCore().byId("popCardSelect").close();

			//get card contained in selected list item
			var oLoyaltyCard = oEvent.getSource().getBindingContext("LoyaltyCardConfirmModel").getObject();

			//set confirmed loyalty card ID to UI
			this.setConfirmedLoyaltyCard(oLoyaltyCard);

		},

		//One Time Pin component has been created
		onOneTimePinComponentCreated: function (oEvent) {

			//get access to the One Time Pin
			this.oOneTimePinComponent = oEvent.getParameter("component");

			//attach to OneTimePinValidated event
			this.oOneTimePinComponent.attachIsBusy(this.onOneTimePinIsBusy, this);

			//attach to OneTimePinValidated event
			this.oOneTimePinComponent.attachOneTimePinValidated(this.onOneTimePinValidated, this);

			//provide message strip instance to One Time Pin component
			this.oOneTimePinComponent.setOuterMessageStrip(this.byId("msMessageStrip"));

		},

		//on One Time Pin component busy state change
		onOneTimePinIsBusy: function (oEvent) {

			//get state of busy
			var bBusyState = oEvent.getParameter("busyState");

			//set view to busy depending on state
			this.getModel("ViewModel").setProperty("/isViewBusy", bBusyState);

		},

		//on One Time Pin validated
		onOneTimePinValidated: function () {

			//get verify One Time PIN wizard step
			var oVerifyOneTimePinWizStep = this.getView().byId("wizstepVerifyOneTimePin");

			//get loyalty card currently being processed
			var oLoyaltyCard = this.getView().getBindingContext("LoyaltyModel").getObject();

			//set UI element style classes based on card status
			switch (oLoyaltyCard.CardStatus) {

				//for an active loyalty card
			case "Active":
				this.getView().byId("btnToggleCardStatus").removeStyleClass("sapUiTinyMarginTop");
				this.getView().byId("btnToggleCardStatus").addStyleClass("sapUiMediumMarginTop");
				break;

				//for a blocked loyalty card
			case "Blocked":
				this.getView().byId("btnToggleCardStatus").removeStyleClass("sapUiMediumMarginTop");
				this.getView().byId("btnToggleCardStatus").addStyleClass("sapUiTinyMarginTop");
				break;

			}

			//validate verify One Time Pin wizard step
			this.oBlockReplaceWizard.validateStep(oVerifyOneTimePinWizStep);

			//move wizard to next step
			this.oBlockReplaceWizard.nextStep();

		},

		//on press of reset block and replace wizard
		onPressResetBlockAndReplaceWizard: function () {

			//reset and restart wizard for block and replace
			this.getRouter().getTarget("BlockReplace").display();

		},

		//on successfully scanning a loyalty card to confirm
		onConfirmCardScanSuccessful: function (oEvent) {

			//get scanned loyalty card barcode
			var sScannedCardBarCode = oEvent.getParameter("text");

			//adopt scanned loyalty card for confirmation
			this.getModel("LoyaltyCardConfirmModel").setProperty("/LoyaltyCardID", sScannedCardBarCode);

			//invoke live change handler
			this.onCardConfirmLiveChange(oEvent);

		},

		//on successfully scanning a replacement loyalty card 
		onReplaceCardScanSuccessful: function (oEvent) {

			//get scanned loyalty card barcode
			var sScannedCardBarCode = oEvent.getParameter("text");

			//adopt scanned loyalty card for replace
			this.getView().byId("inputReplacementCardID").setValue(sScannedCardBarCode);

			//invoke live change handler
			this.onReplaceCardLiveChange(oEvent);

		},

		//load One Time Pin component for old UI5 version
		loadOneTimePinComponentForOldUI5Version: function () {

			//load One Time Pin component
			sap.ui.component({
				name: "pnp.onetimepin",
				async: true,
				settings: {},
				componentData: {},
				manifestFirst: true

				//after One Time Pin component is loaded
			}).then(function (oComponent) {

				//get access to the One Time Pin
				this.oOneTimePinComponent = oComponent;

				//attach to OneTimePinValidated event
				this.oOneTimePinComponent.attachIsBusy(this.onOneTimePinIsBusy, this);

				//attach to OneTimePinValidated event
				this.oOneTimePinComponent.attachOneTimePinValidated(this.onOneTimePinValidated, this);

				//provide message strip instance to One Time Pin component
				this.oOneTimePinComponent.setOuterMessageStrip(this.byId("msMessageStrip"));

				//set component to component container
				this.byId("compcontOneTimePinForOldUI5Versions").setComponent(oComponent);

			}.bind(this))

			//exception handling
			.catch(function (oError) {
				jQuery.sap.log.error(oError);

			});

		}

	});

});