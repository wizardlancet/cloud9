/**
 * Minimap plugin for Cloud9
 * 
 * @author Sergi Mansilla
 * @contributor Matt Pardee
 * @copyright 2012, Cloud9 IDE, Inc.
 * 
 * TODO:
 * - On direct click in the map, it should
 *      take the user to the line he was pointing
 *      to, and not to the relative position of
 *      the document to the Y coordinate of the map.
 */

define(function(require, exports, module) {

var LINE_HEIGHT = 4;
var MARGIN_RIGHT = 2;

var Map = (function() {
    Map.createVisor = function(w, h) {
        var visor = Map.createCanvas(w, h);
        visor.ctx.fillStyle = "rgba(250, 250, 250, 0.2)";
        visor.ctx.fillRect(0, 0, w, h);
        return visor;
    };

    Map.createCanvas = function(w, h) {
        var canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        return {
            canvas : canvas,
            ctx : canvas.getContext("2d")
        };
    };

    Map.storeCanvas = function(width, height, lines) {
        var canvas = Map.createCanvas(width, height);
        var ctx = canvas.ctx;
        ctx.font = LINE_HEIGHT + "px Monospace";
        ctx.fillStyle = "#fff";

        for (var i = 0, _len = lines.length; i < _len; i++)
            ctx.fillText(lines[i], 0, (i << 2) + LINE_HEIGHT);

        return canvas;
    };

    Map.prototype.refreshCanvas = function(y) {
        var code = this.codeCanvas.canvas;
        var w = Math.min(this.c.width, code.width);
        var h = Math.min(this.c.height, code.height);
        if (this.codeCanvas.canvas.height < (y + h))
            h -= (y + h) - code.height;
        this.ctx.fillRect(0, 0, this.c.width, this.c.height);
        var dw = Math.max(w - MARGIN_RIGHT, 0);
        h = Math.max(h, 1);
        w = Math.max(w, 1);
        y = Math.max(y, 0);
        if (code.height !== 0 && code.width !== 0)
            return this.ctx.drawImage(code, 0, y, w, h, MARGIN_RIGHT, 0, dw, h);
    };

    Map.prototype.refreshVisor = function(y) {
        this.ctx.drawImage(this.visor.canvas, 0, y);
    };

    Map.prototype.resize = function(w, h) {
        this.c.width = w;
        this.c.height = h;
        if (this.codeCanvas) {
            this.codeCanvas.width = w;
            this.codeCanvas.height = h;
        }
        this.visibleLines = this.ace.$getVisibleRowCount();
        this.visorHeight = Map.toHeight(this.visibleLines);
        this.visor = Map.createVisor(this.c.width, this.visorHeight);
        this.render();
    };

    Map.prototype.getNormal = function() {
        var normal = this.visorTop / (this.c.height - this.visorHeight);
        if (normal > 1)
            normal = 1;
        else if (normal < 0)
            normal = 0;

        return normal;
    };

    Map.prototype.afterScroll = function() {
        if (!this.mousedown) {
            var topLine = this.ace.renderer.getFirstVisibleRow();
            this.normal = topLine / (this.lines.length - this.visibleLines);
            this.visorTop = this.normal * (this.c.height - this.visorHeight);
            return this.render();
        }
    };

    function Map(ace, c) {
        var _self = this;
        this.ace = ace;
        this.c = c;
        this.visibleLines = this.ace.$getVisibleRowCount();
        this.visorHeight = Map.toHeight(this.visibleLines);
        this.ctx = c.getContext("2d");
        this.ctx.fillStyle = "#000";
        this.ctx.fillRect(0, 0, this.c.width, this.c.height);
        this.visorTop = 0;
        this.inVisor = false;
        this.mousedown = false;

        this.ace.renderer.scrollBar.addEventListener("scroll", function() {
            _self.afterScroll();
        });

        var session = this.ace.getSession();

        c.addEventListener("mousedown", function(e) {
            var visorTop = _self.visorTop;
            var mouseY = _self.mousedown = e.offsetY || e.layerY;
            _self.inVisor = (visorTop + _self.visorHeight > mouseY && mouseY > visorTop);
            if (_self.inVisor)
                _self.visorDiff = mouseY - visorTop;
        }, false);

        c.addEventListener("mousemove", function(e) {
            if (_self.mousedown !== false && _self.inVisor) {
                _self.visorTop = (e.offsetY || e.layerY) - _self.visorDiff;
                _self.normal = _self.getNormal();
                _self.render(true);
            }
        }, false);

        document.addEventListener("mouseup", function(e) {
            if (!_self.inVisor && e.target === c) {
                _self.visorTop = (e.offsetY || e.layerY) - (_self.visorHeight / 2);
                _self.normal = _self.getNormal();
                _self.render(true);
            }
            _self.mousedown = _self.inVisor = false;
        }, false);

        this.visor = Map.createVisor(this.c.width, this.visorHeight);
        this.updateSource(session);
    }

    Map.prototype.updateSource = function(session) {
        this.lines = session.getLines(0, session.getLength() - 1);
        this.actualHeight = Map.toHeight(this.lines.length);
        this.codeCanvas = Map.storeCanvas(this.c.width, this.actualHeight, this.lines);
        return this.render();
    };

    Map.prototype.render = function(scrollAce) {
        var top = 0;
        var height = Math.min(this.c.height, this.actualHeight);
        var fitsCanvas = this.actualHeight < this.c.height;
        var fitsScreen = this.visorHeight > height;
        var maxVisorY = height - this.visorHeight;
        if (fitsScreen) {
            this.refreshCanvas(0);
        }
        else {
            var visorTop = 0;
            if (this.visorTop > maxVisorY)
                visorTop = maxVisorY;
            else if (this.visorTop > 0)
                visorTop = this.visorTop;

            if (fitsCanvas) {
                top = visorTop;
                this.refreshCanvas(0);
            }
            else {
                top = (this.normal || 0) * (this.actualHeight - this.visorHeight);
                this.refreshCanvas(top - visorTop);
            }
            this.refreshVisor(visorTop);
        }

        if (scrollAce)
            this.ace.scrollToLine(Map.toLine(top));
    };

    Map.toLine = function(y) {
        return Math.ceil(y / LINE_HEIGHT);
    };

    Map.toHeight = function(line) {
        return line * LINE_HEIGHT;
    };

    Map.prototype.destroy = function() {
        this.lines = null;
        this.pixelData = null;
        this.ctx.clearRect(0, 0, this.c.width, this.c.height);
        this.c.removeEventListener("mousedown");
        this.c.removeEventListener("mousemove");
        this.c.removeEventListener("mouseup");
        this.c = this.ctx = this.ace = this.codeCanvas = null;
    };

    return Map;
})();

return module.exports = Map;

});