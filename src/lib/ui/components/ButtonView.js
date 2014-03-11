import ui.widget.ButtonView as ButtonView;

exports = Class(ButtonView, function (supr) {
	this.init = function (opts) {
		opts = merge(
			opts,
			{
				images: {
					down: 'resources/images/ui/button_green_down.png',
					up: 'resources/images/ui/button_green_up.png',
				},
				scaleMethod: '9slice',
				sourceSlices: {
					horizontal: {left: 40, center: 40, right: 40},
					vertical: {top: 47, middle: 2, bottom: 51}
				},
				destSlices: {
					horizontal: {left: 40, right: 40},
					vertical: {top: 47, bottom: 51}
				},
				text: {
					color: '#FFFFF'
				}
			}
		);

		this._paddingUp = opts.paddingUp;
		this._paddingDown = opts.paddingDown;

		supr(this, 'init', [opts]);

		this._text.updateOpts({padding: this._paddingUp});
	};

	this.onInputStart = this.onInputOver = function () {
		if (this._state === ButtonView.states.DISABLED) {
			return;
		}
		supr(this, 'onInputStart', arguments);

		this._text.updateOpts({padding: this._paddingDown});
	};

	this.onInputSelect = function () {
		supr(this, 'onInputSelect', arguments);

		this._text.updateOpts({padding: this._paddingUp});
	};

	this.onInputOut = function () {
		supr(this, 'onInputOut', arguments);

		this._text.updateOpts({padding: this._paddingUp});
	};
});
