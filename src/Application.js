import device;
import ui.View as View;
import src.lib.ScoreView as ScoreView;
import ui.TextView as TextView;
import src.lib.ViewPool as ViewPool;
import src.view.BombView as BombView;
import src.view.DudeView as DudeView;
import src.view.OptionOverlay as OptionOverlay;
import Sound;

var UI_HEIGHT = 1024,
	UI_WIDTH = UI_HEIGHT / device.width * device.height,
	UI_SCALE = device.height / UI_HEIGHT,
	DRAG_DISTANCE = UI_SCALE * 14;

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
	this.music = new Sound({
		path: 'resources/sounds/music',
		files: {
			'win': { volume: 0.67, background: true }
		}
	});
	this.sfx = new Sound({
		path: 'resources/sounds/sfx',
		files: {
			'sfx_birdie_hurt': { volume: 1 },
			'sfx_cannon_b': { volume: 1 }
		}
	});

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

	this.tickDude = function(view, dt) {
		var sim = view.sim;
		var frames = dt / 10;

		if (view != this.me) {
			sim.activity -= frames;
			if (sim.activity <= 0) {
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
			sim.protection -= frames;
			if (sim.protection > 0) {
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
		if (tx != -1) {
			var ty = sim.ty;

			if (sim.vx) {
				sim.x += sim.vx * frames / 2;
			}
			if (sim.vy) {
				sim.y += sim.vy * frames / 2;
			}

			var dx = tx - sim.x;
			var dy = ty - sim.y;
			var dm = Math.sqrt(dx * dx + dy * dy);
			dx *= DUDE_ACC / dm;
			dy *= DUDE_ACC / dm;

			sim.vx += dx * frames;
			sim.vy += dy * frames;

			if (dm < 50) {
				var scale = dm / 50;
				sim.vx *= scale;
				sim.vy *= scale;
			}

			var vm = Math.sqrt(sim.vx * sim.vx + sim.vy * sim.vy);
			if (vm > DUDE_VEL) {
				var scale = DUDE_VEL / vm;
				sim.vx *= scale;
				sim.vy *= scale;
			}

			if (sim.vx) {
				sim.x += sim.vx * frames / 2;
			}
			if (sim.vy) {
				sim.y += sim.vy * frames / 2;
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

	this.tickBomb = function(view, dt) {
		var sim = view.sim;
		var frames = dt / 10;

		sim.x += sim.vx * frames;
		sim.y += sim.vy * frames;

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

	this.splitTick = function(dt, fn) {
		var ft = dt;
		while (ft >= 30) {
			if (!fn(30)) {
				return false;
			}
			ft -= 30;
		}
		return fn(ft);
	}

	this.tick = function(dt) {
		for (var ii = 0; ii < this.dudes.length; ii++) {
			var view = this.dudes[ii];

			this.splitTick(dt, bind(this, function(rate) {
				if (!this.tickDude(view, rate)) {
					--ii;
					return false;
				}

				return true;
			}));

			var ox = view.sim.ox, oy = view.sim.oy;
			ox = (ox * 7 + view.sim.x) / 8;
			oy = (oy * 7 + view.sim.y) / 8;

			view.style.x = ox - view.sim.size/2;
			view.style.y = oy - view.sim.size/2;

			view.sim.ox = ox;
			view.sim.oy = oy;
		}

		for (var ii = 0; ii < this.bombs.length; ii++) {
			var view = this.bombs[ii];

			this.splitTick(dt, bind(this, function(rate) {
				if (!this.tickBomb(view, rate)) {
					--ii;
					return false;
				}
				return true;
			}));

			view.style.x = view.sim.x - BOMB_SIZE/2;
			view.style.y = view.sim.y - BOMB_SIZE/2;
		}

		var delay = 0;

		if (this.me) {
			var sim = this.me.sim;

			/*
			 * Somewhere between once every 200 ms and once every frame
			 */

			var dist;
			if (sim.tx != -1) {
				dist = Math.abs(this.lastTX - sim.tx) + Math.abs(this.lastTY - sim.ty);
			} else {
				dist = 0;
			}

			var delay = 200 - dist * 4;
			if (delay < 24) {
				delay = 24;
			}

			this.lastTX = sim.tx;
			this.lastTY = sim.ty;

			this.sendPosition(delay);
		}
	}

	this.sendPosition = function(delay) {
		if (!this.me) {
			return;
		}

		var now = +new Date();

		if ((now - this.lastPST) < delay) {
			return;
		}

		var sim = this.me.sim;

		NATIVE.xhr && NATIVE.xhr.udpSend(JSON.stringify([
			1, this.myIdent, this.myColor, sim.size, sim.x, sim.y,
			sim.tx, sim.ty, sim.vx, sim.vy, sim.dead, sim.protection,
			sim.lives
		]), false);

		this.lastPST = now;
	}

	this.placeDude = function() {
		var sim = this.me.sim;

		logger.log("Placed dude");

		sim.lives = 3;
		sim.dead = false;

		sim.x = Math.floor(Math.random() * BG_WIDTH);
		sim.y = Math.floor(Math.random() * BG_HEIGHT);
		sim.tx = -1;
		sim.ty = -1;
		sim.vx = 0;
		sim.vy = 0;
		sim.oldSize = -1;
		sim.size = DUDE_SIZE;
		sim.protection = PROTECTION_TICKS;

		this.me.updateLives();

		GC.app.music.play('win');
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

	this.onDie = function() {
		this.countText.style.visible = true;
		this.count = 9;
		this.countText.setText(this.count);

		GC.app.music.stop('win');

		setTimeout(bind(this, this.onCounterTick), 1000);
	}

	this.onHitMe = function(ident) {
		var sim = this.me.sim;

		GC.app.sfx.play('sfx_birdie_hurt');

		if (--sim.lives <= 0) {
			sim.dead = ident;

			this.onDie();
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

		NATIVE.xhr && NATIVE.xhr.udpSend(JSON.stringify([
				0, this.myIdent, Math.floor(sim.x), Math.floor(sim.y),
				vx, vy
		]), this.UseMoreReliable);

		GC.app.sfx.play('sfx_cannon_b');
	}

	this.initInput = function(view) {
		this.gameContainer.onInputStart = bind(this, function(evt, pt) {
/* Old system
			// First touch is movement
			if (this.activeTouch === undefined) {
				this.activeTouch = evt.id;
				this.onPlayerMove(pt.x, pt.y);
			}
			this.touchHistory[evt.id] = pt;
*/
			this.touchHistory[evt.id] = {
				start: pt
			};
		});

		this.gameContainer.onInputMove = bind(this, function(evt, pt) {
/* Old system
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
*/
			var touch = this.touchHistory[evt.id];
			if (touch) {
				if (touch.isMovement) {
					 this.onPlayerMove(pt.x, pt.y);
				} else {
					if (Math.abs(pt.x - touch.start.x) > DRAG_DISTANCE ||
						Math.abs(pt.y - touch.start.y) > DRAG_DISTANCE)
					{
						touch.isMovement = true;
						this.onPlayerMove(pt.x, pt.y);
					}
				}
			} else {
				 this.onPlayerMove(pt.x, pt.y);
			}
		});

		this.gameContainer.onInputSelect = bind(this, function(evt, pt) {
/* Old system
			// If movement touch is done,
			if (evt.id === this.activeTouch) {
				this.onPlayerMove(pt.x, pt.y);
				this.activeTouch = undefined;
			} else {
				// This is a bomb fire:
				this.onPlayerFire(pt.x, pt.y);
			}

			this.touchHistory[evt.id] = null;
*/
			var touch = this.touchHistory[evt.id];
			if (touch) {
				if (!touch.isMovement) {
					this.onPlayerFire(pt.x, pt.y);
				} else {
					this.onPlayerMove(pt.x, pt.y);
				}

				this.touchHistory[evt.id] = null;
			} else {
				this.onPlayerFire(pt.x, pt.y);
			}
		});
	}

	this.onBack = function() {
		logger.log("BACK PRESSED");

		this.optionsOverlay.show();
	}

	this.initUI = function() {
		this.UseMoreReliable = true;

		NATIVE.xhr && NATIVE.xhr.udpInit("173.230.158.98", 5000);

		GC.app.music.play('win');

		device.stayAwake(true);

		if (NATIVE.backButton) {
			NATIVE.backButton.subscribe('pressed', this, function() {
				this.onBack();
			});
		}

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

		this.optionsOverlay = new OptionOverlay({
			superview: this.gameContainer,
			parent: this.gameContainer
		});

		this.optionsOverlay.on('ploss10', bind(this, function() {
			logger.log("Ploss10");
			NATIVE.xhr && NATIVE.xhr.udpSend("CMD PLOSS " + 10, true);
		}));
		this.optionsOverlay.on('ploss20', bind(this, function() {
			logger.log("Ploss20");
			NATIVE.xhr && NATIVE.xhr.udpSend("CMD PLOSS " + 20, true);
		}));
		this.optionsOverlay.on('plossOff', bind(this, function() {
			logger.log("PlossOff");
			NATIVE.xhr && NATIVE.xhr.udpSend("CMD PLOSS " + 0, true);
		}));
		this.optionsOverlay.on('erasureOff', bind(this, function() {
			logger.log("ErasureOff");
			this.UseMoreReliable = false;
			NATIVE.xhr && NATIVE.xhr.udpSend(JSON.stringify([
					2, 0
			]), true);
		}));
		this.optionsOverlay.on('erasureOn', bind(this, function() {
			logger.log("ErasureOn");
			this.UseMoreReliable = true;
			NATIVE.xhr && NATIVE.xhr.udpSend(JSON.stringify([
					2, 1
			]), true);
		}));

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

		this.lastPST = 0; // Last position send time
		this.lastTX = 0; // Last tx
		this.lastTY = 0; // Last ty

		this.netSim = {
			type: "dude",
			x: BG_WIDTH/2,
			y: BG_HEIGHT/2,
			vx: 0,
			vy: 0,
			ox: 0,
			oy: 0,
			size: DUDE_SIZE,
			color: this.myColor,
			ident: this.myIdent
		};

		this.me = this.getDudeView(this.netSim);
		this.me.updateLives();
		this.me.addStar();

		this.dudes.push(this.me);
		this.dudesByIdent[this.myIdent] = this.me;

		if (NATIVE.xhr) {
			NATIVE.xhr.udpOnRead = bind(this, function(data, dt) {
				//logger.log("UDP DATA", data, dt);

				try {
					var obj = JSON.parse(data);

					this.onServerData(obj, dt);
				} catch(e) {
					logger.log("Error in UDP data:", e, data);
				}
			});
		}

		this.placeDude();
	}

	this.onServerData = function(obj, dt, ts) {
		if (obj[0] == 1) {
			var ident = obj[1];
			var color = obj[2];
			var size = obj[3];
			var x = obj[4];
			var y = obj[5];
			var tx = obj[6];
			var ty = obj[7];
			var vx = obj[8];
			var vy = obj[9];
			var dead = obj[10];
			var protection = obj[11];
			var lives = obj[12];

			var dude = this.dudesByIdent[obj[1]];

			if (!dude) {
				dude = this.getDudeView({
					x: x,
					y: y,
					ox: x,
					oy: y,
					size: size,
					color: color,
					ident: ident,
					ts: ts
				});

				this.dudesByIdent[ident] = dude;
				this.dudes.push(dude);
			}

			var sim = dude.sim;

			if (ts - sim.ts < -1) {
				logger.log("OUT OF ORDER", ts, sim.ts);
				return;
			}

			sim.activity = ACTIVITY_TIMEOUT;
			sim.x = x;
			sim.y = y;
			sim.tx = tx;
			sim.ty = ty;
			sim.vx = vx;
			sim.vy = vy;
			sim.size = size;
			sim.protection = protection;
			sim.lives = lives;
			sim.ts = ts;

			dude.updateLives();

			if (dead) {
				if (sim.dead !== true) {
					sim.dead = true;

					var mysim = this.me.sim;
					if (dead == mysim.ident) {
						mysim.size += WIN_GROW_RATE;
						this.me.updateLives();
					}
				}
			} else {
				sim.dead = false;
			}
/*
			if (!this.dtlog) {
				this.dtlog = [];
			}
			this.dtlog.push(dt);
			if (this.dtlog.length > 10) {
				logger.log(this.dtlog);
				this.dtlog.length = 0;
			}
*/
			if (dt < 2000) {
				this.tickDude(dude, dt + 2); // Add 2 ms for JS processing
			}
		} else if (obj[0] == 0) {
			var view = this.getBombView({
				x: obj[2],
				y: obj[3],
				vx: obj[4],
				vy: obj[5],
				color: "rgb(255, 100, 100)",
				ident: obj[1]
			});

			this.bombs.push(view);

			if (dt < 2000) {
				this.tickBomb(view, dt + 2);
			}

			GC.app.sfx.play('sfx_cannon_b');
		} else if (obj[0] == 2) {
			if (obj[1] == 1) {
				this.UseMoreReliable = true;
				logger.log("Erasure codes toggled ON");
			} else {
				this.UseMoreReliable = false;
				logger.log("Erasure codes toggled off");
			}
		}
	}
});

