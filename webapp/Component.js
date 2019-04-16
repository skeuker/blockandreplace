sap.ui.define([
	"sap/ui/core/UIComponent",
	"sap/ui/Device",
	"pnp/blockandreplace/model/models",
	"pnp/blockandreplace/util/ErrorHandler"
], function (UIComponent, Device, models, ErrorHandler) {
	"use strict";

	return UIComponent.extend("pnp.blockandreplace.Component", {

		metadata: {
			manifest: "json"
		},

		/**
		 * The component is initialized by UI5 automatically during the startup of the app and calls the init method once.
		 * @public
		 * @override
		 */
		init: function () {
			
			//instantiate error handler
			this.oErrorHandler = new ErrorHandler(this);
			
			// call the base component's init function
			UIComponent.prototype.init.apply(this, arguments);

			// enable routing
			this.getRouter().initialize();

			// set the device model
			this.setModel(models.createDeviceModel(), "device");
			
		},
		
		/**
		 * This method can be called to determine whether the sapUiSizeCompact or sapUiSizeCozy
		 * design mode class should be set, which influences the size appearance of some controls.
		 * @public
		 * @return {string} css class, either 'sapUiSizeCompact' or 'sapUiSizeCozy' - or an empty string if no css class should be set
		 */
		getContentDensityClass: function() {

			//determine content density class
			if (this.sContentDensityClass === undefined) {

				// check whether FLP has already set the content density class; do nothing in this case
				if (jQuery(document.body).hasClass("sapUiSizeCozy") || jQuery(document.body).hasClass("sapUiSizeCompact")) {
					this.sContentDensityClass = "";

					// apply "compact" mode if touch is not supported	
				} else if (!Device.support.touch) {
					this.sContentDensityClass = "sapUiSizeCompact";

					// "cozy" in case of touch support; default for most sap.m controls, but needed for desktop-first controls like sap.ui.table.Table
				} else {
					this.sContentDensityClass = "sapUiSizeCozy";
				}

			}

			//feedback to caller
			return this.sContentDensityClass;

		}
		
	});
	
});