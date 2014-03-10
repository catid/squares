import animate;
import ui.View as View;
import ui.ImageView as ImageView;
import src.lib.ScoreView as ScoreView;

var TEXT_WIDTH = 16,
	TEXT_HEIGHT = 20,
	STAR_WIDTH = 42,
	STAR_HEIGHT = 39;

exports = Class(View, function(supr)
{
	this.init = function(opts)
	{
		supr(this, "init", arguments);

		this.gameView = opts.gameView;

		this.x = 0;
		this.y = 0;

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

		this.livesText = new ScoreView({
			parent: this,
			x: 0,
			y: 0,
			width: TEXT_WIDTH,
			height: TEXT_HEIGHT,
			textAlign: 'center',
			characterData: YELLOW_ORANGE_TEXT,
			spacing: -6,
			canHandleEvents: false
		});
	};

	this.updateLives = function() {
		this.livesText.style.x = this.style.width / 2 - TEXT_WIDTH/2;
		this.livesText.style.y = this.style.height / 2 - TEXT_HEIGHT/2;
		if (this.oldLives != this.sim.lives) {
			this.oldLives = this.sim.lives;
			this.livesText.setText(this.sim.lives);
		}
	}

	this.addStar = function() {
		this.starView = new ImageView({
			parent: this.livesText,
			x: TEXT_WIDTH - 4,
			y: TEXT_HEIGHT - 4,
			anchorX: 0,
			anchorY: 0,
			width: STAR_WIDTH / 2,
			height: STAR_HEIGHT / 2,
			image: "resources/images/icon_star.png",
			canHandleEvents: false
		});
	}
});

