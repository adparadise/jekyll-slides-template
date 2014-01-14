window.Slides = {};

Slides.getUUID = function (object) {
    if (!object.__UUID) {
        object.__UUID = Math.random().toString(36).substr(2,9);
    }
    return object.__UUID;
};

Slides.hasTouch = function () {
    return document.documentElement && document.documentElement.hasOwnProperty('ontouchstart');
};
if (Slides.hasTouch()) {
    Slides.events = {click: "click", down: "touchstart", up: "touchend", move: "touchmove"};
} else {
    Slides.events = {click: "click", down: "mousedown", up: "mouseup", move: "mousemove"};
}

Slides.log = function (message) {
    Slides.Logger.getInstance().log(message);
};

Slides.removeClass = function (element, className) {
    var classObject = Slides.buildClassObject(element);
    delete classObject[className];
    var classString = Slides.buildClassString(classObject)
    if (classString.length === 0) {
        element.removeAttribute("class");
    } else {
        element.setAttribute("class", classString);
    }
};

Slides.addClass = function (element, className) {
    var classObject = Slides.buildClassObject(element);
    classObject[className] = true;
    element.setAttribute("class", Slides.buildClassString(classObject));
};

Slides.buildClassObject = function (element) {
    var classesString = element.getAttribute("class") || "";
    var classList = classesString.split(" ");
    var classObject = {};
    var index;
    for (index = 0; index < classList.length; index++) {
        classObject[classList[index]] = true;
    }
    return classObject;
};

Slides.buildClassString = function (classObject) {
    var className;
    var classList = [];
    for (className in classObject) {
        if (!classObject.hasOwnProperty(className)) {
            continue;
        }
        classList.push(className);
    }
    return classList.join(" ").trim();
};

Slides.Builder = function () {
    var MDPlus = require('md-plus');

    // Initialize this generator.
    this.initialize = function () {
        this._buildDefinitions();
    };

    // Consume the contents of container, building the stories
    this.consume = function (container) {
        var deck;
        var parser = new MDPlus.Parser(container, this._definitions);
        this._deck = new Deck();
        parser.parse();
        this._deck.build();

        return new Show(this._deck, container);
    }

    // Creates the parser definition object for use by the parser.
    this._buildDefinitions = function () {
        var builder = new MDPlus.Definition.Builder();
        this._definitions = builder.build([{
            tag: 'HR', ref: 'divider',
            handler: this._addSlide, context: this
        }]);
    };

    this._addSlide = function (span, definition) {
        var slideElements = [];
        span.eachShallow(function (element) {
            if (element.tagName !== 'HR') {
                slideElements.push(element);
            }
        });

        this._deck.push(new Slide(slideElements));
    };

    this.initialize.apply(this, arguments);

    // A collection of Slides
    function Deck () {
        this._slides = [];

        this.push = function (slide) {
            var index = this._slides.length;
            this._slides.push(slide);

            slide.index = index;
            if (index === 0) {
                slide.isFirst = true;
            }
            slide.isLast = true;
            if (index > 0) {
                this._slides[index - 1].isLast = false;
            }
        };

        this.build = function () {
            var index;
            var hrElements, hrElement;
            for (index = this._slides.length; index--;) {
                this._slides[index].build();
            }
            hrElements = document.getElementsByTagName('HR');
            for (index = hrElements.length; index--;) {
                hrElement = hrElements[index];
                hrElement.parentNode.removeChild(hrElement);
            }
        };

        this.getLength = function () {
            return this._slides.length;
        };

        this.getSlide = function (index) {
            return this._slides[index];
        };
    };

    // A single slide containing content
    function Slide (elements) {
        this.build = function () {
            var index, elementsLength;;

            this.div = document.createElement('DIV');
            this.div.setAttribute('class', 'slide');

            elementsLength = elements.length;
            for (index = 0; index < elementsLength; index++) {
                this.div.appendChild(elements[index]);
            }
        };

        this.place = function (percent) {
            var distance = 20;
            var threshold = 0.00001;
            var opacity;
            var divStyle;
            this.percent = percent;
            if (percent >= 1 || percent <= -1) {
                this.div.setAttribute('style', 'display: none;');
            } else if (-threshold < percent && percent < threshold) {
                this.div.setAttribute('style', "-webkit-transform: translateX(0em);");
            } else {
                opacity = Math.min(1, Math.max(0.01, 3 * (1 - Math.abs(percent))));
                divStyle = [
                    "-webkit-transform: translateX(" + (-distance * percent) + "em);"
                ]
                if (!(this.isFirst && percent < 0) &&
                    !(this.isLast && percent > 0)) {
                    divStyle.push("opacity: " + opacity);
                }
                this.div.setAttribute('style', divStyle.join(" "));
            }
        };

        this.isVisible = function () {
            return this.percent > -1 && this.percent < 1;
        };

        this.isTextless = function () {
            var textContent = this.div.textContent.trim();
            if (textContent.length === 0) {
                return true;
            }
            var headline = this.div.getElementsByTagName('h1')[0];
            if (headline && headline.textContent.trim() === textContent) {
                return true;
            }
        };
    };

    // The controller for a slide deck, emitting events on slide change.
    function Show (deck, container) {
        this._currentSlideIndex;
        this._currentSlide;

        this._appendSlides = function () {
            var index, slide;
            var slidesLength = deck.getLength();
            for (index = 0; index < slidesLength; index++) {
                slide = deck.getSlide(index);
                slide.place(-10);
                container.appendChild(slide.div);
            };
        };
        this._appendSlides();

        this.getSlide = function (index, force) {
            if (!force && (!index || index === 0)) {
                index = this._currentSlideIndex;
            }
            return deck.getSlide(index);
        };

        this.getCurrentSlideIndex = function () {
            return this._currentSlideIndex;
        };

        this.gotoSlide = function(index) {
            if (index === this._currentSlideIndex) {
                return;
            }
            if (index < 0) {
                index = 0;
            }
            if (index >= deck.getLength()) {
                index = deck.getLength() - 1;
            }
            this._currentSlideIndex = index;
            this.emit('slideIndex', this._currentSlideIndex);
        };

        this.gotoNextSlide = function () {
            var nextIndex = this._currentSlideIndex + 1;
            if (isNaN(nextIndex)) {
                nextIndex = 0;
            }
            this.gotoSlide(nextIndex);
        };

        this.gotoPrevSlide = function () {
            var prevIndex = this._currentSlideIndex - 1;
            if (isNaN(prevIndex)) {
                prevIndex = 0;
            }
            this.gotoSlide(prevIndex);
        };

        this.getLength = function () {
            return deck.getLength();
        };

        this.getContainer = function () {
            return container;
        };
    };
    emittable(Show);

    // A mixin allowing an entity to emit events to listeners.
    function emittable (classFunction) {
        var proto = classFunction.prototype;

        var getHash = function (method, context) {
            return Slides.getUUID(method) + "_" + context && Slides.getUUID(context);
        };

        proto.on = function (eventName, method, context) {
            var uuid;
            if (!method) {
                throw new Error("no method passed to bind for: '" + eventName + "' event.");
            }
            if (!this._emitableListeners) {
                this._emitableListeners = {};
            }
            if (!this._emitableListeners[eventName]) {
                this._emitableListeners[eventName] = {};
            }
            hash = getHash(method, context);
            this._emitableListeners[eventName][hash] = {
                method: method,
                context: context
            };
        };

        proto.removeListener = function (eventName, method, context) {
            var hash;

            if (!this._emitableListeners || !this._emitableListeners[eventName]) {
                return;
            }

            hash = getHash(method, context);
            delete this._emitableListeners[eventName][hash];
            if (this._emitableListeners[eventName].length === 0) {
                delete this._emitableListeners[eventName];
            }
        };

        proto.emit = function (eventName) {
            var methodArguments;
            var callbacks;
            var hash, callback;
            var context;

            if (!this._emitableListeners || !this._emitableListeners[eventName]) {
                return;
            }

            callbacks = this._emitableListeners[eventName];
            if (!callbacks || callbacks.length === 0) {
                return;
            }
            methodArguments = Array.prototype.slice.apply(arguments, [1]);
            for (hash in callbacks) {
                if (!callbacks.hasOwnProperty(hash)) {
                    continue;
                }
                callback = callbacks[hash];
                context = callback.context || this;

                callback.method.apply(context, methodArguments);
            }
        };
    };
};

// A presenter controlling the slide you are viewingfrom the URL
Slides.URLPresenter = function (show) {
    this.getQuerySet = function (search) {
        var pairStrings;
        var index, pair;
        var slideIndex;
        var querySet = {};
        search = search.replace(/^\?/, "");
        pairStrings = search.split("&");
        for (index = 0; index < pairStrings.length; index++) {
            pair = pairStrings[index].split("=");
            querySet[pair[0]] = pair[1];
        }
        return querySet;
    };

    this.buildSearch = function (querySet) {
        var key, value;
        var pairStrings = [];
        var pair;
        for (key in querySet) {
            if (!querySet.hasOwnProperty(key)) {
                continue;
            }
            pair = [key];
            value = querySet[key];
            if (typeof value !== "undefined") {
                pair.push(value);
            }
            pairStrings.push(pair.join("="));
        }
        return "?" + pairStrings.join("&");
    };

    this.setFromURL = function (search) {
        var querySet = this.getQuerySet(search);
        slideIndex = parseInt(querySet['slide'], 10) - 1 || 0;
        show.gotoSlide(slideIndex);
    };

    this.setCurrentSlideIndex = function (slideIndex) {
        var querySet = this.getQuerySet(document.location.search);
        querySet["slide"] = (slideIndex + 1);
        if (history.replaceState) {
            history.replaceState(null, null, this.buildSearch(querySet));
        }
    };
    show.on('slideIndex', this.setCurrentSlideIndex, this);

    this.setFromURL(document.location.search);
};

// A presenter controlling the slide you are on from the keyboard.
Slides.KeyboardPresenter = function (show) {
    document.addEventListener('keydown', function (event) {
        if (event.keyCode === 39 ||
            event.keyCode === 70 ||
            event.keyCode === 78) {
            show.gotoNextSlide();
        } else if (event.keyCode === 37 ||
                   event.keyCode === 66 ||
                   event.keyCode === 80) {
            show.gotoPrevSlide();
        }
    });
};

Slides.ActiveSlides = function (show) {
    this._activeList = {};

    this._addNewSlides = function (percent) {
        var newSlideA, newSlideB;
        var index = Math.round(percent);
        newSlideA = show.getSlide(index);
        if (index > percent) {
            newSlideB = show.getSlide(index - 1);
        } else {
            newSlideB = show.getSlide(index + 1);
        }

        if (newSlideA) {
            this._activeList[newSlideA.index] = newSlideA;
        }
        if (newSlideB) {
            this._activeList[newSlideB.index] = newSlideB;
        }
    };

    this._updateSlidePercents = function (percent) {
        var index, slide;
        var toRemoveIndex, toRemove = [];
        for (index in this._activeList) {
            slide = this._activeList[index];
            slide.place(percent - slide.index);
            if (!slide.isVisible()) {
                toRemove.push(index);
            }
        }
        for (toRemoveIndex = 0; toRemoveIndex < toRemove.length; toRemoveIndex++) {
            index = toRemove[toRemoveIndex];
            delete this._activeList[index];
        }
    };

    this.setLocation = function (percent) {
        this._addNewSlides(percent);
        this._updateSlidePercents(percent);
    };
};

Slides.DraggingPresenter = function (show) {
    var self = this;
    this.activeSlides = new Slides.ActiveSlides(show);
    this.location = {
        currentPercent: show.getCurrentSlideIndex(),
        targetPercent: show.getCurrentSlideIndex(),
        multiplier: 0.005,
        max: show.getLength(),
        min: -1
    };
    this.animation = {
        speed: .1
    };
    this.touch = {
        startX: undefined,
        startLocation: undefined,
        isDragging: false
    };
    this.touchStart = function (event) {
        if (self.touch.isDragging) {
            return;
        }
        self.touch.startX = event.pageX;
        self.touch.startLocation = self.location.currentPercent;
        self.touch.isDragging = true;
        self.bindDragEvents();
    };
    this.setLocation = function (percent, options) {
        var max = this.location.max;
        var min = this.location.min;
        if (options && options.snapToSlide) {
            max -= 1;
            min += 1;
        }
        if (percent > max) {
            precent = max;
        }
        if (percent < min) {
            percent = min;
        }
        self.location.targetPercent = percent;
        if (self.location.targetPercent !== self.location.currentPercent ||
            options && options.forceUpdate) {
            Slides.AnimationManager.getInstance().requiresUpdate(self);
        }
    };
    this.setCurrentSlideIndex = function (slideIndex) {
        if (this.touch.isDragging) {
            return;
        }
        this.setLocation(slideIndex, {forceUpdate: true});
    };
    this.tick = function () {
        isComplete = false;
        if (self.touch.isDragging) {
            isComplete = this._snapToLocation();
        } else {
            isComplete = this._tweenToLocation();
        }
        this._updatePlacement();
        if (self.touch.isDragging) {
            this._updateSlideIndex();
        }
        return isComplete;
    };
    this._snapToLocation = function () {
        self.location.currentPercent = self.location.targetPercent;
        return true;
    };
    this._tweenToLocation = function () {
        var direction = self.location.targetPercent > self.location.currentPercent ? 1 : -1;
        var isComplete = false;
        self.location.currentPercent += direction * self.animation.speed;
        if (direction === 1 && self.location.currentPercent > self.location.targetPercent) {
            self.location.currentPercent = self.location.targetPercent;
            isComplete = true;
        } else if (direction === -1 && self.location.currentPercent < self.location.targetPercent) {
            self.location.currentPercent = self.location.targetPercent;
            isComplete = true;
        }
        return isComplete;
    };
    this._updatePlacement = function () {
        this.activeSlides.setLocation(this.location.currentPercent);
    };
    this._updateSlideIndex = function () {
        show.gotoSlide(Math.round(this.location.currentPercent));
    };
    this.touchMove = function (event) {
        event.preventDefault();
        self.touch.offset = self.touch.startX - event.pageX;
        self.setLocation(self.touch.startLocation + self.touch.offset * self.location.multiplier);
    };
    this.touchEnd = function (event) {
        self.touch.isDragging = false;
        self.setLocation(Math.round(self.location.targetPercent), {snapToSlide: true});
        self.unbindDragEvents();
    };
    this.unbindDragEvents = function () {
        document.removeEventListener(Slides.events.move, this.touchMove)
    };
    this.bindDragEvents = function () {
        document.addEventListener(Slides.events.move, this.touchMove);
    };
    document.addEventListener(Slides.events.down, this.touchStart);
    document.addEventListener(Slides.events.up, this.touchEnd);

    show.on('slideIndex', this.setCurrentSlideIndex, this);
    this.setCurrentSlideIndex(show.getCurrentSlideIndex());
};

Slides.AnimationManager = function () {
    var self = this;
    this._updateObjects = {};

    this.requiresUpdate = function (object) {
        this._updateObjects[Slides.getUUID(object)] = object;
        this.wakeup();
    };

    this.wakeup = function () {
        if (!this._isAwake) {
            this._isAwake = true;
            this.tick();
        }
    };

    this.tick = function () {
        var uuid, object;
        var isComplete = true;
        var objectIsComplete;
        var toRemove = [];
        for (uuid in self._updateObjects) {
            if (!self._updateObjects.hasOwnProperty(uuid)) {
                continue;
            }
            object = self._updateObjects[uuid];
            objectIsComplete = object.tick();
            if (!objectIsComplete) {
                isComplete = false;
            } else {
                toRemove.push(uuid);
            }
        }

        for (index = toRemove.length; index--;) {
            uuid = toRemove[index];
            delete self._updateObjects[uuid];
        }

        if (!isComplete) {
            requestAnimationFrame(self.tick);
        } else {
            self._isAwake = false;
        }
    };
};
Slides.AnimationManager.getInstance = function() {
    if (!Slides.AnimationManager._instance) {
        Slides.AnimationManager._instance = new Slides.AnimationManager();
    }
    return Slides.AnimationManager._instance;
};

// A presenter controlling the slide you are on from unobtrusive thumbnails.
Slides.ThumbnailPresenter = function (show, itemWidth, unit) {
    this.thumbnails = [];

    this._buildThumbnails = function (show) {
        var index, slidesLength, slide;
        var div = document.createElement('DIV');
        var ul = document.createElement('UL');
        var li;
        slidesLength = show.getLength();
        div.setAttribute('class', 'thumbnails');
        ul.setAttribute('style', 'max-width: ' + (slidesLength * itemWidth) + unit + ';');
        for (index = 0; index < slidesLength; index++) {
            slide = show.getSlide(index, true);
            li = document.createElement('LI');
            li.setAttribute('id', 'thumb-' + index);
            if (slide.isTextless()) {
                li.setAttribute("class", "textless");
            }
            this.thumbnails.push(li);
            ul.appendChild(li);
        }
        div.appendChild(ul);
        show.getContainer().appendChild(div);
    };

    this.setCurrentSlideIndex = function (slideIndex) {
        if (this.currentThumb) {
            Slides.removeClass(this.currentThumb, 'current');
        }
        this.currentThumb = this.thumbnails[slideIndex];
        if (this.currentThumb) {
            Slides.addClass(this.currentThumb, 'current');
        }
    };
    show.on('slideIndex', this.setCurrentSlideIndex, this);

    this._buildThumbnails(show);
    this.setCurrentSlideIndex(show.getCurrentSlideIndex());
};

Slides.InstantPresenter = function (show) {
    this.setCurrentSlideIndex = function (slideIndex) {
        if (this._currentSlide) {
            this._currentSlide.place(-10);
        }
        this._currentSlide = show.getSlide(slideIndex);
        if (this._currentSlide) {
            this._currentSlide.place(0);
        }
    };
    show.on('slideIndex', this.setCurrentSlideIndex, this);
    this.setCurrentSlideIndex(show.getCurrentSlideIndex());
};

Slides.Logger = function () {
    this.getElement = function () {
        if (!this._element) {
            if (!this._container) {
                this._container = document.getElementsByTagName('body')[0];
            }
            this._element = document.createElement('DIV');
            this._element.setAttribute('class', 'log');
            this._container.appendChild(this._element);
        }
        return this._element;
    };
    this.appendClass = function (className) {
        var element = this.getElement();
        var classNames = element.getAttribute('class') || "";
        var classNameList = classNames.split(/\W+/);
        if (classNameList.indexOf(className) === -1) {
            classNameList.push(className);
        }
        element.setAttribute('class', classNameList.join(" "));
    };
    this.log = function (message, className) {
        var entry = document.createElement('P');
        if (className) {
            entry.setAttribute('class', className);
            if (className && className === 'error') {
                this.appendClass('hasError');
            }
        }
        entry.innerHTML = message;
        this.getElement().appendChild(entry);
    };
};
Slides.Logger.getInstance = function () {
    if (!Slides.Logger._instance) {
        Slides.Logger._instance = new Slides.Logger();
    }
    return Slides.Logger._instance;
};

// Abstract base class for Viewers and Speakers.
Slides.FayePresenter = function () {};
(function (proto) {
    proto.initialize = function (show, fayeClient) {
        this.CHANNEL = "/slides";

        this.show = show;
        this.fayeClient = fayeClient;

        this.isConnected = false;

        this.subscribe();
    };

    proto.subscribe = function () {
        var self = this;
        this.subscription = this.fayeClient.subscribe(this.CHANNEL, this.slidesMessage);

        this.subscription.callback(function () {
            self.isConnected = true;
            Slides.log('connected', 'info');
        });

        self.subscription.errback(function (error) {
            self.error = error;
            Slides.log('connected', 'error');
        });
    };

    proto.slidesMessage = function (message) {
        console.log(message);
    };

    proto.isMessageValid = function (message) {
        return message.hasOwnProperty("slideIndex");
    };
} (Slides.FayePresenter.prototype));

Slides.FayeViewerPresenter = function () {
    var self = this;

    this.setCurrentSlideIndex = function (slideIndex) {
        if (this.isConnected) {
            this.fayeClient.publish(this.CHANNEL, { slideIndex: slideIndex });
        }
    };

    this.slidesMessage = function (message) {
        if (self.isMessageValid(message)) {
            self.show.gotoSlide(message.slideIndex);
        } else {
            self.slidesMessage("invalid message!");
        }
    };

    this.initialize.apply(this, arguments);
};
Slides.FayeViewerPresenter.prototype = new Slides.FayePresenter();

Slides.FayeSpeakerPresenter = function () {
    this.setCurrentSlideIndex = function (slideIndex) {
        if (this.isConnected) {
            this.fayeClient.publish(this.CHANNEL, { slideIndex: slideIndex });
        }
    };

    this.initialize.apply(this, arguments);
    this.show.on('slideIndex', this.setCurrentSlideIndex, this);
};
Slides.FayeSpeakerPresenter.prototype = new Slides.FayePresenter();

Slides.TOCNode = function () {
    this._children = [];

    this.build = function (span, definition) {
        this._headerElement = span.getMatchingElement();
        this.label = this._headerElement.textContent;
        this.anchorName = this.label.toLowerCase().replace(/([^a-z0-9]+)/g, "_");
    };

    this.push = function (child) {
        child.parent = this;
        this._children.push(child);
    };

    this.getString = function () {
        var index;
        var buffer = []
        for (index = 0; index < this._children.length; index++) {
            buffer.push(this._children[index].label);
        }
        return buffer.join(" &lt; ");
    };
};

Slides.OutlinePresenter = function (show) {
    var self = this;

    this._getSlideTOC = function (slide) {
        var MDPlus = require('md-plus');

        var defBuilder = new MDPlus.Definition.Builder();
        var definition = defBuilder.build([{ ref: 'header', tag: /^h[0-9]$/i }]);
        var treeBuilder = new MDPlus.TreeBuilder({classRef: Slides.TOCNode}, definition);
        treeBuilder.bakeDefinitions();
        var parser = new MDPlus.Parser(slide.div, definition);
        parser.parse();

        return treeBuilder.getObjects();
    }

    this.getOutline = function () {
        var index, slide, toc;
        var outline = [];

        var showLength = show.getLength();
        for (index = 0; index < showLength; index++) {
            slide = show.getSlide(index, true);
            toc = this._getSlideTOC(slide);
            outline.push(toc);
        }

        return outline;
    };

    this.buildOutlineRow = function (slideTOC) {
        var outlineRow = document.createElement('TR');
        var index, header;
        var buffer = [];
        var cell;
        if (slideTOC.length === 0) {
            cell = document.createElement('TD');
            cell.setAttribute('class', 'blank-row');
            cell.innerHTML = "&lt;image&gt;";
            outlineRow.appendChild(cell);
        } else {
            for (index = 0; index < slideTOC.length; index++) {
                cell = document.createElement('TD');
                header = slideTOC[index];
                cell.innerHTML = header.label;
                outlineRow.appendChild(cell);
            }
        }
        return outlineRow;
    };

    this.buildOutlineDiv = function () {
        var outlineDiv = document.createElement('TABLE');
        outlineDiv.setAttribute("class", "outline");

        var outline = this.getOutline();
        var index, outlineLength, slideTOC;
        var outlineRow;

        this._rows = [];
        outlineLength = outline.length;
        for (index = 0; index < outlineLength; index++) {
            slideTOC = outline[index];
            outlineRow = self.buildOutlineRow(slideTOC);
            this._rows.push(outlineRow);
            outlineDiv.appendChild(outlineRow);
        }

        return outlineDiv;
    };

    this.reveal = function () {
        var body = document.getElementsByTagName('body')[0];
        body.appendChild(this.outlineDiv);
    };

    this.setCurrentSlideIndex = function (slideIndex) {
        if (this._currentRow) {
            Slides.removeClass(this._currentRow, "current");
        }
        this._currentRow = this._rows[slideIndex];
        Slides.addClass(this._currentRow, "current");
    };

    this.outlineDiv = this.buildOutlineDiv();
    show.on('slideIndex', this.setCurrentSlideIndex, this);
};

/* Autoplay all videos on a slide when it appears */
Slides.VideoPresenter = function (show) {
    var self = this;

    this.setCurrentSlideIndex = function (slideIndex) {
        var slide;

        this.eachVideo(function (video) {
            video.currentTime = 0;
            video.pause && video.pause();
        });
        slide = show.getSlide(slideIndex);
        this._currentVideos = slide.div.getElementsByTagName('video');

        this.eachVideo(function (video) {
            video.currentTime = 0;
            video.play && video.play();
        });
    };

    this.eachVideo = function (callback) {
        var index;
        if (!this._currentVideos) {
            return;
        }
        for (index = 0; index < this._currentVideos.length; index++) {
            callback(this._currentVideos[index]);
        }
    };

    show.on('slideIndex', this.setCurrentSlideIndex, this);
};

(function( win ){
    var doc = win.document;

    // If there's a hash, or addEventListener is undefined, stop here
    if( !location.hash && win.addEventListener ){

	//scroll to 1
	window.scrollTo( 0, 1 );
	var scrollTop = 1,
	getScrollTop = function(){
	    return win.pageYOffset || doc.compatMode === "CSS1Compat" && doc.documentElement.scrollTop || doc.body.scrollTop || 0;
	},

	//reset to 0 on bodyready, if needed
	bodycheck = setInterval(function(){
	    if( doc.body ){
		clearInterval( bodycheck );
		scrollTop = getScrollTop();
		win.scrollTo( 0, scrollTop === 1 ? 0 : 1 );
	    }
	}, 15 );

	win.addEventListener( "load", function(){
	    setTimeout(function(){
		//at load, if user hasn't scrolled more than 20 or so...
		if( getScrollTop() < 20 ){
		    //reset to hide addr bar at onload
		    win.scrollTo( 0, scrollTop === 1 ? 0 : 1 );
		}
	    }, 0);
	} );
    }
})(this);
