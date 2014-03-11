import animate;

import ui.View as View;
import ui.SpriteView as SpriteView;
import ui.ImageView as ImageView;
import ui.TextView as TextView;
import ui.ImageScaleView as ImageScaleView;

import src.lib.ui.components.ButtonView as ButtonView;

exports = Class(View, function (supr) {
	this.makeButton = function(opts) {
		return new ButtonView({
			superview: this._container,
			width: opts.width,
			height: opts.height,
			x: opts.x,
			y: opts.y,
			images: {
				down: 'resources/images/button_green_down.png',
				up: 'resources/images/button_green_up.png',
			},
			title: opts.title,
			paddingUp: [0, 0, 9, 0],
			paddingDown: [0, 0, 5, 0],
			text: {
				size: 30,
				color: '#FFFFFF',
				fontFamily: 'BPreplayBold',
				strokeColor: "green",
				strokeWidth: 4,
				clip: false
			},
			on: { up: opts.onPress }
		});
	}

	this.init = function (opts) {
		opts = merge(
			opts,
			{
				x: 0,
				y: 0,
				width: opts.superview.style.width,
				height: opts.superview.style.height,
				visible: false,
				zIndex: 100001
			}
		);
		supr(this, 'init', [opts]);

		this._container = new ImageScaleView({
			superview: this,
			image: 'resources/images/button_red_up.png',
			scaleMethod: '9slice',
			sourceSlices: {
				horizontal: {left: 20, center: 22, right: 20},
				vertical: {top: 20, middle: 4, bottom: 20}
			},
			x: (this.style.width - 420) * 0.5,
			y: (this.style.height - 740) * 0.5, // Lower than the center...
			width: 420,
			height: 740
		});

		this._titleView = new TextView({
			superview: this._container,
			width: 200,
			height: 50,
			x: (this._container.style.width - 200) * 0.5,
			y: 10,
			text: "Super-Secret Options Menu",
			fontSize: 46,
			color: 'rgb(153, 102, 52)',
			fontFamily: 'BPreplayBold',
			//strokeColor: '#CEC38C',
			//strokeWidth: 6,
			clip: false
		});

		this._Ploss10Button = this.makeButton({
			width: 340,
			height: 95,
			x: (this._container.style.width - 340) * 0.5,
			y: 100,
			title: "10% Packet Loss On",
			onPress: bind(this, function() {
				this.emit('ploss10');
			})
		});

		this._Ploss20Button = this.makeButton({
			width: 340,
			height: 95,
			x: (this._container.style.width - 340) * 0.5,
			y: 200,
			title: "20% Packet Loss On",
			onPress: bind(this, function() {
				this.emit('ploss20');
			})
		});

		this._PlossOffButton = this.makeButton({
			width: 340,
			height: 95,
			x: (this._container.style.width - 340) * 0.5,
			y: 300,
			title: "Extra Packet Loss Off",
			onPress: bind(this, function() {
				this.emit('plossOff');
			})
		});

		this._ErasureOnButton = this.makeButton({
			width: 340,
			height: 95,
			x: (this._container.style.width - 340) * 0.5,
			y: 400,
			title: "Erasure Codes On",
			onPress: bind(this, function() {
				this.emit('erasureOn');
			})
		});

		this._ErasureOffButton = this.makeButton({
			width: 340,
			height: 95,
			x: (this._container.style.width - 340) * 0.5,
			y: 500,
			title: "Erasure Codes Off",
			onPress: bind(this, function() {
				this.emit('erasureOff');
			})
		});

		this._resumeButton = this.makeButton({
			width: 240,
			height: 95,
			x: (this._container.style.width - 240) * 0.5,
			y: 600,
			title: "Resume",
			onPress: bind(this, 'hide')
		})
	};

	this.show = function () {
		this.style.visible = true;

		// TODO: figure out why this fixes broken text alignment
		setTimeout(bind(this, function() {
			this._resumeButton._text.updateOpts({});
		}), 50);
	};

	this.hide = function (cb) {
		this.style.visible = false;
		cb && cb();
	};
});

