import animate;
import ui.View as View;

exports = Class(View, function(supr)
{
	this.init = function(opts)
	{
		supr(this, "init", arguments);

		this.gameView = opts.gameView;

		this.x = 0;
		this.y = 0;
	};
});

