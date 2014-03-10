import device;
import ui.View as View;
import src.lib.ScoreView as ScoreView;
import ui.TextView as TextView;
import src.lib.ViewPool as ViewPool;
import src.view.BombView as BombView;
import src.view.DudeView as DudeView;

var UI_HEIGHT = 1024,
	UI_WIDTH = UI_HEIGHT / device.width * device.height,
	UI_SCALE = device.height / UI_HEIGHT;

var BG_WIDTH = 576,
	BG_HEIGHT = 1024,
	Z_BOMBS = 30,
	Z_DUDES = 20,
	BOMB_SIZE = 10,
	DUDE_SIZE = 60,
	DRAG_THRESH = 60,
	BOMB_SPEED = 4,
	DUDE_MAX_SIZE = 250,
	DUDE_BIG_SIZE = 120,
	DUDE_MIN_SIZE = 60,
	DUDE_ACC = 0.05,
	BOMB_RATE = 500,
	DUDE_VEL = 2,
	WIN_GROW_RATE = 20,
	TEXT_WIDTH = 64,
	TEXT_HEIGHT = 80,
	PROTECTION_TICKS = 300,
	ACTIVITY_TIMEOUT = 1000;

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

	this.tickDude = function(view) {
		var sim = view.sim;

		if (view != this.me) {
			if (--sim.activity <= 0) {
				var ii = this.dudes.indexOf(view);
				if (ii >= 0) {
					delete this.dudesByIdent[sim.ident];
					this.dudes.splice(ii, 1);
					this.dudePool.releaseView(view);
					return false;
				}
				return true;
			} else if (sim.activity < ACTIVITY_TIMEOUT - 100) {
				if (!sim.greyed) {
					view.style.backgroundColor = "#808080";
					sim.greyed = true;
				}
			} else if (sim.greyed) {
				view.style.backgroundColor = sim.color;
				sim.greyed = false;
			}
		}

		if (sim.dead) {
			if (view.style.visible) {
				view.style.visible = false;
			}
			return true;
		} else {
			if (!view.style.visible) {
				view.style.visible = true;
			}
		}

		if (sim.protection) {
			if (--sim.protection > 0) {
				view.style.backgroundColor = "white";
				sim.whited = true;
			} else {
				view.style.backgroundColor = sim.color;
				sim.whited = false;
				sim.protection = 0;
			}
		} else if (sim.whited) {
			view.style.backgroundColor = sim.color;
			sim.whited = false;
		}

		if (sim.size != sim.oldSize) {
			sim.oldSize = sim.size;
			view.style.width = sim.size;
			view.style.height = sim.size;
			view.updateLives();
		}

		var tx = sim.tx;
		if (tx !== undefined) {
			var ty = sim.ty;

			if (sim.vx) {
				sim.x += sim.vx / 2;
			}
			if (sim.vy) {
				sim.y += sim.vy / 2;
			}

			var dx = tx - sim.x;
			var dy = ty - sim.y;
			var dm = Math.sqrt(dx * dx + dy * dy);
			dx *= DUDE_ACC / dm;
			dy *= DUDE_ACC / dm;

			sim.vx += dx;
			sim.vy += dy;

			var vm = Math.sqrt(sim.vx * sim.vx + sim.vy * sim.vy);
			if (vm > DUDE_VEL) {
				var scale = DUDE_VEL / vm;
				sim.vx *= scale;
				sim.vy *= scale;
			}

			if (sim.vx) {
				sim.x += sim.vx / 2;
			}
			if (sim.vy) {
				sim.y += sim.vy / 2;
			}

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
		}

		return true;
	}

	this.tickBomb = function(view) {
		var sim = view.sim;

		sim.x += sim.vx;
		sim.y += sim.vy;

		if (sim.x < 0 || sim.x > BG_WIDTH ||
			sim.y < 0 || sim.y > BG_HEIGHT)
		{
			var ii = this.bombs.indexOf(view);
			if (ii >= 0) {
				this.bombs.splice(ii, 1);
				this.bombPool.releaseView(view);
				return false;
			}

			return true;
		}

		var mysim = this.me.sim;
		var hitbox = mysim.size/2;

		if (!sim.hit && sim.ident != mysim.ident) {
			if (Math.abs(mysim.y - sim.y) < hitbox &&
				Math.abs(mysim.x - sim.x) < hitbox)
			{
				sim.hit = true;

				if (!mysim.dead) {
					if (mysim.protection <= 0) {
						view.style.backgroundColor = "white";
						this.onHitMe(sim.ident);
					} else {
						view.style.backgroundColor = "#808080";
					}
				}
			}
		}

		return true;
	}

	this.tickFraction = 0;

	this.tick = function(dt) {
		dt += this.tickFraction;

		while (dt >= 10) {
			dt -= 10;

			for (var ii = 0; ii < this.dudes.length; ii++) {
				var view = this.dudes[ii];

				if (!this.tickDude(view)) {
					--ii;
				} else {
					view.style.x = view.sim.x - view.sim.size/2;
					view.style.y = view.sim.y - view.sim.size/2;
				}
			}

			for (var ii = 0; ii < this.bombs.length; ii++) {
				var view = this.bombs[ii];

				if (!this.tickBomb(view)) {
					--ii;
				} else {
					view.style.x = view.sim.x - BOMB_SIZE/2;
					view.style.y = view.sim.y - BOMB_SIZE/2;
				}
			}
		}

		if (this.me) {
			var sim = this.me.sim;

			var netsim = this.netSim;
			netsim.size = sim.size;
			netsim.x = sim.x;
			netsim.y = sim.y;
			netsim.tx = sim.tx;
			netsim.ty = sim.ty;
			netsim.vx = sim.vx;
			netsim.vy = sim.vy;
			netsim.dead = sim.dead;
			netsim.protection = sim.protection;
			netsim.lives = sim.lives;

			NATIVE.xhr && NATIVE.xhr.udpSend(JSON.stringify(netsim));
		}

		this.tickFraction = dt;
	}

	this.placeDude = function() {
		var sim = this.me.sim;

		logger.log("Placed dude");

		sim.lives = 3;
		sim.dead = false;

		sim.x = Math.floor(Math.random() * BG_WIDTH);
		sim.y = Math.floor(Math.random() * BG_HEIGHT);
		sim.tx = undefined;
		sim.ty = undefined;
		sim.vx = 0;
		sim.vy = 0;
		sim.oldSize = undefined;
		sim.size = DUDE_SIZE;
		sim.protection = PROTECTION_TICKS;

		this.me.updateLives();
	}

	this.onCounterTick = function() {
		if (--this.count < 0) {
			this.placeDude();
			this.countText.style.visible = false;
		} else {
			this.countText.setText(this.count);
			setTimeout(bind(this, this.onCounterTick), 1000);
		}
	}

	this.onHitMe = function(ident) {
		var sim = this.me.sim;

		if (--sim.lives <= 0) {
			sim.dead = ident;

			this.countText.style.visible = true;
			this.count = 9;
			this.countText.setText(this.count);

			setTimeout(bind(this, this.onCounterTick), 1000);
		}

		this.me.updateLives();
	}

	this.onPlayerMove = function(x, y) {
		var sim = this.me.sim;

		sim.tx = x;
		sim.ty = y;
	}

	this.onPlayerFire = function(x, y) {
		var sim = this.me.sim;

		if (sim.dead || sim.protection > 0) {
			return;
		}

		var now = +new Date();

		if (now - this.lastFireTime < BOMB_RATE) {
			return;
		}

		this.lastFireTime = now;

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
			ident: this.myIdent
		});

		this.bombs.push(view);

		NATIVE.xhr && NATIVE.xhr.udpSend(JSON.stringify({
			"type": "bomb",
			"color": this.myBombColor,
			"ident": this.myIdent,
			"x": sim.x,
			"y": sim.y,
			"vx": vx,
			"vy": vy
		}));
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
		device.stayAwake(true);

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

		var YELLOW_ORANGE_TEXT = {
			"0": { image: "resources/images/text_gold_0.png" },
			"1": { image: "resources/images/text_gold_1.png" },
			"2": { image: "resources/images/text_gold_2.png" },
			"3": { image: "resources/images/text_gold_3.png" },
			"4": { image: "resources/images/text_gold_4.png" },
			"5": { image: "resources/images/text_gold_5.png" },
			"6": { image: "resources/images/text_gold_6.png" },
			"7": { image: "resources/images/text_gold_7.png" },
			"8": { image: "resources/images/text_gold_8.png" },
			"9": { image: "resources/images/text_gold_9.png" }
		};

		this.countText = new ScoreView({
			parent: this.gameContainer,
			x: BG_WIDTH/2 - TEXT_WIDTH/2,
			y: BG_HEIGHT/2 - TEXT_HEIGHT/2,
			width: TEXT_WIDTH,
			height: TEXT_HEIGHT,
			textAlign: 'center',
			characterData: YELLOW_ORANGE_TEXT,
			spacing: -6,
			canHandleEvents: false,
			visible: false
		});

		this.touchHistory = [];

		// TODO: Use linked list for dudes/bombs
		this.dudes = [];
		this.dudesByIdent = [];
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
		this.myIdent = Math.floor(Math.random() * 1000000) + 1;

		this.netSim = {
			type: "dude",
			x: BG_WIDTH/2,
			y: BG_HEIGHT/2,
			vx: 0,
			vy: 0,
			size: DUDE_SIZE,
			color: this.myColor,
			ident: this.myIdent
		};

		this.me = this.getDudeView(this.netSim);
		this.me.updateLives();

		this.dudes.push(this.me);
		this.dudesByIdent[this.myIdent] = this.me;

		if (NATIVE.xhr) {
			NATIVE.xhr.udpOnRead = bind(this, function(data) {
				//logger.log("UDP DATA", data);

				try {
					var obj = JSON.parse(data);

					this.onServerData(obj);
				} catch(e) {
					logger.log("Error in UDP data:", e);
				}
			});
		}

		this.placeDude();
	}

	this.onServerData = function(obj) {
		if (obj.type == "dude") {
			var dude = this.dudesByIdent[obj.ident];
			if (!dude) {
				dude = this.getDudeView({
					x: obj.x,
					y: obj.y,
					size: obj.size,
					color: obj.color,
					ident: obj.ident
				});

				this.dudesByIdent[obj.ident] = dude;
				this.dudes.push(dude);
			}

			var sim = dude.sim;
			sim.x = obj.x;
			sim.y = obj.y;
			sim.tx = obj.tx;
			sim.ty = obj.ty;
			sim.vx = obj.vx;
			sim.vy = obj.vy;
			sim.size = obj.size;
			sim.protection = obj.protection;
			sim.lives = obj.lives;

			dude.updateLives();

			if (obj.dead) {
				if (sim.dead !== true) {
					sim.dead = true;

					var mysim = this.me.sim;
					if (obj.dead == mysim.ident) {
						mysim.size += WIN_GROW_RATE;
						this.me.updateLives();
					}
				}
			} else {
				sim.dead = false;
			}

			sim.activity = ACTIVITY_TIMEOUT;
		} else if (obj.type == "bomb") {
			var view = this.getBombView({
				x: obj.x,
				y: obj.y,
				vx: obj.vx,
				vy: obj.vy,
				color: obj.color,
				ident: obj.ident
			});

			this.bombs.push(view);
		}
	}
});

