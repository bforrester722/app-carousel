/**
  * `app-carousel`
  * 
  *
  * @customElement
  * @polymer
  * @demo demo/index.html
  *
  *
  *   
  *   Styling:
  *   
  *   --carousel-height, 
  *   --carousel-width: defaulted to 100%
  * 
  *   --carousel-overflow-x, 
  *   --carousel-overflow-y: default to hidden
  *
  *   --carousel-dot-size: default 8px
  *   --carousel-dot-spacing: default 8px
  * 
  *   --carousel-ui-color, 
  *   --carousel-ui-background-color,
  *   --carousel-ui-ink-color: nav btns, av btns and dots
  *   
  *
  *   Api:
  *
  *     Properties:
  *
  *     auto-play      <Boolean> false,   starts player immediately
  *     decay          <Number>  2,       flick decay rate
  *     dots           <Boolean> false,   image index ui dots
  *     flip-time      <Number>  3000,    milliseconds to wait between each flip
  *     images         <Array>   [],      photo objects passed in from consumer {capture, url, orientation}
  *     over-scroll    <Number>  5,       over scroll decay rate
  *     nav            <Boolean> false,   include nav ui
  *     visible-images <Number>  1,       number of images to display in the carousel at one time
  *
  *
  *     Methods:
  *     
  *     animateToSection(index)       animate to a given section by index number
  *     init()                        can be called by parent to resize
  *     moveToSection(index)          instant move to a given section by index number
  *     nextSlide(direction, recycle) animate to next slide, pass in direction and if it should
  *                                   wrap from last slide to begining slide
  *     play()                        start carousel flips
  *     stop()                        stop carousel flips
  *
  *
  *     Events:
  *
  *     'request-init'  fired in connectedCallback, 
  *                     parent should utilize spriteful-requested-init-mixin
  *                     to have carousel resize when its parent layout changes
  *
  *
  *     'carousel-lazy-load' fired after transitioning to a new section (sections can have multiple images)
  *                                    event.detail === {
  *                                       currentIndex: section index, 
  *                                       nextIndex:    upcoming section index,
  *                                    }
  *
  *
  */


import {PolymerElement, html}  from '@polymer/polymer/polymer-element.js';
import {GestureEventListeners} from '@polymer/polymer/lib/mixins/gesture-event-listeners.js';
import {SpritefulMixin}        from '@spriteful/spriteful-mixin/spriteful-mixin.js';
import {
  listen,
  listenOnce,
  schedule,
  wait
}                              from '@spriteful/utils/utils.js';
import htmlString              from './app-carousel.html';
import '@spriteful/app-icons/app-icons.js';
import '@polymer/paper-icon-button/paper-icon-button.js';
import '@polymer/paper-ripple/paper-ripple.js';
import '@polymer/iron-icon/iron-icon.js';


class SpritefulAppCarousel extends SpritefulMixin(GestureEventListeners(PolymerElement)) {

  static get is() { return 'app-carousel'; }

  static get template() {
    return html([htmlString]);
  }


  static get properties() {
    return {
      // set true to have carousel iterate through sections automatically, duh.
      autoPlay: Boolean,
      // touch flick decay positive int greater than 0
      decay: {
        type: Number,
        value: 2 // adjust to taste
      },
      // navigation dots
      dots: Boolean,
      // true to have clickable navigation arrows
      nav: Boolean,
      // overscroll effect decay rate
      overScroll: {
        type: Number,
        value: 5  // adjust to taste
      },
      // configureable number of images shown at one time
      visibleImages: {
        type: Number,
        value: 1
      },
      // ms to wait between each flip
      flipTime: {
        type: Number,
        value: 3000
      },

      _cancelFlick: Boolean,
      // the repeated slot elements contained in the carousel
      _carouselViews: Array,
      // a section can include more than one image
      _currentSectionIndex: {
        type: Number,
        value: 0
      },
      // keep track of how far the carousel has been tracked
      _currentX: Number,
      // controls how many dots stamp out and which one gets the selected class
      _dotsArray: {
        type: Array,
        computed: '__computeDotsArray(_sectionCount, _currentSectionIndex)'
      },
      // cached val from touch event handler
      _finalVelocity: Number,
      // used to determine section centers
      _fullSection: {
        type: Number,
        computed: '__computeFullSection(_maskWidth, visibleImages)'
      },

      _halfSection: {
        type: Number,
        computed: '__computeHalfSection(_fullSection)'
      },
      // current playing state
      _isPlaying: Boolean,
      // this element's measured width
      _maskWidth: Number,
      // depends on image container size and totol visible carousel width
      _minX: {
        type: Number,
        computed: '__computeMinX(_imagesContainerWidth, _maskWidth)'
      },
      // used to dynamically determine the slide end returns
      _imageWidth: Number,
      // used to dynamically determine the slide end returns
      _imagesContainerWidth: Number,
      // number of slotted image dom nodes
      _imageCount: Number,
      // if currently playing, cancel play during user interaction and 
      // resume playing after user interation
      _resumePlaying: Boolean,
      // section count is smaller than image count if 
      // displaying more than one image at a time
      _sectionCount: {
        type: Number,
        computed: '__computeSectionCount(_imageCount, visibleImages)'
      }

    };
  }


  static get observers() {
    return [
      '__autoPlayChanged(autoPlay)',
      '__imageCountChanged(_imageCount)'
    ];
  }
  

  async connectedCallback() {
    super.connectedCallback();
    // listen for window resize events in order to
    // dynamically resize images and containers
    listen(window,      'resize',     this.__setImageSize.bind(this));
    listen(this.$.slot, 'slotchange', this.__slotChangedHandler.bind(this));
    this.__updateImageCount();
    await schedule();
    this.style.opacity = '1';
    this.__setImageSize(); 
    this.fire('request-init', {node: this});
  }


  __computeFullSection(maskWidth, visibleImages) {
    if (maskWidth === undefined || visibleImages === undefined) { return; }
    return maskWidth / visibleImages;
  }


  __computeHalfSection(fullSection) {
    if (fullSection === undefined) { return; }
    return fullSection / 2;
  }


  __computeSectionCount(imageCount, visibleImages) {
    if (imageCount === undefined || visibleImages === undefined) { return; }
    return imageCount - visibleImages;
  }


  __computeMinX(containerWidth, maskWidth) {
   if (containerWidth === undefined || maskWidth === undefined) { return; }
    return -(containerWidth - maskWidth);
  }

  // move selected class to currently visible dot
  __computeDotsArray(count, index) {
    const array = [];
    for (let i = 0; i <= count; i += 1) {
      const obj = {selected: ''};
      if (i === index) {
        obj.selected = 'selected';
      }
      array.push(obj);
    }
    return array;
  }


  __updateImageCount() {
    const nodes = this.slotNodes('#slot');
    this._carouselViews = nodes.filter(node => 
      node.tagName !== undefined && node.tagName !== 'DOM-REPEAT');
    this._imageCount = this._carouselViews.length;
  }


  __slotChangedHandler() {
    this.__updateImageCount();
  }

  // remeasure each time the repeater adds/removes items asynchronously
  __imageCountChanged(num) {
    if (!num) { return; }
    this.__setImageSize();
  }


  __measureImageContainerWidth() {
    return this.$.imagesContainer.getBoundingClientRect().width;
  }


  __getXByIndex(index) {
    return -(this._fullSection * index);
  }


  __getSectionCenter(iteration) {
    return (this._fullSection * iteration) + this._halfSection;
  }


  __xHasHitLeftEndpoint() {
    return this._currentX >= 0;
  }


  __xHasHitRightEndpoint() {
    return this._currentX <= this._minX;
  }


  __getSoftClampedX(x, min, max, rate) {
    if (x < min) {
      const delta = x - min;
      return min - Math.abs(delta / rate);
    } 
    else if (x > max) {
      const delta = x - max;
      return max + Math.abs(delta / rate);
    }
    return x;
  }


  __getNearestSectionInfo(x, direction) {
    const firstCenter    = this.__getSectionCenter(0, direction);
    const finalCenter    = this.__getSectionCenter(this._sectionCount, direction);
    const quarterSection = this._halfSection / 2;
    const getNewX        = multiple => -(this._fullSection * multiple);
    
    const findNearestSection = () => {
      if (direction === 'right') {
        if (x <= firstCenter - quarterSection) {
          return {x: 0, index: 0};
        }
      } 
      else if (direction === 'left') {
        if (x <= firstCenter + quarterSection) {
          return {x: 0, index: 0};
        }
      }

      if (direction === 'right') {
        if (x > finalCenter - quarterSection) {
          const newX = getNewX(this._sectionCount);
          return {x: newX, index: this._sectionCount};
        }
      } 
      else if (direction === 'left') {
        if (x > finalCenter + quarterSection) {
          const newX = getNewX(this._sectionCount);
          return {x: newX, index: this._sectionCount - 1};
        }
      }
      // not at either end so iterate through the 
      // sections to find the one closest to x and 
      // move to center it in view
      for (let i = 0; i < this._sectionCount; i += 1) {
        const nextIteration = i + 1;
        const newX          = getNewX(nextIteration);
        const currentCenter = this.__getSectionCenter(i, direction);
        const nextCenter    = this.__getSectionCenter(nextIteration, direction);

        if (direction === 'right') {
          if (x > currentCenter - quarterSection && x <= nextCenter - quarterSection) {
            return {x: newX, index: nextIteration};
          }
        } 
        else if (direction === 'left') {
          if (x > currentCenter + quarterSection && x <= nextCenter + quarterSection) {
            return {x: newX, index: nextIteration};
          }
        }
      }
    };

    return findNearestSection();
  }


  __goToSection(index) {
    this._currentX = this.__getXByIndex(index);
    this.$.imagesContainer.classList.
      remove('same-direction-slide-transition', 'reverse-direction-slide-transition');
    this.__translateImageContainer(this._currentX); 
  }


  async __setImageSize() {
    const {height, width} = this.getBoundingClientRect();
    if (!this._carouselViews) { return; }
    this._maskWidth       = width;
    this._imageWidth      = width / this.visibleImages;
    this._carouselViews.forEach(element => {
      element.style.height = `${height}px`;
      element.style.width  = `${this._imageWidth}px`;
    });
    // wait for new layout after updateStyles
    await schedule();
    this._imagesContainerWidth = this.__measureImageContainerWidth();
    this.__goToSection(this._currentSectionIndex); 
  }


  async __fireLazyLoadEvent() {
    await listenOnce(this.$.imagesContainer, 'transitionend');
    const index = this._currentSectionIndex + this.visibleImages - 1;
    this.fire('carousel-lazy-load', {currentIndex: index, nextIndex: index + 1});
  }


  __translateImageContainer(x) {
    const clampedX = this.__getSoftClampedX(x, this._minX, 0, this.overScroll);
    this.$.imagesContainer.style.transform = `translateX(${clampedX}px)`;
  }


  async __animateImageContainer(x, direction = 'same') {
    const cssString = 
      direction === 'reverse' ? 
      'reverse-direction-slide-transition' : 
      'same-direction-slide-transition';
    this.$.imagesContainer.classList.add(cssString);
    this.__fireLazyLoadEvent();
    this.__translateImageContainer(x);
  }


  async __waitToAnimateImageContainer(x, waitTime = 100) {
    await wait(waitTime);
    this.__animateImageContainer(x, 'reverse');
  }


  __imagesOnDown() {
    this._cancelFlick = true;
  }


  async __imagesTracked(event) {
    await schedule();
    const {dx, ddx, state, x, dy} = event.detail;
    if(Math.abs(dy) > Math.abs(dx)) { 
      if (state === 'end') {
        this.__translateImageContainer(this._currentX);
      }
      return;
    }
    switch (state) {
      case 'start':
        this._cancelFlick = true;
        this.$.imagesContainer.classList.remove('same-direction-slide-transition', 'reverse-direction-slide-transition');
        // cancel play during user interaction
        if (this._isPlaying) {
          this._resumePlaying = true;
          this.__stop();
        }
        break;
      case 'track':
        this._finalVelocity = ddx;
        this.__translateImageContainer(this._currentX + dx);
        break;
      case 'end':
        const initialDirection = this._finalVelocity < 0 ? 'right' : 'left';
        this._cancelFlick      = false;
        this._currentX         = this._currentX + dx;

        const flickDecay = (velocity, direction) => {
          if (this._cancelFlick) { return; }

          if (velocity <= this.decay && velocity >= -this.decay) { // done accelerating
            // center nearest section
            const {x: centeredSectionX, index} = this.__getNearestSectionInfo(-this._currentX, direction);
            this._currentSectionIndex = index;
            // wait a small time if recentering changes direction from the user's flick
            // and is not hitting either endpoint
            if (direction === 'left' && centeredSectionX < this._currentX && !this.__xHasHitLeftEndpoint()) {
              this.__waitToAnimateImageContainer(centeredSectionX);
            } 
            else if (direction === 'right' && centeredSectionX > this._currentX && !this.__xHasHitRightEndpoint()) {
              this.__waitToAnimateImageContainer(centeredSectionX);
            } 
            else {
              this.__animateImageContainer(centeredSectionX);
            }
            // resume playing after user interaction
            if (this._resumePlaying) {
              this._resumePlaying = false;
              this.__play();
            }

            this._currentX = centeredSectionX;
            return;
          } 
          else if (velocity > this.decay) { // accelerating left
            this._currentX += velocity; // velocity starts as a positive int and approches 0

            if (this.__xHasHitLeftEndpoint()) { 
              velocity = this.decay;
            }

            window.requestAnimationFrame(() => flickDecay(velocity - this.decay, 'left'));
          } 
          else if (velocity < -this.decay) { // accelerating right
            this._currentX += velocity; // velocity starts as a positive int and approches 0

            if (this.__xHasHitRightEndpoint()) { 
              velocity = -this.decay;
            }

            window.requestAnimationFrame(() => flickDecay(velocity + this.decay, 'right'));
          }

          this.__translateImageContainer(this._currentX);
        };

        window.requestAnimationFrame(() => flickDecay(this._finalVelocity, initialDirection));

        break;
    }
  }


  __autoPlayChanged(bool) {
    if (bool) {
      this.__play();
    }
  }


  async __leftNavArrowClicked() {
    try {
      await this.clicked();
      if (this._isPlaying) {
        this.__play();
      }
      this.nextSlide('left');
    }
    catch (error) {
      if (error === 'click debounced') { return; }
      console.error(error); 
    }
  }


  async __rightNavArrowClicked() {
    try {
      await this.clicked();
      if (this._isPlaying) {
        this.__play();
      }
      this.nextSlide('right');
    }
    catch (error) {
      if (error === 'click debounced') { return; }
      console.error(error);
    }
  }


  async __dotClicked(event) {
    try {
      await this.clicked();
      const {index} = event.model;
      this.__stop();
      this.animateToSection(index);
      if (this.autoPlay) {
        await wait(this.flipTime);
        this.__play();
      }
    }
    catch (error) {
      if (error === 'click debounced') { return; }
      console.error(error);
    }
  }


  async __showAvIcon(type) {
    const icon = type === 'play' ? this.$.playIcon : this.$.stopIcon;
    icon.classList.add('show-av-icon');
    await wait(400);
    icon.classList.remove('show-av-icon');
  }


  __play() {
    this._isPlaying = true;
    // reset each time play is called
    window.clearInterval(this._playTimerId); 

    this._playTimerId = window.setInterval(() => {
      this.nextSlide('right', 'recycle');
    }, this.flipTime);
  }


  __stop() {
    this._isPlaying = false;
    window.clearInterval(this._playTimerId);
  }


  animateToSection(index) {
    this._currentX            = this.__getXByIndex(index);
    this._currentSectionIndex = index;
    this.__animateImageContainer(this._currentX);
  }


  init() {
    return this.__setImageSize();
  }


  moveToSection(index) {
    this._currentX            = this.__getXByIndex(index);
    this._currentSectionIndex = index;
    this.__translateImageContainer(this._currentX); 
  }


  nextSlide(direction = 'right', recycle) {
    if (direction === 'right') {
      // go back to first image if at last slide
      if (this._currentSectionIndex + 1 > this._sectionCount) {
        if (recycle === 'recycle') {
          this._currentSectionIndex = 0;
        }
      } 
      else { // next slide
        this._currentSectionIndex += 1;
      }
    } 
    else if (direction === 'left') {
      // go back to first image if at last slide
      if (this._currentSectionIndex - 1 < 0) {
        if (recycle === 'recycle') {
          this._currentSectionIndex = this._sectionCount;
        }
      } 
      else { // next slide
        this._currentSectionIndex -= 1;
      }
    }
    
    this.animateToSection(this._currentSectionIndex);
  }


  play() {
    this.__showAvIcon('play');
    this.__play();
  }


  stop() {
    this.__showAvIcon('stop');
    this.__stop();
  }

}

window.customElements.define(SpritefulAppCarousel.is, SpritefulAppCarousel);
