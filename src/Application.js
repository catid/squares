import device;
import ui.View as View;
import ui.TextView as TextView;
import src.lib.ViewPool as ViewPool;
import src.view.BombView as BombView;
import src.view.DudeView as DudeView;

var UI_WIDTH = 640,
	UI_HEIGHT = UI_WIDTH / device.width * device.height,
	UI_SCALE = device.width / UI_WIDTH;

var BG_WIDTH = 576,
	BG_HEIGHT = 1024,
	Z_BOMBS = 30,
	Z_DUDES = 20,
	BOMB_SIZE = 10,
	DUDE_SIZE = 60,
	DRAG_THRESH = 60,
	BOMB_SPEED = 3,
	DUDE_MAX_SIZE = 250,
	DUDE_BIG_SIZE = 120,
	DUDE_MIN_SIZE = 60;

exports = Class(GC.Application, function () {
	/*
	 * Bombs:
	 *
	 * x, y
	 * vx, vy
	 * ident
	 * color
	 */
	this.getBombView = function(sim) {
		var view = this.bombPool.obtainView({
			parent: this.bombContainer,
			gameView: this,
			x: sim.x - BOMB_SIZE/2,
			y: sim.y - BOMB_SIZE/2,
			r: Math.PI/4,
			centerAnchor: true,
			width: BOMB_SIZE,
			height: BOMB_SIZE,
			scale: 1,
			opacity: 1,
			canHandleEvents: false,
			backgroundColor: sim.color
		});

		view.sim = sim;
		view.style.zIndex = Z_BOMBS;

		return view;
	};

	/*
	 * Dudes:
	 *
	 * x, y
	 * tx, ty
	 * color
	 * size
	 * ident
	 */
	this.getDudeView = function(sim) {
		var view = this.dudePool.obtainView({
			parent: this.dudeContainer,
			gameView: this,
			x: sim.x - sim.size/2,
			y: sim.y - sim.size/2,
			r: Math.PI/4,
			centerAnchor: true,
			width: sim.size,
			height: sim.size,
			scale: 1,
			opacity: 1,
			canHandleEvents: false,
			backgroundColor: sim.color
		});

		view.sim = sim;
		view.style.zIndex = Z_DUDES;

		return view;
	};

	this.tickFraction = 0;

	this.tick = function(dt) {
		dt += this.tickFraction;

		while (dt >= 10) {
			dt -= 10;

			for (var ii = this.dudes.length - 1; ii >= 0; ii--) {
				var view = this.dudes[ii];
				var sim = view.sim;

				var tx = sim.tx;
				if (tx !== undefined) {
					var ty = sim.ty;

					var dx = tx - sim.x;
					var dy = ty - sim.y;
					var m = Math.sqrt(dx * dx + dy * dy);
					if (m > 600) {
						m = 1;
					} else {
						m /= 600;
					}

					sim.size += m;
					if (sim.size > DUDE_MAX_SIZE) {
						sim.size = DUDE_MAX_SIZE;
					}

					sim.x += dx / 100;
					sim.y += dy / 100;

					if (sim.x < 0) {
						sim.x = 0;
					} else if (sim.x > BG_WIDTH) {
						sim.x = BG_WIDTH;
					}

					if (sim.y < 0) {
						sim.y = 0;
					} else if (sim.y > BG_HEIGHT) {
						sim.y = BG_HEIGHT;
					}

					view.style.x = sim.x - sim.size/2;
					view.style.y = sim.y - sim.size/2;
				}

				if (sim.size > DUDE_BIG_SIZE) {
					sim.size -= 0.5;
				} else {
					sim.size -= 0.25;
					if (sim.size < DUDE_MIN_SIZE) {
						sim.size = DUDE_MIN_SIZE;
					}
				}

				if (sim.size != sim.oldSize) {
					sim.oldSize = sim.size;
					view.style.width = sim.size;
					view.style.height = sim.size;
				}
			}

			for (var ii = this.bombs.length - 1; ii >= 0; ii--) {
				var view = this.bombs[ii];
				var sim = view.sim;

				sim.x += sim.vx;
				sim.y += sim.vy;

				if (sim.x < 0 || sim.x > BG_WIDTH ||
					sim.y < 0 || sim.y > BG_HEIGHT) {
					// TODO
				}

				view.style.x = sim.x - sim.size/2;
				view.style.y = sim.y - sim.size/2;
			}
		}

		this.tickFraction = dt;
	}

	this.onPlayerMove = function(x, y) {
		var sim = this.me.sim;

		sim.tx = x;
		sim.ty = y;
	}

	this.onPlayerFire = function(x, y) {
		var sim = this.me.sim;

		sim.size += 5;
		if (sim.size > DUDE_MAX_SIZE) {
			sim.size = DUDE_MAX_SIZE;
		}

		var dx = x - sim.x;
		var dy = y - sim.y;
		var scale = BOMB_SPEED / Math.sqrt(dx * dx + dy * dy);

		var vx = dx * scale, vy = dy * scale;

		var view = this.getBombView({
			x: sim.x,
			y: sim.y,
			vx: vx,
			vy: vy,
			color: this.myBombColor,
			ident: this.myId
		});

		this.bombs.push(view);
	}

	this.initInput = function(view) {
		this.gameContainer.onInputStart = bind(this, function(evt, pt) {
			// First touch is movement
			if (this.activeTouch === undefined) {
				this.activeTouch = evt.id;
				this.onPlayerMove(pt.x, pt.y);
			}

			this.touchHistory[evt.id] = pt;
		});
		this.gameContainer.onInputMove = bind(this, function(evt, pt) {
			// If movement touch,
			if (this.activeTouch === undefined || evt.id === this.activeTouch) {
				this.activeTouch = evt.id;
				this.onPlayerMove(pt.x, pt.y);
			} else {
				var hist = this.touchHistory[evt.id];
				if (hist &&
					(Math.abs(pt.x - hist.x) > DRAG_THRESH ||
					 Math.abs(pt.y - hist.y) > DRAG_THRESH))
				{
					 this.activeTouch = evt.id;
					 this.onPlayerMove(pt.x, pt.y);
				}
			}
		});
		this.gameContainer.onInputSelect = bind(this, function(evt, pt) {
			// If movement touch is done,
			if (evt.id === this.activeTouch) {
				this.onPlayerMove(pt.x, pt.y);
				this.activeTouch = undefined;
			} else {
				// This is a bomb fire:
				this.onPlayerFire(pt.x, pt.y);
			}

			this.touchHistory[evt.id] = null;
		});
	}

	this.initUI = function () {
		this.mainContainer = new View({
			parent: this,
			x: 0,
			y: 0,
			anchorX: device.width / 2,
			anchorY: device.height / 2,
			width: device.width,
			height: device.height
		});

		// Centered in main container
		this.gameContainer = new View({
			parent: this.mainContainer,
			x: (device.width - BG_WIDTH) / 2,
			y: (device.height - BG_HEIGHT) / 2,
			anchorX: BG_WIDTH / 2,
			anchorY: BG_HEIGHT / 2,
			width: BG_WIDTH,
			height: BG_HEIGHT,
			scale: UI_SCALE
		});

		this.initInput(this.gameContainer);

		this.dudeContainer = new View({
			parent: this.gameContainer,
			x: 0,
			y: 0,
			width: BG_WIDTH,
			height: BG_HEIGHT,
			zIndex: Z_DUDES,
			blockEvents: true,
			canHandleEvents: false
		});

		this.dudePool = new ViewPool({
			ctor: DudeView,
			initCount: 50,
			initOpts: {
				parent: this.dudeContainer,
				gameView: this,
				anchorX: DUDE_SIZE / 2,
				anchorY: DUDE_SIZE / 2,
				width: DUDE_SIZE,
				height: DUDE_SIZE,
				scale: 1,
				opacity: 1,
				blockEvents: true,
				canHandleEvents: false,
				backgroundColor: "#FF0000"
			}
		});
		this.dudePool.debugTag = "dudePool";

		this.bombContainer = new View({
			parent: this.gameContainer,
			x: 0,
			y: 0,
			width: BG_WIDTH,
			height: BG_HEIGHT,
			zIndex: Z_BOMBS,
			blockEvents: true,
			canHandleEvents: false
		});

		this.bombPool = new ViewPool({
			ctor: BombView,
			initCount: 500,
			initOpts: {
				parent: this.bombContainer,
				gameView: this,
				anchorX: BOMB_SIZE / 2,
				anchorY: BOMB_SIZE / 2,
				width: BOMB_SIZE,
				height: BOMB_SIZE,
				scale: 1,
				opacity: 1,
				blockEvents: true,
				canHandleEvents: false,
				backgroundColor: "#FF0000"
			}
		});
		this.bombPool.debugTag = "bombPool";

		this.touchHistory = [];

		// TODO: Use linked list for dudes/bombs
		this.dudes = [];
		this.dudesById = [];
		this.bombs = [];

		var r = 0, g = 0, b = 0;
		while (r < 100 && g < 100 && b < 100) {
			r = Math.floor(Math.random() * 255);
			g = Math.floor(Math.random() * 255);
			b = Math.floor(Math.random() * 255);
		}
		var scale = Math.sqrt(r * r + g * g + b * b) / 255;
		r = Math.floor(r / scale);
		g = Math.floor(g / scale);
		b = Math.floor(b / scale);

		var br, bg, bb;
		br = Math.floor(r * 0.8);
		bg = Math.floor(g * 0.8);
		bb = Math.floor(b * 0.8);

		this.myColor = "rgb(" + r + "," + g + "," + b + ")";
		this.myBombColor = "rgb(" + br + "," + bg + "," + bb + ")";
		this.myIdent = 0;

		this.me = this.getDudeView({
			x: BG_WIDTH/2,
			y: BG_HEIGHT/2,
			size: DUDE_SIZE,
			color: this.myColor,
			ident: this.myIdent
		});

		this.dudes.push(this.me);
		this.dudesById[this.myId] = this.me;
	};
});

